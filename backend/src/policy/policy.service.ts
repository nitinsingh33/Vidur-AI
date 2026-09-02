import { Injectable, NotFoundException } from '@nestjs/common';

import { PolicyAction, RecoveryActionType } from '../generated/prisma/enums';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DEFAULT_POLICIES } from './default-policies';
import { UpdatePolicyDto } from './dto/update-policy.dto';

export interface PolicyCheckResult {
  decision: PolicyAction;
  policyId: string;
  reason: string;
  /**
   * How many times this action has actually been attempted for the case,
   * and the configured cap (whichever of maxRetries/maxContacts the matched
   * policy uses) — present only when a real Policy row was matched, so the
   * UI can show "2 of 3" rather than re-deriving it. Never affects the
   * decision above; purely informational.
   */
  attemptsUsed?: number;
  attemptsLimit?: number | null;
}

@Injectable()
export class PolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAllForMerchant(merchantId: string) {
    return this.prisma.policy.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Backfills any DEFAULT_POLICIES entry this merchant doesn't already have a
   * Policy row for — e.g. a merchant signed up before SEND_VOICE_MESSAGE
   * existed. Additive only: never touches, overwrites, or re-enables an
   * existing row for an actionType the merchant already has (including one
   * they've since disabled or edited), so it's always safe to call again.
   */
  async syncDefaultPolicies(merchantId: string, actor: { id: string }) {
    const existing = await this.prisma.policy.findMany({
      where: { merchantId },
      select: { actionType: true },
    });
    const existingTypes = new Set(existing.map((policy) => policy.actionType));

    const missing = DEFAULT_POLICIES.filter(
      (policy) => !existingTypes.has(policy.actionType),
    );

    if (missing.length === 0) {
      return { created: [] as string[] };
    }

    await this.prisma.policy.createMany({
      data: missing.map((policy) => ({
        merchantId,
        name: policy.name,
        description: policy.description,
        actionType: policy.actionType,
        decision: policy.decision,
        maxRetries: policy.maxRetries ?? null,
        maxContacts: policy.maxContacts ?? null,
        maxAmount: policy.maxAmount ?? null,
        retryIntervalMinutes: policy.retryIntervalMinutes ?? null,
        enabled: true,
      })),
    });

    const createdTypes = missing.map((policy) => policy.actionType);

    await this.auditService.record({
      merchantId,
      action: 'POLICY_DEFAULTS_SYNCED',
      actorType: 'HUMAN',
      actorId: actor.id,
      details: { createdActionTypes: createdTypes },
    });

    return { created: createdTypes };
  }

  async update(
    merchantId: string,
    policyId: string,
    dto: UpdatePolicyDto,
    actor: { id: string },
  ) {
    const policy = await this.prisma.policy.findFirst({
      where: { id: policyId, merchantId },
    });

    if (!policy) {
      throw new NotFoundException(`Policy ${policyId} not found.`);
    }

    const updated = await this.prisma.policy.update({
      where: { id: policyId },
      data: dto,
    });

    await this.auditService.record({
      merchantId,
      action: 'POLICY_UPDATED',
      actorType: 'HUMAN',
      actorId: actor.id,
      details: { policyId, actionType: policy.actionType, changes: dto },
    });

    return updated;
  }

  async check(
    merchantId: string,
    actionType: RecoveryActionType,
    amount: number,
    retryCount: number,
    contactCount = 0,
    lastAttemptedAt: Date | null = null,
  ): Promise<PolicyCheckResult> {
    const policy = await this.prisma.policy.findFirst({
      where: {
        merchantId,
        actionType,
        enabled: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!policy) {
      return {
        decision: PolicyAction.BLOCK,
        policyId: 'NO_POLICY_CONFIGURED',
        reason: `No policy configured for ${actionType}; blocking by default.`,
      };
    }

    // Whichever cap this policy actually uses — a given action type is
    // configured with at most one of these (see default-policies.ts) — and
    // the shared attempt count (retryCount === contactCount at the one real
    // call site, checkForRecoveryCase). Purely informational for the UI.
    const attemptsUsed = retryCount;
    const attemptsLimit = policy.maxRetries ?? policy.maxContacts ?? null;

    if (policy.maxAmount !== null && amount > Number(policy.maxAmount)) {
      return {
        decision: PolicyAction.BLOCK,
        policyId: policy.id,
        reason: 'Payment amount exceeds the configured policy limit.',
        attemptsUsed,
        attemptsLimit,
      };
    }

    if (policy.maxRetries !== null && retryCount > policy.maxRetries) {
      return {
        decision: PolicyAction.BLOCK,
        policyId: policy.id,
        reason: `Retry count exceeds the configured policy limit of ${policy.maxRetries}.`,
        attemptsUsed,
        attemptsLimit,
      };
    }

    if (policy.maxContacts !== null && contactCount >= policy.maxContacts) {
      return {
        decision: PolicyAction.BLOCK,
        policyId: policy.id,
        reason: 'Customer contact limit for this channel has been reached.',
        attemptsUsed,
        attemptsLimit,
      };
    }

    /*
     * A merchant-configurable minimum gap between attempts — this is a
     * policy setting (editable on the Policies page, defaults to 24h for
     * RETRY_PAYMENT), never a fixed provider or regulatory rule. This is
     * what the mandate retry sequencer relies on instead of any hardcoded
     * interval — see MandateRetrySequencerService.
     */
    if (
      policy.retryIntervalMinutes !== null &&
      lastAttemptedAt !== null
    ) {
      const minutesSinceLastAttempt =
        (Date.now() - lastAttemptedAt.getTime()) / 60_000;

      if (minutesSinceLastAttempt < policy.retryIntervalMinutes) {
        const minutesRemaining = Math.ceil(
          policy.retryIntervalMinutes - minutesSinceLastAttempt,
        );

        return {
          decision: PolicyAction.REQUIRE_APPROVAL,
          policyId: policy.id,
          reason:
            `Configured retry policy requires a ${policy.retryIntervalMinutes}-minute gap between attempts; ` +
            `${minutesRemaining} minute(s) remain. A human can still approve an early retry.`,
          attemptsUsed,
          attemptsLimit,
        };
      }
    }

    return {
      decision: policy.decision,
      policyId: policy.id,
      reason: policy.description ?? 'Policy decision applied.',
      attemptsUsed,
      attemptsLimit,
    };
  }

  async checkForRecoveryCase(
    recoveryCaseId: string,
    actionType: string,
  ): Promise<PolicyCheckResult> {
    const recoveryCase = await this.prisma.recoveryCase.findUnique({
      where: {
        id: recoveryCaseId,
      },
      include: {
        payment: true,
        outcome: true,
      },
    });

    if (!recoveryCase) {
      throw new NotFoundException(`Recovery case ${recoveryCaseId} not found.`);
    }

    /*
     * No blind retries: a case that already has a verified outcome (or is
     * already marked RECOVERED) is never eligible for further action,
     * regardless of what the policy says — this is a hard fact, not a
     * policy preference, and must win over any stale PENDING action a
     * scheduler run might otherwise pick up after a late webhook recovered
     * the case out from under it.
     */
    if (recoveryCase.outcome || recoveryCase.status === 'RECOVERED') {
      return {
        decision: PolicyAction.BLOCK,
        policyId: 'ALREADY_RECOVERED',
        reason: 'This case already has a verified recovery outcome.',
      };
    }

    /*
     * STOPPED/EXHAUSTED are terminal — never eligible again. ESCALATED is
     * deliberately excluded here: it means "paused pending human review,"
     * and a human's approval (checked just below) is exactly the mechanism
     * that un-pauses it — blocking it here would make approval impossible.
     */
    if (
      recoveryCase.status === 'STOPPED' ||
      recoveryCase.status === 'EXHAUSTED'
    ) {
      return {
        decision: PolicyAction.BLOCK,
        policyId: 'CASE_NOT_ACTIVE',
        reason: `Case is ${recoveryCase.status.toLowerCase()}; no further automatic action.`,
      };
    }

    const amount = recoveryCase.payment
      ? Number(recoveryCase.payment.amount)
      : Number(recoveryCase.revenueAtRisk);

    /*
     * How many times this action type has actually been attempted for this
     * case before (not just requested) — the same real signal drives both
     * the retry-count limit and the contact-channel cap, since for a
     * retry-style action they're the same underlying fact.
     */
    const pastAttempts = await this.prisma.recoveryAction.findMany({
      where: {
        recoveryCaseId,
        type: actionType as RecoveryActionType,
        status: { in: ['EXECUTING', 'SUCCESS', 'FAILED'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { attemptedAt: true },
    });

    const attemptCount = pastAttempts.length;
    const lastAttemptedAt = pastAttempts[0]?.attemptedAt ?? null;

    /*
     * An action a human has already approved must not be re-evaluated —
     * the approval endpoint (RecoveryService.approveAction) already set
     * policyDecision to ALLOW on it. Re-running the raw limit checks here
     * would just recompute REQUIRE_APPROVAL again and strand the case.
     */
    const approvedAction = await this.prisma.recoveryAction.findFirst({
      where: {
        recoveryCaseId,
        type: actionType as RecoveryActionType,
        status: 'APPROVED',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (approvedAction) {
      return {
        decision: PolicyAction.ALLOW,
        policyId: 'HUMAN_APPROVED',
        reason: 'Manually approved by a merchant user.',
      };
    }

    const result = await this.check(
      recoveryCase.merchantId,
      actionType as RecoveryActionType,
      amount,
      attemptCount,
      attemptCount,
      lastAttemptedAt,
    );

    const action = await this.prisma.recoveryAction.findFirst({
      where: {
        recoveryCaseId,
        type: actionType as RecoveryActionType,
        status: 'PENDING',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (action) {
      await this.prisma.recoveryAction.update({
        where: {
          id: action.id,
        },
        data: {
          policyDecision: result.decision,
        },
      });
    }

    await this.auditService.record({
      merchantId: recoveryCase.merchantId,
      recoveryCaseId,
      action: 'POLICY_EVALUATED',
      actorType: 'AGENT',
      details: {
        actionType,
        decision: result.decision,
        policyId: result.policyId,
        reason: result.reason,
        attemptsUsed: result.attemptsUsed ?? null,
        attemptsLimit: result.attemptsLimit ?? null,
      },
    });

    return result;
  }
}
