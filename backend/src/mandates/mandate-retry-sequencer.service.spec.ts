import { PrismaService } from '../../prisma/prisma.service';
import { RecoveryService } from '../recovery/recovery.service';
import { PolicyService } from '../policy/policy.service';
import { MandateRetrySequencerService } from './mandate-retry-sequencer.service';

describe('MandateRetrySequencerService', () => {
  let service: MandateRetrySequencerService;

  const queue = {
    upsertJobScheduler: jest.fn(),
  } as unknown as { upsertJobScheduler: jest.Mock };

  const prisma = {
    recoveryCase: {
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const recoveryService = {
    createStrategyForCase: jest.fn(),
    executeRecoveryAction: jest.fn(),
  } as unknown as RecoveryService;

  const policyService = {
    checkForRecoveryCase: jest.fn(),
  } as unknown as PolicyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MandateRetrySequencerService(
      queue as never,
      prisma,
      recoveryService,
      policyService,
    );
  });

  it('only queries for cases whose mandate is still confirmed and case is still active/unrecovered (hard eligibility, not a policy decision)', async () => {
    (prisma.recoveryCase.findMany as jest.Mock).mockResolvedValue([]);

    await service.sweepOnce('merchant-1');

    expect(prisma.recoveryCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          merchantId: 'merchant-1',
          outcome: null,
          payment: expect.objectContaining({
            order: expect.objectContaining({
              mandateId: { not: null },
              mandate: { status: 'CONFIRMED' },
            }),
          }),
        }),
      }),
    );
  });

  it('executes when policy says ALLOW (merchant policy controls the decision, not a hardcoded count/interval)', async () => {
    (prisma.recoveryCase.findMany as jest.Mock).mockResolvedValue([
      { id: 'case-1' },
    ]);
    (policyService.checkForRecoveryCase as jest.Mock).mockResolvedValue({
      decision: 'ALLOW',
      policyId: 'policy-1',
      reason: 'ok',
    });

    const result = await service.sweepOnce();

    expect(recoveryService.executeRecoveryAction).toHaveBeenCalledWith(
      'case-1',
    );
    expect(result).toEqual({ scanned: 1, attempted: 1, skipped: 0 });
  });

  it('does not execute when policy says BLOCK (e.g. retry limit reached)', async () => {
    (prisma.recoveryCase.findMany as jest.Mock).mockResolvedValue([
      { id: 'case-1' },
    ]);
    (policyService.checkForRecoveryCase as jest.Mock).mockResolvedValue({
      decision: 'BLOCK',
      policyId: 'policy-1',
      reason: 'Retry count exceeds the configured policy limit of 3.',
    });

    const result = await service.sweepOnce();

    expect(recoveryService.executeRecoveryAction).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 1, attempted: 0, skipped: 1 });
  });

  it('does not execute when policy says REQUIRE_APPROVAL (e.g. retry interval not yet elapsed, or approval-required policy)', async () => {
    (prisma.recoveryCase.findMany as jest.Mock).mockResolvedValue([
      { id: 'case-1' },
    ]);
    (policyService.checkForRecoveryCase as jest.Mock).mockResolvedValue({
      decision: 'REQUIRE_APPROVAL',
      policyId: 'policy-1',
      reason: 'Configured retry policy requires a 1440-minute gap.',
    });

    const result = await service.sweepOnce();

    expect(recoveryService.executeRecoveryAction).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 1, attempted: 0, skipped: 1 });
  });

  it('still counts a real attempt that failed at the provider layer as "attempted," not "skipped"', async () => {
    (prisma.recoveryCase.findMany as jest.Mock).mockResolvedValue([
      { id: 'case-1' },
    ]);
    (policyService.checkForRecoveryCase as jest.Mock).mockResolvedValue({
      decision: 'ALLOW',
      policyId: 'policy-1',
      reason: 'ok',
    });
    (recoveryService.executeRecoveryAction as jest.Mock).mockRejectedValue(
      new Error('Razorpay recurring charge failed: real provider error'),
    );

    const result = await service.sweepOnce();

    expect(result).toEqual({ scanned: 1, attempted: 1, skipped: 0 });
  });

  it('processes multiple candidates independently: one ALLOW, one BLOCK', async () => {
    (prisma.recoveryCase.findMany as jest.Mock).mockResolvedValue([
      { id: 'case-allow' },
      { id: 'case-block' },
    ]);
    (policyService.checkForRecoveryCase as jest.Mock).mockImplementation(
      (caseId: string) =>
        Promise.resolve(
          caseId === 'case-allow'
            ? { decision: 'ALLOW', policyId: 'policy-1', reason: 'ok' }
            : { decision: 'BLOCK', policyId: 'policy-1', reason: 'blocked' },
        ),
    );

    const result = await service.sweepOnce();

    expect(recoveryService.executeRecoveryAction).toHaveBeenCalledTimes(1);
    expect(recoveryService.executeRecoveryAction).toHaveBeenCalledWith(
      'case-allow',
    );
    expect(result).toEqual({ scanned: 2, attempted: 1, skipped: 1 });
  });
});
