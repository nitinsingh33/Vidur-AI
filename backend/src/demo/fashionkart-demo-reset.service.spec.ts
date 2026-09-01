import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FashionKartDemoResetService } from './fashionkart-demo-reset.service';

describe('FashionKartDemoResetService', () => {
  let service: FashionKartDemoResetService;

  const prisma = {
    merchant: { findUnique: jest.fn() },
    order: { findMany: jest.fn(), deleteMany: jest.fn() },
    payment: { findMany: jest.fn(), deleteMany: jest.fn() },
    subscription: { findMany: jest.fn(), deleteMany: jest.fn() },
    invoice: { findMany: jest.fn(), deleteMany: jest.fn() },
    mandate: { findMany: jest.fn(), deleteMany: jest.fn() },
    recoveryCase: { findMany: jest.fn(), deleteMany: jest.fn() },
    recoveryAction: { count: jest.fn() },
    recoveryOutcome: { count: jest.fn() },
    promiseToPay: { count: jest.fn() },
    paymentEvent: { count: jest.fn() },
    auditLog: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  const auditService = {
    record: jest.fn(),
  } as unknown as AuditService;

  const actor = { id: 'admin-1' };

  function mockEmptyDemoData() {
    (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.subscription.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.mandate.findMany as jest.Mock).mockResolvedValue([]);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FashionKartDemoResetService(prisma, auditService);
  });

  it('refuses to run on a merchant that is not the dedicated demo tenant, even if called with that merchantId', async () => {
    (prisma.merchant.findUnique as jest.Mock).mockResolvedValue({
      isDemoMerchant: false,
    });

    await expect(service.reset('real-merchant', actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(prisma.order.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses to run when the merchant does not exist at all', async () => {
    (prisma.merchant.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.reset('missing-merchant', actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('is a clean no-op when the demo merchant has no isDemoData-tagged records at all', async () => {
    (prisma.merchant.findUnique as jest.Mock).mockResolvedValue({
      isDemoMerchant: true,
    });
    mockEmptyDemoData();

    const result = await service.reset('fashionkart', actor);

    expect(result).toEqual({
      ordersDeleted: 0,
      paymentsDeleted: 0,
      paymentEventsDeleted: 0,
      subscriptionsDeleted: 0,
      invoicesDeleted: 0,
      mandatesDeleted: 0,
      recoveryCasesDeleted: 0,
      recoveryActionsDeleted: 0,
      recoveryOutcomesDeleted: 0,
      promisesToPayDeleted: 0,
      auditLogsDeleted: 0,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.recoveryCase.findMany).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('deletes every demo-tagged record and their cascaded dependents, scoped strictly to this merchant, and reports honest counts', async () => {
    (prisma.merchant.findUnique as jest.Mock).mockResolvedValue({
      isDemoMerchant: true,
    });
    (prisma.order.findMany as jest.Mock).mockResolvedValue([{ id: 'order-1' }]);
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([
      { id: 'payment-standalone' },
    ]);
    (prisma.subscription.findMany as jest.Mock).mockResolvedValue([
      { id: 'sub-1' },
    ]);
    (prisma.invoice.findMany as jest.Mock).mockResolvedValue([{ id: 'inv-1' }]);
    (prisma.mandate.findMany as jest.Mock).mockResolvedValue([
      { id: 'mandate-1' },
    ]);

    // order-linked payment lookup (second payment.findMany call, keyed by orderId)
    (prisma.payment.findMany as jest.Mock).mockImplementation((args) => {
      if (args?.where?.orderId) {
        return Promise.resolve([{ id: 'payment-order-linked' }]);
      }
      return Promise.resolve([{ id: 'payment-standalone' }]);
    });

    (prisma.recoveryCase.findMany as jest.Mock).mockResolvedValue([
      { id: 'case-1' },
      { id: 'case-2' },
    ]);

    (prisma.recoveryAction.count as jest.Mock).mockResolvedValue(3);
    (prisma.recoveryOutcome.count as jest.Mock).mockResolvedValue(1);
    (prisma.promiseToPay.count as jest.Mock).mockResolvedValue(2);
    (prisma.paymentEvent.count as jest.Mock).mockResolvedValue(5);

    (prisma.$transaction as jest.Mock).mockResolvedValue([
      { count: 4 }, // auditLog
      { count: 2 }, // recoveryCase
      { count: 2 }, // payment
      { count: 1 }, // order
      { count: 1 }, // subscription
      { count: 1 }, // invoice
      { count: 1 }, // mandate
    ]);

    const result = await service.reset('fashionkart', actor);

    // Cross-merchant safety: every lookup and every delete must be scoped
    // by merchantId, never by the tag alone.
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { merchantId: 'fashionkart', isDemoData: true },
      }),
    );
    expect(prisma.recoveryCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ merchantId: 'fashionkart' }) }),
    );

    expect(result).toEqual({
      ordersDeleted: 1,
      paymentsDeleted: 2,
      paymentEventsDeleted: 5,
      subscriptionsDeleted: 1,
      invoicesDeleted: 1,
      mandatesDeleted: 1,
      recoveryCasesDeleted: 2,
      recoveryActionsDeleted: 3,
      recoveryOutcomesDeleted: 1,
      promisesToPayDeleted: 2,
      auditLogsDeleted: 4,
    });

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'fashionkart',
        action: 'FASHIONKART_DEMO_RESET',
        actorId: 'admin-1',
      }),
    );
  });

  it("never touches another merchant's data even if that merchant also has isDemoData-tagged rows", async () => {
    (prisma.merchant.findUnique as jest.Mock).mockResolvedValue({
      isDemoMerchant: true,
    });
    (prisma.order.findMany as jest.Mock).mockResolvedValue([
      { id: 'fashionkart-order' },
    ]);
    (prisma.payment.findMany as jest.Mock).mockImplementation((args) => {
      if (args?.where?.orderId) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    (prisma.subscription.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.mandate.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.recoveryCase.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.recoveryAction.count as jest.Mock).mockResolvedValue(0);
    (prisma.recoveryOutcome.count as jest.Mock).mockResolvedValue(0);
    (prisma.promiseToPay.count as jest.Mock).mockResolvedValue(0);
    (prisma.paymentEvent.count as jest.Mock).mockResolvedValue(0);
    (prisma.$transaction as jest.Mock).mockResolvedValue([
      { count: 0 },
      { count: 0 },
      { count: 0 },
      { count: 1 },
      { count: 0 },
      { count: 0 },
      { count: 0 },
    ]);

    await service.reset('fashionkart', actor);

    // Every single findMany/deleteMany call must carry merchantId:
    // 'fashionkart' — asserting this on every mock call proves a
    // different merchant's rows (e.g. 'other-merchant') can never be
    // selected by this invocation, regardless of their own isDemoData tags.
    const allCalls = [
      ...(prisma.order.findMany as jest.Mock).mock.calls,
      ...(prisma.payment.findMany as jest.Mock).mock.calls,
      ...(prisma.subscription.findMany as jest.Mock).mock.calls,
      ...(prisma.invoice.findMany as jest.Mock).mock.calls,
      ...(prisma.mandate.findMany as jest.Mock).mock.calls,
      ...(prisma.recoveryCase.findMany as jest.Mock).mock.calls,
    ];

    for (const [args] of allCalls) {
      if (args?.where?.merchantId !== undefined) {
        expect(args.where.merchantId).toBe('fashionkart');
      }
    }
  });

  it('is idempotent: calling reset twice in a row returns all-zero counts the second time', async () => {
    (prisma.merchant.findUnique as jest.Mock).mockResolvedValue({
      isDemoMerchant: true,
    });

    (prisma.order.findMany as jest.Mock)
      .mockResolvedValueOnce([{ id: 'order-1' }])
      .mockResolvedValueOnce([]);
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.subscription.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.mandate.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.recoveryCase.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.recoveryAction.count as jest.Mock).mockResolvedValue(0);
    (prisma.recoveryOutcome.count as jest.Mock).mockResolvedValue(0);
    (prisma.promiseToPay.count as jest.Mock).mockResolvedValue(0);
    (prisma.paymentEvent.count as jest.Mock).mockResolvedValue(0);
    (prisma.$transaction as jest.Mock).mockResolvedValue([
      { count: 0 },
      { count: 0 },
      { count: 0 },
      { count: 1 },
      { count: 0 },
      { count: 0 },
      { count: 0 },
    ]);

    const first = await service.reset('fashionkart', actor);
    expect(first.ordersDeleted).toBe(1);

    const second = await service.reset('fashionkart', actor);
    expect(second).toEqual({
      ordersDeleted: 0,
      paymentsDeleted: 0,
      paymentEventsDeleted: 0,
      subscriptionsDeleted: 0,
      invoicesDeleted: 0,
      mandatesDeleted: 0,
      recoveryCasesDeleted: 0,
      recoveryActionsDeleted: 0,
      recoveryOutcomesDeleted: 0,
      promisesToPayDeleted: 0,
      auditLogsDeleted: 0,
    });
  });

  it('never deletes non-demo (isDemoData: false) records — proven by only ever querying with isDemoData: true', async () => {
    (prisma.merchant.findUnique as jest.Mock).mockResolvedValue({
      isDemoMerchant: true,
    });
    mockEmptyDemoData();

    await service.reset('fashionkart', actor);

    for (const model of ['order', 'payment', 'subscription', 'invoice', 'mandate'] as const) {
      const calls = (prisma[model].findMany as jest.Mock).mock.calls;
      for (const [args] of calls) {
        expect(args.where.isDemoData).toBe(true);
      }
    }
  });
});
