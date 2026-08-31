import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PolicyService } from './policy.service';

describe('PolicyService', () => {
  let service: PolicyService;

  const prisma = {
    policy: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    recoveryCase: {
      findUnique: jest.fn(),
    },
    recoveryAction: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  const auditService = {
    record: jest.fn(),
  } as unknown as AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PolicyService(prisma, auditService);
  });

  describe('check', () => {
    it('blocks when no policy is configured for the action type', async () => {
      (prisma.policy.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.check('merchant-1', 'RETRY_PAYMENT', 500, 0);

      expect(result.decision).toBe('BLOCK');
      expect(result.policyId).toBe('NO_POLICY_CONFIGURED');
    });

    it('blocks when the amount exceeds the configured policy limit', async () => {
      (prisma.policy.findFirst as jest.Mock).mockResolvedValue({
        id: 'policy-1',
        decision: 'ALLOW',
        maxAmount: 1000,
        maxRetries: null,
        maxContacts: null,
        retryIntervalMinutes: null,
      });

      const result = await service.check('merchant-1', 'RETRY_PAYMENT', 5000, 0);

      expect(result.decision).toBe('BLOCK');
      expect(result.reason).toMatch(/amount/i);
    });

    it('blocks when the real retry count exceeds the configured policy maxRetries', async () => {
      (prisma.policy.findFirst as jest.Mock).mockResolvedValue({
        id: 'policy-1',
        decision: 'ALLOW',
        maxAmount: null,
        maxRetries: 3,
        maxContacts: null,
        retryIntervalMinutes: null,
      });

      const result = await service.check('merchant-1', 'RETRY_PAYMENT', 500, 4);

      expect(result.decision).toBe('BLOCK');
      expect(result.reason).toMatch(/retry count/i);
      expect(result.reason).toMatch(/3/);
    });

    it('requires approval when the configured retry interval has not yet elapsed', async () => {
      (prisma.policy.findFirst as jest.Mock).mockResolvedValue({
        id: 'policy-1',
        decision: 'ALLOW',
        maxAmount: null,
        maxRetries: 5,
        maxContacts: null,
        retryIntervalMinutes: 1440,
      });

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const result = await service.check(
        'merchant-1',
        'RETRY_PAYMENT',
        500,
        1,
        1,
        fiveMinutesAgo,
      );

      expect(result.decision).toBe('REQUIRE_APPROVAL');
      expect(result.reason).toMatch(/configured retry policy/i);
    });

    it('allows once the configured retry interval has elapsed', async () => {
      (prisma.policy.findFirst as jest.Mock).mockResolvedValue({
        id: 'policy-1',
        decision: 'ALLOW',
        maxAmount: null,
        maxRetries: 5,
        maxContacts: null,
        retryIntervalMinutes: 60,
      });

      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      const result = await service.check(
        'merchant-1',
        'RETRY_PAYMENT',
        500,
        1,
        1,
        twoHoursAgo,
      );

      expect(result.decision).toBe('ALLOW');
    });

    it('never applies a retry-interval throttle when the policy has none configured', async () => {
      (prisma.policy.findFirst as jest.Mock).mockResolvedValue({
        id: 'policy-1',
        decision: 'ALLOW',
        maxAmount: null,
        maxRetries: 5,
        maxContacts: null,
        retryIntervalMinutes: null,
      });

      const justNow = new Date();

      const result = await service.check(
        'merchant-1',
        'RETRY_PAYMENT',
        500,
        1,
        1,
        justNow,
      );

      expect(result.decision).toBe('ALLOW');
    });
  });

  describe('checkForRecoveryCase', () => {
    it('blocks outright when the case already has a verified outcome', async () => {
      (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue({
        id: 'case-1',
        merchantId: 'merchant-1',
        status: 'RECOVERED',
        revenueAtRisk: '500',
        payment: null,
        outcome: { id: 'outcome-1' },
      });

      const result = await service.checkForRecoveryCase(
        'case-1',
        'RETRY_PAYMENT',
      );

      expect(result.decision).toBe('BLOCK');
      expect(result.policyId).toBe('ALREADY_RECOVERED');
      expect(prisma.policy.findFirst).not.toHaveBeenCalled();
    });

    it('blocks outright when the case is stopped or exhausted (terminal)', async () => {
      (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue({
        id: 'case-1',
        merchantId: 'merchant-1',
        status: 'EXHAUSTED',
        revenueAtRisk: '500',
        payment: null,
        outcome: null,
      });

      const result = await service.checkForRecoveryCase(
        'case-1',
        'RETRY_PAYMENT',
      );

      expect(result.decision).toBe('BLOCK');
      expect(result.policyId).toBe('CASE_NOT_ACTIVE');
    });

    it('uses the real number of past attempts, not payment.attemptNumber, as the retry count', async () => {
      (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue({
        id: 'case-1',
        merchantId: 'merchant-1',
        status: 'IN_PROGRESS',
        revenueAtRisk: '500',
        // attemptNumber is always 1 on a webhook-created payment, but this
        // mandate debit has genuinely failed 4 times already via the action
        // history below.
        payment: { amount: '500', attemptNumber: 1 },
        outcome: null,
      });
      (prisma.recoveryAction.findMany as jest.Mock).mockResolvedValue([
        { attemptedAt: new Date() },
        { attemptedAt: new Date() },
        { attemptedAt: new Date() },
        { attemptedAt: new Date() },
      ]);
      (prisma.recoveryAction.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.policy.findFirst as jest.Mock).mockResolvedValue({
        id: 'policy-1',
        decision: 'ALLOW',
        maxAmount: null,
        maxRetries: 3,
        maxContacts: null,
        retryIntervalMinutes: null,
      });

      const result = await service.checkForRecoveryCase(
        'case-1',
        'RETRY_PAYMENT',
      );

      expect(result.decision).toBe('BLOCK');
      expect(result.reason).toMatch(/retry count/i);
    });

    it('honors a human approval and skips re-evaluating the raw limits', async () => {
      (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue({
        id: 'case-1',
        merchantId: 'merchant-1',
        status: 'ESCALATED',
        revenueAtRisk: '500',
        payment: null,
        outcome: null,
      });
      (prisma.recoveryAction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.recoveryAction.findFirst as jest.Mock).mockResolvedValue({
        id: 'action-1',
        status: 'APPROVED',
      });

      const result = await service.checkForRecoveryCase(
        'case-1',
        'RETRY_PAYMENT',
      );

      expect(result.decision).toBe('ALLOW');
      expect(result.policyId).toBe('HUMAN_APPROVED');
      expect(prisma.policy.findFirst).not.toHaveBeenCalled();
    });
  });
});
