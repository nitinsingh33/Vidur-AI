import { PrismaService } from '../../prisma/prisma.service';
import { RecoveryService } from '../recovery/recovery.service';
import { PolicyService } from '../policy/policy.service';
import { EscalationService } from '../escalation/escalation.service';
import { MlService } from '../ml/ml.service';
import { RecoveryAutoOrchestratorService } from './recovery-auto-orchestrator.service';

describe('RecoveryAutoOrchestratorService', () => {
  let service: RecoveryAutoOrchestratorService;
  let fetchMock: jest.Mock;

  const prisma = {
    recoveryCase: {
      findUnique: jest.fn(),
    },
  } as unknown as PrismaService;

  const recoveryService = {
    createStrategyForCase: jest.fn(),
    executeRecoveryAction: jest.fn(),
    observeRecovery: jest.fn(),
    getMlFeatures: jest.fn(),
    recordDiagnosis: jest.fn(),
  } as unknown as RecoveryService;

  const policyService = {
    checkForRecoveryCase: jest.fn(),
  } as unknown as PolicyService;

  const escalationService = {
    escalateRecoveryCase: jest.fn(),
  } as unknown as EscalationService;

  const mlService = {
    predictRecovery: jest.fn(),
  } as unknown as MlService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RecoveryAutoOrchestratorService(
      prisma,
      recoveryService,
      policyService,
      escalationService,
      mlService,
    );

    (recoveryService.createStrategyForCase as jest.Mock).mockResolvedValue({
      type: 'SEND_PAYMENT_LINK',
    });
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue({
      id: 'case-1',
      rootCause: 'insufficient_funds',
      revenueAtRisk: '4999',
      payment: null,
      status: 'OPEN',
    });
    (mlService.predictRecovery as jest.Mock).mockResolvedValue({
      recovery_probability: 0.7,
    });
    (recoveryService.getMlFeatures as jest.Mock).mockResolvedValue({});

    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reasoning: 'A real AI-generated explanation.' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('executes and observes when policy ALLOWs — the deterministic policy decision, not the AI call, gates execution', async () => {
    (policyService.checkForRecoveryCase as jest.Mock).mockResolvedValue({
      decision: 'ALLOW',
      policyId: 'policy-1',
      reason: 'ok',
    });

    await service.runAutomaticRecovery('case-1');

    expect(recoveryService.executeRecoveryAction).toHaveBeenCalledWith('case-1');
    expect(recoveryService.observeRecovery).toHaveBeenCalledWith('case-1');
    expect(escalationService.escalateRecoveryCase).not.toHaveBeenCalled();
  });

  it('persists real AI-generated diagnosis text before the policy decision, without it affecting the decision', async () => {
    (policyService.checkForRecoveryCase as jest.Mock).mockResolvedValue({
      decision: 'ALLOW',
      policyId: 'policy-1',
      reason: 'ok',
    });

    await service.runAutomaticRecovery('case-1');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/diagnose'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(recoveryService.recordDiagnosis).toHaveBeenCalledWith(
      'case-1',
      'A real AI-generated explanation.',
    );
    // Diagnosis happens before the policy check, but the ALLOW branch still runs.
    expect(recoveryService.executeRecoveryAction).toHaveBeenCalled();
  });

  it('never blocks execution when the AI diagnosis call fails — best-effort only', async () => {
    fetchMock.mockRejectedValue(new Error('agent service unreachable'));
    (policyService.checkForRecoveryCase as jest.Mock).mockResolvedValue({
      decision: 'ALLOW',
      policyId: 'policy-1',
      reason: 'ok',
    });

    await service.runAutomaticRecovery('case-1');

    expect(recoveryService.recordDiagnosis).not.toHaveBeenCalled();
    expect(recoveryService.executeRecoveryAction).toHaveBeenCalledWith('case-1');
  });

  it('never blocks execution when the ML probability lookup fails — best-effort only', async () => {
    (mlService.predictRecovery as jest.Mock).mockRejectedValue(
      new Error('ml service unreachable'),
    );
    (policyService.checkForRecoveryCase as jest.Mock).mockResolvedValue({
      decision: 'ALLOW',
      policyId: 'policy-1',
      reason: 'ok',
    });

    await service.runAutomaticRecovery('case-1');

    expect(recoveryService.executeRecoveryAction).toHaveBeenCalledWith('case-1');
  });

  it('escalates instead of executing when policy BLOCKs an active case', async () => {
    (policyService.checkForRecoveryCase as jest.Mock).mockResolvedValue({
      decision: 'BLOCK',
      policyId: 'policy-1',
      reason: 'Retry count exceeds the configured policy limit of 3.',
    });

    await service.runAutomaticRecovery('case-1');

    expect(recoveryService.executeRecoveryAction).not.toHaveBeenCalled();
    expect(escalationService.escalateRecoveryCase).toHaveBeenCalledWith(
      'case-1',
      'Retry count exceeds the configured policy limit of 3.',
    );
  });

  it('does NOT escalate a BLOCK that means "already recovered" — never flips a terminal case', async () => {
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue({
      id: 'case-1',
      status: 'RECOVERED',
    });
    (policyService.checkForRecoveryCase as jest.Mock).mockResolvedValue({
      decision: 'BLOCK',
      policyId: 'ALREADY_RECOVERED',
      reason: 'This case already has a verified recovery outcome.',
    });

    await service.runAutomaticRecovery('case-1');

    expect(escalationService.escalateRecoveryCase).not.toHaveBeenCalled();
  });

  it('escalates on REQUIRE_APPROVAL for the first detection-time pass (default)', async () => {
    (policyService.checkForRecoveryCase as jest.Mock).mockResolvedValue({
      decision: 'REQUIRE_APPROVAL',
      policyId: 'policy-1',
      reason: 'Customer contact limit reached.',
    });

    await service.runAutomaticRecovery('case-1');

    expect(escalationService.escalateRecoveryCase).toHaveBeenCalledWith(
      'case-1',
      'Customer contact limit reached.',
    );
  });

  it('silently skips (no escalation, no execution) on REQUIRE_APPROVAL for the periodic retry sweep', async () => {
    (policyService.checkForRecoveryCase as jest.Mock).mockResolvedValue({
      decision: 'REQUIRE_APPROVAL',
      policyId: 'policy-1',
      reason: 'Configured retry policy requires a 1440-minute gap; 900 minute(s) remain.',
    });

    await service.runAutomaticRecovery('case-1', {
      escalateOnRequireApproval: false,
    });

    expect(escalationService.escalateRecoveryCase).not.toHaveBeenCalled();
    expect(recoveryService.executeRecoveryAction).not.toHaveBeenCalled();
  });

  it('never throws even when the underlying pipeline itself throws', async () => {
    (recoveryService.createStrategyForCase as jest.Mock).mockRejectedValue(
      new Error('database exploded'),
    );

    await expect(service.runAutomaticRecovery('case-1')).resolves.toBeUndefined();
  });
});
