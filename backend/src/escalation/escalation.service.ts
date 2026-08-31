import { Injectable, NotFoundException } from '@nestjs/common';

import {
  RecoveryActionStatus,
  RecoveryCaseStatus,
} from '../generated/prisma/enums';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class EscalationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async escalateRecoveryCase(recoveryCaseId: string, reason: string) {
    const recoveryCase = await this.prisma.recoveryCase.findUnique({
      where: {
        id: recoveryCaseId,
      },
      include: {
        actions: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!recoveryCase) {
      throw new NotFoundException(`Recovery case ${recoveryCaseId} not found.`);
    }

    const action = await this.prisma.recoveryAction.create({
      data: {
        recoveryCaseId,
        type: 'ESCALATE_HUMAN',
        status: RecoveryActionStatus.SUCCESS,
        reason,
        result: {
          escalated: true,
          message: 'Recovery case escalated to human review.',
        },
        completedAt: new Date(),
      },
    });

    await this.prisma.recoveryCase.update({
      where: {
        id: recoveryCaseId,
      },
      data: {
        status: RecoveryCaseStatus.ESCALATED,
      },
    });

    await this.auditService.record({
      merchantId: recoveryCase.merchantId,
      recoveryCaseId,
      action: 'RECOVERY_ESCALATED',
      actorType: 'AGENT',
      details: {
        reason,
        actionId: action.id,
      },
    });

    return {
      successful: true,
      recoveryCaseId,
      actionId: action.id,
      status: RecoveryCaseStatus.ESCALATED,
      reason,
    };
  }
}
