import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { RiskService } from '../risk/risk.service';
import { DemoService } from './demo.service';
import {
  DEMO_CUSTOMER_EXTERNAL_ID,
  DEMO_EXTERNAL_ID_PREFIX,
} from './demo.constants';

describe('DemoService', () => {
  let service: DemoService;

  const prisma = {
    customer: {
      upsert: jest.fn(),
    },
    payment: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    recoveryCase: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    auditLog: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  const paymentsService = {
    create: jest.fn(),
  } as unknown as PaymentsService;

  const riskService = {
    assessPayment: jest.fn(),
  } as unknown as RiskService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DemoService(prisma, paymentsService, riskService);
  });

  describe('triggerPaymentFailure', () => {
    it('finds/creates the demo customer, persists a FAILED payment via PaymentsService, then delegates risk detection to RiskService', async () => {
      const merchantId = 'merchant-1';
      const demoCustomer = { id: 'customer-1' };
      const payment = { id: 'payment-1', status: 'FAILED' };
      const recoveryCase = {
        id: 'case-1',
        revenueAtRisk: '12500.00',
        riskLevel: 'HIGH',
      };

      (prisma.customer.upsert as jest.Mock).mockResolvedValue(
        demoCustomer,
      );
      (paymentsService.create as jest.Mock).mockResolvedValue(payment);
      (riskService.assessPayment as jest.Mock).mockResolvedValue(
        recoveryCase,
      );

      const result = await service.triggerPaymentFailure(merchantId, {
        amount: 25000,
        failureReason: 'insufficient_funds',
      });

      expect(prisma.customer.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            merchantId_externalId: {
              merchantId,
              externalId: DEMO_CUSTOMER_EXTERNAL_ID,
            },
          },
        }),
      );

      expect(paymentsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          merchantId,
          customerId: demoCustomer.id,
          amount: '25000',
          status: 'FAILED',
          failureReason: 'insufficient_funds',
        }),
      );

      const createCallArg = (paymentsService.create as jest.Mock).mock
        .calls[0][0];
      expect(createCallArg.externalId).toMatch(
        new RegExp(`^${DEMO_EXTERNAL_ID_PREFIX}`),
      );

      // The demo layer never touches revenueAtRisk/riskLevel itself — it
      // only forwards to the real RiskService and returns what comes back.
      expect(riskService.assessPayment).toHaveBeenCalledWith(
        payment.id,
      );
      expect(result.recoveryCase).toBe(recoveryCase);
      expect(result.payment).toBe(payment);
    });

    it('generates a unique externalId per call so repeated demo failures do not collide', async () => {
      (prisma.customer.upsert as jest.Mock).mockResolvedValue({
        id: 'customer-1',
      });
      (paymentsService.create as jest.Mock).mockResolvedValue({
        id: 'payment-x',
      });
      (riskService.assessPayment as jest.Mock).mockResolvedValue({
        id: 'case-x',
      });

      await service.triggerPaymentFailure('merchant-1', { amount: 100 });
      await service.triggerPaymentFailure('merchant-1', { amount: 200 });

      const calls = (paymentsService.create as jest.Mock).mock.calls;
      expect(calls[0][0].externalId).not.toEqual(calls[1][0].externalId);
    });

    it('propagates a ConflictException from PaymentsService if a duplicate externalId ever occurs (unique constraint on merchantId+externalId)', async () => {
      (prisma.customer.upsert as jest.Mock).mockResolvedValue({
        id: 'customer-1',
      });
      (paymentsService.create as jest.Mock).mockRejectedValue(
        new ConflictException(
          'A payment with this externalId already exists for this merchant.',
        ),
      );

      await expect(
        service.triggerPaymentFailure('merchant-1', { amount: 100 }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(riskService.assessPayment).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('is a clean no-op when no demo records exist for the merchant', async () => {
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.reset('merchant-1');

      expect(result).toEqual({
        paymentsDeleted: 0,
        recoveryCasesDeleted: 0,
        auditLogsDeleted: 0,
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('only queries/deletes payments tagged with the demo prefix, scoped to the given merchantId', async () => {
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([
        { id: 'payment-1' },
        { id: 'payment-2' },
      ]);
      (prisma.recoveryCase.findMany as jest.Mock).mockResolvedValue([
        { id: 'case-1' },
      ]);
      (prisma.$transaction as jest.Mock).mockResolvedValue([
        { count: 1 },
        { count: 1 },
        { count: 2 },
      ]);

      const result = await service.reset('merchant-1');

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            merchantId: 'merchant-1',
            externalId: { startsWith: DEMO_EXTERNAL_ID_PREFIX },
          },
        }),
      );

      expect(prisma.recoveryCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            merchantId: 'merchant-1',
            paymentId: { in: ['payment-1', 'payment-2'] },
          },
        }),
      );

      expect(result).toEqual({
        auditLogsDeleted: 1,
        recoveryCasesDeleted: 1,
        paymentsDeleted: 2,
      });
    });

    it('is idempotent: calling reset twice with nothing left the second time succeeds cleanly', async () => {
      (prisma.payment.findMany as jest.Mock)
        .mockResolvedValueOnce([{ id: 'payment-1' }])
        .mockResolvedValueOnce([]);
      (prisma.recoveryCase.findMany as jest.Mock).mockResolvedValue([
        { id: 'case-1' },
      ]);
      (prisma.$transaction as jest.Mock).mockResolvedValue([
        { count: 1 },
        { count: 1 },
        { count: 1 },
      ]);

      const first = await service.reset('merchant-1');
      const second = await service.reset('merchant-1');

      expect(first.paymentsDeleted).toBe(1);
      expect(second).toEqual({
        paymentsDeleted: 0,
        recoveryCasesDeleted: 0,
        auditLogsDeleted: 0,
      });
    });
  });
});
