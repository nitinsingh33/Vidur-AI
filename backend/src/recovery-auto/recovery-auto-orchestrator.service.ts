import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { RecoveryService } from '../recovery/recovery.service';
import { PolicyService } from '../policy/policy.service';
import { EscalationService } from '../escalation/escalation.service';
import { MlService } from '../ml/ml.service';
import { ACTIVE_RECOVERY_CASE_STATUSES } from '../recovery/recovery-case-status.util';

const AGENT_SERVICE_URL =
  process.env.AGENT_SERVICE_URL ?? 'http://localhost:8001';

/**
 * The in-process equivalent of the Python/LangGraph agent's graph
 * (load -> analyze -> ml probability -> strategy -> diagnose -> policy_check
 * -> execute/escalate -> observe), calling the exact same underlying methods
 * the agent calls over HTTP (RecoveryService.createStrategyForCase /
 * PolicyService.checkForRecoveryCase / RecoveryService.executeRecoveryAction
 * / RecoveryService.observeRecovery / EscalationService.escalateRecoveryCase)
 * directly, in-process.
 *
 * This exists so the hero "payment fails -> recovered" loop does not depend
 * on a second deployed service being reachable for the *decision* path: the
 * ML recovery-probability lookup and the Gemini diagnosis narration below
 * are both best-effort calls to the already-deployed Python agent service —
 * genuine AI participation in the automatic path — but neither one gates or
 * changes what happens next. PolicyService.checkForRecoveryCase, computed
 * from real database state, is the only thing that decides whether execution
 * is allowed; if either AI call fails, times out, or is never reached, the
 * deterministic strategy/policy/execute path proceeds unchanged. The Python
 * agent is otherwise untouched and still serves manual "Run Agent"/batch
 * mode exactly as before.
 */
@Injectable()
export class RecoveryAutoOrchestratorService {
  private readonly logger = new Logger(RecoveryAutoOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recoveryService: RecoveryService,
    private readonly policyService: PolicyService,
    private readonly escalationService: EscalationService,
    private readonly mlService: MlService,
  ) {}

  /**
   * Never throws — this is called fire-and-forget from webhook handlers and
   * sweep loops, which must not be blocked or broken by a recovery failure.
   *
   * `escalateOnRequireApproval` is true for the very first, detection-time
   * pass (a REQUIRE_APPROVAL there is a real, actionable "needs a human"
   * signal worth surfacing immediately) and false for the periodic retry
   * sweep (there, REQUIRE_APPROVAL usually just means "retry interval hasn't
   * elapsed yet" — escalating every sweep cycle until it does would be noise,
   * not a signal).
   */
  async runAutomaticRecovery(
    recoveryCaseId: string,
    opts?: { escalateOnRequireApproval?: boolean },
  ): Promise<void> {
    const escalateOnRequireApproval = opts?.escalateOnRequireApproval ?? true;

    try {
      const action =
        await this.recoveryService.createStrategyForCase(recoveryCaseId);

      // Best-effort AI participation — narrates and contextualizes, never
      // decides. A failure here is swallowed inside the helper itself and
      // never reaches this try/catch.
      await this.generateAiDiagnosis(recoveryCaseId, action.type);

      const policyResult = await this.policyService.checkForRecoveryCase(
        recoveryCaseId,
        action.type,
      );

      if (policyResult.decision === 'ALLOW') {
        await this.recoveryService.executeRecoveryAction(recoveryCaseId);
        await this.recoveryService.observeRecovery(recoveryCaseId);
        return;
      }

      if (
        policyResult.decision === 'REQUIRE_APPROVAL' &&
        !escalateOnRequireApproval
      ) {
        // Not an error, not a signal — just not time yet. The retry sweep
        // will check again next cycle.
        return;
      }

      await this.maybeEscalate(recoveryCaseId, policyResult.reason);
    } catch (error) {
      this.logger.error(
        `Automatic recovery failed for case ${recoveryCaseId}: ` +
          `${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Real (not fabricated) AI participation: fetches a live recovery-
   * probability score from the ML service, then asks the already-deployed
   * Python agent's narrow /diagnose endpoint (Gemini) to explain the case in
   * plain language, and persists it via the existing
   * RecoveryService.recordDiagnosis (same field manual "Run Agent" writes
   * to). Every step here is wrapped so a slow/unavailable AI service can
   * never block or alter the deterministic strategy/policy/execute path —
   * consistent with the Python graph's own get_recovery_probability/
   * diagnose_case nodes, which are best-effort for the same reason.
   */
  private async generateAiDiagnosis(
    recoveryCaseId: string,
    candidateIntervention: string,
  ): Promise<void> {
    try {
      const recoveryCase = await this.prisma.recoveryCase.findUnique({
        where: { id: recoveryCaseId },
        include: { payment: true },
      });

      if (!recoveryCase) {
        return;
      }

      let recoveryProbability: number | null = null;

      try {
        const features = await this.recoveryService.getMlFeatures(
          recoveryCaseId,
        );
        const prediction = await this.mlService.predictRecovery(features);
        recoveryProbability = prediction.recovery_probability;
      } catch (error) {
        this.logger.warn(
          `ML recovery-probability lookup unavailable for case ${recoveryCaseId}, ` +
            `continuing without it: ${error instanceof Error ? error.message : error}`,
        );
      }

      const response = await fetch(`${AGENT_SERVICE_URL}/diagnose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          root_cause: recoveryCase.rootCause,
          payment_amount: recoveryCase.payment
            ? Number(recoveryCase.payment.amount)
            : Number(recoveryCase.revenueAtRisk),
          payment_method: recoveryCase.payment?.method ?? null,
          failure_reason: recoveryCase.payment?.failureReason ?? null,
          retry_count: recoveryCase.payment?.attemptNumber ?? 0,
          recovery_probability: recoveryProbability,
          candidate_intervention: candidateIntervention,
        }),
      });

      if (!response.ok) {
        this.logger.warn(
          `AI diagnosis endpoint returned HTTP ${response.status} for case ${recoveryCaseId}; continuing without narration.`,
        );
        return;
      }

      const body = (await response.json()) as { reasoning: string | null };

      if (body.reasoning) {
        await this.recoveryService.recordDiagnosis(
          recoveryCaseId,
          body.reasoning,
        );
      }
    } catch (error) {
      this.logger.warn(
        `AI diagnosis unavailable for case ${recoveryCaseId}, continuing without it: ` +
          `${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * A BLOCK decision can mean "already recovered" or "case no longer
   * active" — both terminal facts, not something to escalate. Only escalate
   * when the case is still genuinely active, so this never flips an already
   * RECOVERED/STOPPED/EXHAUSTED/ESCALATED case's status.
   */
  private async maybeEscalate(recoveryCaseId: string, reason: string) {
    const recoveryCase = await this.prisma.recoveryCase.findUnique({
      where: { id: recoveryCaseId },
      select: { status: true },
    });

    if (
      !recoveryCase ||
      !ACTIVE_RECOVERY_CASE_STATUSES.includes(recoveryCase.status) ||
      recoveryCase.status === 'ESCALATED'
    ) {
      return;
    }

    await this.escalationService.escalateRecoveryCase(recoveryCaseId, reason);
  }
}
