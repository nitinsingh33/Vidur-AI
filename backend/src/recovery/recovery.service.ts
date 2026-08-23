// RecoveryService is Database Orchestration

import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RecoveryActionStatus } from '../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { RecoveryStrategyService } from './recovery-strategy.service';

@Injectable()
export class RecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly strategyService: RecoveryStrategyService,
  ) {}

  async createStrategyForCase(recoveryCaseId: string) {
    const recoveryCase =
      await this.prisma.recoveryCase.findUnique({
        where: {
          id: recoveryCaseId,
        },
      });

    if (!recoveryCase) {
      throw new NotFoundException(
        `Recovery case ${recoveryCaseId} not found.`,
      );
    }

    const strategy = this.strategyService.determine(
      recoveryCase.rootCause,
    );

    const existingAction = 
      await this.prisma.recoveryAction.findFirst({
        where: {
            recoveryCaseId: recoveryCase.id,
            type: strategy.actionType,
            status: {
                in: [
                  'PENDING',
                  'APPROVED',
                  'EXECUTING',
                ],
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
      });

    if (existingAction) {
      return existingAction;
    }

    return this.prisma.recoveryAction.create({
        data: {
            recoveryCaseId: recoveryCase.id,
            type: strategy.actionType,
            status: 'PENDING',
            reason: strategy.reason,
        },
    });
  }
}