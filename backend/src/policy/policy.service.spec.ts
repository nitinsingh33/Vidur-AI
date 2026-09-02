import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PolicyService } from './policy.service';

describe('PolicyService', () => {
  let service: PolicyService;

  const prisma = {
    policy: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      createMany: jest.fn(),
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

    it('reports attemptsUsed/attemptsLimit from maxRetries on an ALLOW decision', async () => {
      (prisma.policy.findFirst as jest.Mock).mockResolvedValue({
        id: 'policy-1',
        decision: 'ALLOW',
        maxAmount: null,
        maxRetries: 3,
        maxContacts: null,
        retryIntervalMinutes: null,
      });

      const result = await service.check('merchant-1', 'RETRY_PAYMENT', 500, 1, 1);

      expect(result.attemptsUsed).toBe(1);
      expect(result.attemptsLimit).toBe(3);
    });

    it('reports attemptsUsed/attemptsLimit from maxContacts when that is the configured cap', async () => {
      (prisma.policy.findFirst as jest.Mock).mockResolvedValue({
        id: 'policy-1',
        decision: 'ALLOW',
        maxAmount: null,
        maxRetries: null,
        maxContacts: 3,
        retryIntervalMinutes: null,
      });

      const result = await service.check(
        'merchant-1',
        'SEND_PAYMENT_LINK',
        500,
        2,
        2,
      );

      expect(result.attemptsUsed).toBe(2);
      expect(result.attemptsLimit).toBe(3);
    });

    it('omits attemptsUsed/attemptsLimit when no policy is configured at all', async () => {
      (prisma.policy.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.check('merchant-1', 'RETRY_PAYMENT', 500, 0);

      expect(result.attemptsUsed).toBeUndefined();
      expect(result.attemptsLimit).toBeUndefined();
    });
  });

  describe('syncDefaultPolicies', () => {
    it('creates only the missing action types and leaves existing rows untouched', async () => {
      (prisma.policy.findMany as jest.Mock).mockResolvedValue([
        { actionType: 'RETRY_PAYMENT' },
        { actionType: 'SEND_PAYMENT_LINK' },
        { actionType: 'SEND_EMAIL' },
        { actionType: 'SEND_WHATSAPP' },
        { actionType: 'UPDATE_PAYMENT_METHOD' },
        { actionType: 'FOLLOW_UP_RECEIVABLE' },
        { actionType: 'ESCALATE_HUMAN' },
        { actionType: 'STOP_RECOVERY' },
      ]);

      const result = await service.syncDefaultPolicies('merchant-1', {
        id: 'user-1',
      });

      expect(prisma.policy.createMany).toHaveBeenCalledTimes(1);
      const call = (prisma.policy.createMany as jest.Mock).mock.calls[0][0];
      expect(call.data).toHaveLength(1);
      expect(call.data[0]).toMatchObject({
        merchantId: 'merchant-1',
        actionType: 'SEND_VOICE_MESSAGE',
        enabled: true,
      });
      expect(result.created).toEqual(['SEND_VOICE_MESSAGE']);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          merchantId: 'merchant-1',
          action: 'POLICY_DEFAULTS_SYNCED',
          details: { createdActionTypes: ['SEND_VOICE_MESSAGE'] },
        }),
      );
    });

    it('does nothing when the merchant already has every default policy', async () => {
      (prisma.policy.findMany as jest.Mock).mockResolvedValue([
        { actionType: 'RETRY_PAYMENT' },
        { actionType: 'SEND_PAYMENT_LINK' },
        { actionType: 'SEND_EMAIL' },
        { actionType: 'SEND_WHATSAPP' },
        { actionType: 'UPDATE_PAYMENT_METHOD' },
        { actionType: 'FOLLOW_UP_RECEIVABLE' },
        { actionType: 'SEND_VOICE_MESSAGE' },
        { actionType: 'ESCALATE_HUMAN' },
        { actionType: 'STOP_RECOVERY' },
      ]);

      const result = await service.syncDefaultPolicies('merchant-1', {
        id: 'user-1',
      });

      expect(prisma.policy.createMany).not.toHaveBeenCalled();
      expect(auditService.record).not.toHaveBeenCalled();
      expect(result.created).toEqual([]);
    });

    it('never re-creates or re-enables a policy the merchant has already customized (e.g. disabled)', async () => {
      (prisma.policy.findMany as jest.Mock).mockResolvedValue([
        { actionType: 'SEND_WHATSAPP' },
      ]);

      await service.syncDefaultPolicies('merchant-1', { id: 'user-1' });

      const call = (prisma.policy.createMany as jest.Mock).mock.calls[0][0];
      const createdTypes = call.data.map(
        (policy: { actionType: string }) => policy.actionType,
      );
      expect(createdTypes).not.toContain('SEND_WHATSAPP');
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

    it('records attemptsUsed/attemptsLimit on the POLICY_EVALUATED audit entry', async () => {
      (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue({
        id: 'case-1',
        merchantId: 'merchant-1',
        status: 'IN_PROGRESS',
        revenueAtRisk: '500',
        payment: { amount: '500', attemptNumber: 1 },
        outcome: null,
      });
      (prisma.recoveryAction.findMany as jest.Mock).mockResolvedValue([
        { attemptedAt: new Date() },
      ]);
      (prisma.recoveryAction.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.policy.findFirst as jest.Mock).mockResolvedValue({
        id: 'policy-1',
        decision: 'ALLOW',
        maxAmount: null,
        maxRetries: null,
        maxContacts: 3,
        retryIntervalMinutes: null,
      });

      await service.checkForRecoveryCase('case-1', 'SEND_PAYMENT_LINK');

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'POLICY_EVALUATED',
          details: expect.objectContaining({
            attemptsUsed: 1,
            attemptsLimit: 3,
          }),
        }),
      );
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
