import { RecoveryActionType } from '../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { RecoveryService } from './recovery.service';
import { RecoveryStrategyService } from './recovery-strategy.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { RazorpayService } from '../razorpay/razorpay.service';

describe('RecoveryService', () => {
  let service: RecoveryService;

  const prisma = {
    recoveryCase: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    recoveryAction: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    policy: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    mandate: {
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  const auditService = {
    record: jest.fn(),
  } as unknown as AuditService;

  const notificationService = {
    sendRecoveryNotification: jest.fn(),
  } as unknown as NotificationService;

  const razorpayService = {
    createPaymentLink: jest.fn(),
    createRecurringCharge: jest.fn(),
  } as unknown as RazorpayService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new RecoveryService(
      prisma,
      new RecoveryStrategyService(),
      notificationService,
      auditService,
      razorpayService,
    );
  });

  const testCases = [
    {
      rootCause: 'INSUFFICIENT_FUNDS',
      expectedAction: RecoveryActionType.RETRY_PAYMENT,
    },
    {
      rootCause: 'CARD_EXPIRED',
      expectedAction: RecoveryActionType.UPDATE_PAYMENT_METHOD,
    },
    {
      rootCause: 'CHECKOUT_ABANDONED',
      expectedAction: RecoveryActionType.SEND_PAYMENT_LINK,
    },
    {
      rootCause: 'INVOICE_OVERDUE',
      expectedAction: RecoveryActionType.FOLLOW_UP_RECEIVABLE,
    },
    {
      rootCause: 'REPEATED_FAILURE',
      expectedAction: RecoveryActionType.ESCALATE_HUMAN,
    },
  ];

  it.each(testCases)(
    'should create the correct action for $rootCause',
    async ({ rootCause, expectedAction }) => {
      prisma.recoveryCase.findUnique = jest.fn().mockResolvedValue({
        id: 'recovery-case-id',
        rootCause,
      });

      prisma.recoveryAction.findFirst = jest.fn().mockResolvedValue(null);

      prisma.recoveryAction.create = jest.fn().mockResolvedValue({
        id: 'action-id',
        recoveryCaseId: 'recovery-case-id',
        type: expectedAction,
        status: 'PENDING',
      });

      const result = await service.createStrategyForCase('recovery-case-id');

      expect(result.type).toBe(expectedAction);

      expect(prisma.recoveryAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recoveryCaseId: 'recovery-case-id',
            type: expectedAction,
            status: 'PENDING',
          }),
        }),
      );
    },
  );

  it('should return the existing active action instead of creating a duplicate', async () => {
    const existingAction = {
      id: 'existing-action-id',
      recoveryCaseId: 'recovery-case-id',
      type: RecoveryActionType.RETRY_PAYMENT,
      status: 'PENDING',
    };

    prisma.recoveryCase.findUnique = jest.fn().mockResolvedValue({
      id: 'recovery-case-id',
      rootCause: 'INSUFFICIENT_FUNDS',
    });

    prisma.recoveryAction.findFirst = jest
      .fn()
      .mockResolvedValue(existingAction);

    const result = await service.createStrategyForCase('recovery-case-id');

    expect(result).toEqual(existingAction);

    expect(prisma.recoveryAction.create).not.toHaveBeenCalled();
  });

  describe('approveAction / rejectAction', () => {
    const actor = { id: 'user-1', merchantId: 'merchant-1' };

    it('approves a REQUIRE_APPROVAL action, flips it to ALLOW, and reopens an escalated case', async () => {
      prisma.recoveryAction.findUnique = jest.fn().mockResolvedValue({
        id: 'action-1',
        recoveryCaseId: 'case-1',
        type: 'RETRY_PAYMENT',
        status: 'PENDING',
        policyDecision: 'REQUIRE_APPROVAL',
        recoveryCase: {
          id: 'case-1',
          merchantId: 'merchant-1',
          status: 'ESCALATED',
        },
      });
      prisma.recoveryAction.update = jest.fn().mockResolvedValue({
        id: 'action-1',
        status: 'APPROVED',
        policyDecision: 'ALLOW',
      });

      await service.approveAction('case-1', 'action-1', actor);

      expect(prisma.recoveryAction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'action-1' },
          data: { status: 'APPROVED', policyDecision: 'ALLOW' },
        }),
      );
      expect(prisma.recoveryCase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'case-1' },
          data: { status: 'IN_PROGRESS', closedAt: null },
        }),
      );
    });

    it('rejects approving an action that is not gated by REQUIRE_APPROVAL', async () => {
      prisma.recoveryAction.findUnique = jest.fn().mockResolvedValue({
        id: 'action-1',
        recoveryCaseId: 'case-1',
        status: 'PENDING',
        policyDecision: 'ALLOW',
        recoveryCase: {
          id: 'case-1',
          merchantId: 'merchant-1',
          status: 'IN_PROGRESS',
        },
      });

      await expect(
        service.approveAction('case-1', 'action-1', actor),
      ).rejects.toThrow();
      expect(prisma.recoveryAction.update).not.toHaveBeenCalled();
    });

    it('stops the case when a required approval is rejected', async () => {
      prisma.recoveryAction.findUnique = jest.fn().mockResolvedValue({
        id: 'action-1',
        recoveryCaseId: 'case-1',
        type: 'FOLLOW_UP_RECEIVABLE',
        status: 'PENDING',
        policyDecision: 'REQUIRE_APPROVAL',
        recoveryCase: {
          id: 'case-1',
          merchantId: 'merchant-1',
          status: 'ESCALATED',
        },
      });
      prisma.recoveryAction.update = jest.fn().mockResolvedValue({
        id: 'action-1',
        status: 'BLOCKED',
      });

      await service.rejectAction('case-1', 'action-1', actor);

      expect(prisma.recoveryCase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'case-1' },
          data: expect.objectContaining({ status: 'STOPPED' }),
        }),
      );
    });
  });

  describe('executeRecoveryAction', () => {
    function baseCase(overrides: Record<string, unknown> = {}) {
      return {
        id: 'case-1',
        merchantId: 'merchant-1',
        status: 'IN_PROGRESS',
        customer: { id: 'customer-1', name: 'Test', email: 't@example.com', phone: null, razorpayCustomerId: null },
        payment: { id: 'payment-1', amount: '500', orderId: null, order: null },
        order: null,
        invoice: null,
        subscription: null,
        actions: [
          { id: 'action-1', type: 'RETRY_PAYMENT', status: 'PENDING', policyDecision: 'ALLOW' },
        ],
        ...overrides,
      };
    }

    it('uses the merchant-configured policy maxRetries, not a hardcoded value, to decide exhaustion', async () => {
      (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(
        baseCase({
          actions: [
            { id: 'action-1', type: 'RETRY_PAYMENT', status: 'PENDING', policyDecision: 'ALLOW' },
            { id: 'action-0', type: 'RETRY_PAYMENT', status: 'FAILED', policyDecision: 'ALLOW' },
          ],
        }),
      );
      (prisma.policy.findFirst as jest.Mock).mockResolvedValue({
        id: 'policy-1',
        maxRetries: 1, // merchant configured a stricter-than-default limit
      });

      await expect(
        service.executeRecoveryAction('case-1'),
      ).rejects.toThrow(/attempt limit of 1/i);

      expect(prisma.recoveryCase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'case-1' },
          data: expect.objectContaining({ status: 'EXHAUSTED' }),
        }),
      );
      expect(prisma.recoveryAction.updateMany).not.toHaveBeenCalled();
    });

    it('is idempotent against duplicate scheduler execution: a lost claim race aborts cleanly with no charge attempted', async () => {
      (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(
        baseCase(),
      );
      (prisma.recoveryAction.updateMany as jest.Mock).mockResolvedValue({
        count: 0, // another concurrent call already claimed this action
      });

      await expect(
        service.executeRecoveryAction('case-1'),
      ).rejects.toThrow(/already being executed/i);

      expect(razorpayService.createPaymentLink).not.toHaveBeenCalled();
    });

    it('charges a mandate-backed failed payment headlessly instead of sending a payment link', async () => {
      (prisma.recoveryAction.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (prisma.recoveryAction.update as jest.Mock).mockImplementation(
        (args: { data: Record<string, unknown> }) => ({
          id: 'action-1',
          ...args.data,
        }),
      );
      (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(
        baseCase({
          payment: {
            id: 'payment-1',
            amount: '500',
            orderId: 'order-1',
            order: {
              id: 'order-1',
              mandateId: 'mandate-1',
              mandate: {
                id: 'mandate-1',
                status: 'CONFIRMED',
                externalId: 'token_real',
                maxAmount: '500',
                currency: 'INR',
                failedDebitCount: 1,
                lastAttemptAt: null,
              },
            },
          },
        }),
      );
      (razorpayService.createRecurringCharge as jest.Mock).mockResolvedValue({
        internalOrderId: 'internal-order-2',
        externalOrderId: 'order_new',
        paymentId: 'pay_new',
        status: 'created',
      });

      const result = await service.executeRecoveryAction('case-1');

      expect(razorpayService.createRecurringCharge).toHaveBeenCalledWith(
        expect.objectContaining({ mandateId: 'mandate-1', razorpayTokenId: 'token_real' }),
      );
      expect(razorpayService.createPaymentLink).not.toHaveBeenCalled();
      expect(prisma.mandate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mandate-1' },
          data: { lastAttemptAt: expect.any(Date) },
        }),
      );
      expect(result.status).toBe('SUCCESS');
    });

    it('refuses to charge a mandate that is not confirmed, without ever calling Razorpay', async () => {
      (prisma.recoveryAction.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (prisma.recoveryAction.update as jest.Mock).mockImplementation(
        (args: { data: Record<string, unknown> }) => ({
          id: 'action-1',
          ...args.data,
        }),
      );
      (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(
        baseCase({
          payment: {
            id: 'payment-1',
            amount: '500',
            orderId: 'order-1',
            order: {
              id: 'order-1',
              mandateId: 'mandate-1',
              mandate: {
                id: 'mandate-1',
                status: 'PAUSED',
                externalId: 'token_real',
                maxAmount: '500',
                currency: 'INR',
                failedDebitCount: 1,
                lastAttemptAt: null,
              },
            },
          },
        }),
      );

      const result = await service.executeRecoveryAction('case-1');

      expect(razorpayService.createRecurringCharge).not.toHaveBeenCalled();
      expect(result.status).toBe('FAILED');
    });
  });
});
