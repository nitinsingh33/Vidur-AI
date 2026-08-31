import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { RiskService } from '../risk/risk.service';
import { CheckoutSweepService } from '../checkout-sweep/checkout-sweep.service';
import { InvoiceOverdueSweepService } from '../invoices/invoice-overdue-sweep.service';
import { InvoicesService } from '../invoices/invoices.service';
import { RecoveryAutoOrchestratorService } from '../recovery-auto/recovery-auto-orchestrator.service';
import { RecoveryLabService } from './recovery-lab.service';

describe('RecoveryLabService', () => {
  let service: RecoveryLabService;

  const prisma = {
    customer: { upsert: jest.fn() },
    order: { create: jest.fn() },
    subscription: { create: jest.fn(), update: jest.fn() },
    mandate: { create: jest.fn() },
    recoveryOutcome: { create: jest.fn() },
    recoveryCase: { update: jest.fn() },
  } as unknown as PrismaService;

  const paymentsService = {
    create: jest.fn(),
  } as unknown as PaymentsService;

  const riskService = {
    assessPayment: jest.fn(),
    assessSubscriptionFailure: jest.fn(),
    assessMandateFailure: jest.fn(),
  } as unknown as RiskService;

  const checkoutSweepService = {
    sweepOnce: jest.fn(),
  } as unknown as CheckoutSweepService;

  const invoiceOverdueSweepService = {
    sweepOnce: jest.fn(),
  } as unknown as InvoiceOverdueSweepService;

  const invoicesService = {
    create: jest.fn(),
  } as unknown as InvoicesService;

  const autoOrchestrator = {
    runAutomaticRecovery: jest.fn().mockResolvedValue(undefined),
  } as unknown as RecoveryAutoOrchestratorService;

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.customer.upsert as jest.Mock).mockResolvedValue({ id: 'lab-customer' });
    service = new RecoveryLabService(
      prisma,
      paymentsService,
      riskService,
      checkoutSweepService,
      invoiceOverdueSweepService,
      invoicesService,
      autoOrchestrator,
    );
  });

  it('launchPaymentFailure creates a real FAILED payment and hands off to the automatic orchestrator, never an outcome directly', async () => {
    (paymentsService.create as jest.Mock).mockResolvedValue({ id: 'payment-1' });
    (riskService.assessPayment as jest.Mock).mockResolvedValue({ id: 'case-1' });

    const result = await service.launchPaymentFailure('merchant-1', {});

    expect(paymentsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ merchantId: 'merchant-1', status: 'FAILED' }),
    );
    expect(riskService.assessPayment).toHaveBeenCalledWith('payment-1');
    expect(autoOrchestrator.runAutomaticRecovery).toHaveBeenCalledWith('case-1');
    expect(prisma.recoveryOutcome.create).not.toHaveBeenCalled();
    expect(result.recoveryCaseId).toBe('case-1');
  });

  it('launchCheckoutAbandonment creates a real Order with an abandon signal and reuses the real sweep, never opens a case itself', async () => {
    (prisma.order.create as jest.Mock).mockResolvedValue({ id: 'order-1' });
    (checkoutSweepService.sweepOnce as jest.Mock).mockResolvedValue({
      scanned: 1,
      opened: 1,
      caseIds: ['case-2'],
    });

    const result = await service.launchCheckoutAbandonment('merchant-1', {});

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CREATED',
          abandonSignalAt: expect.any(Date),
        }),
      }),
    );
    expect(checkoutSweepService.sweepOnce).toHaveBeenCalledWith('merchant-1');
    expect(riskService.assessPayment).not.toHaveBeenCalled();
    expect(result.recoveryCaseId).toBe('case-2');
  });

  it('launchSubscriptionFailure mirrors the real subscription.pending webhook state transition', async () => {
    (prisma.subscription.create as jest.Mock).mockResolvedValue({ id: 'sub-1' });
    (prisma.subscription.update as jest.Mock).mockResolvedValue({ id: 'sub-1' });
    (riskService.assessSubscriptionFailure as jest.Mock).mockResolvedValue({
      id: 'case-3',
    });

    await service.launchSubscriptionFailure('merchant-1', {});

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { status: 'PAYMENT_FAILED', failedPaymentCount: { increment: 1 } },
    });
    expect(autoOrchestrator.runAutomaticRecovery).toHaveBeenCalledWith('case-3');
  });

  it('launchInvoiceOverdue creates a real overdue invoice and reuses the real sweep, not a direct case open', async () => {
    (invoicesService.create as jest.Mock).mockResolvedValue({ id: 'invoice-1' });
    (invoiceOverdueSweepService.sweepOnce as jest.Mock).mockResolvedValue({
      scanned: 1,
      opened: 1,
      caseIds: ['case-4'],
    });

    const result = await service.launchInvoiceOverdue('merchant-1', {});

    expect(invoicesService.create).toHaveBeenCalledWith(
      'merchant-1',
      expect.objectContaining({ customerId: 'lab-customer' }),
    );
    expect(invoiceOverdueSweepService.sweepOnce).toHaveBeenCalledWith('merchant-1');
    expect(result.recoveryCaseId).toBe('case-4');
  });

  it('launchMandateFailure creates a real paused mandate and lets the real strategy table escalate it, never attempting a fabricated debit', async () => {
    (prisma.mandate.create as jest.Mock).mockResolvedValue({ id: 'mandate-1' });
    (riskService.assessMandateFailure as jest.Mock).mockResolvedValue({
      id: 'case-5',
    });

    const result = await service.launchMandateFailure('merchant-1', {});

    expect(prisma.mandate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAUSED' }),
      }),
    );
    expect(riskService.assessMandateFailure).toHaveBeenCalledWith(
      'mandate-1',
      'MANDATE_PAUSED',
    );
    expect(autoOrchestrator.runAutomaticRecovery).toHaveBeenCalledWith('case-5');
    expect(result.recoveryCaseId).toBe('case-5');
  });
});
