import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PolicyAction,
  RecoveryActionType,
} from '../generated/prisma/enums';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface PolicyCheckResult {
  decision: PolicyAction;
  policyId: string;
  reason: string;
}

@Injectable()
export class PolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async check(
    merchantId: string,
    actionType: RecoveryActionType,
    amount: number,
    retryCount: number,
  ): Promise<PolicyCheckResult> {
    const policy =
      await this.prisma.policy.findFirst({
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

    if (
      policy.maxAmount !== null &&
      amount > Number(policy.maxAmount)
    ) {
      return {
        decision: PolicyAction.BLOCK,
        policyId: policy.id,
        reason:
          'Payment amount exceeds the policy limit.',
      };
    }

    if (
      policy.maxRetries !== null &&
      retryCount > policy.maxRetries
    ) {
      return {
        decision: PolicyAction.BLOCK,
        policyId: policy.id,
        reason:
          'Payment retry count exceeds the policy limit.',
      };
    }

    return {
      decision: policy.decision,
      policyId: policy.id,
      reason:
        policy.description ??
        'Policy decision applied.',
    };
  }

  async checkForRecoveryCase(
    recoveryCaseId: string,
    actionType: string,
): Promise<PolicyCheckResult> {
  const recoveryCase =
    await this.prisma.recoveryCase.findUnique({
      where: {
        id: recoveryCaseId,
      },
      include: {
        payment: true,
      },
    });

  if (!recoveryCase) {
    throw new NotFoundException(
      `Recovery case ${recoveryCaseId} not found.`,
    );
  }

  const amount = recoveryCase.payment
    ? Number(recoveryCase.payment.amount)
    : Number(recoveryCase.revenueAtRisk);

  const retryCount =
    recoveryCase.payment?.attemptNumber ?? 0;

  const result = await this.check(
  recoveryCase.merchantId,
  actionType as RecoveryActionType,
  amount,
  retryCount,
);

const action =
  await this.prisma.recoveryAction.findFirst({
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
  },
});

return result;
}
}