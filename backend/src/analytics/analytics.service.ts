import { Injectable } from '@nestjs/common';
import { RecoveryCaseStatus } from '../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRevenueAtRisk(merchantId?: string) {
    const activeStatuses: RecoveryCaseStatus[] = [
      RecoveryCaseStatus.OPEN,
      RecoveryCaseStatus.ELIGIBLE,
      RecoveryCaseStatus.IN_PROGRESS,
      RecoveryCaseStatus.ESCALATED,
    ];

    const result = await this.prisma.recoveryCase.aggregate({
      where: {
        ...(merchantId && { merchantId }),
        status: {
          in: activeStatuses,
        },
      },
      _sum: {
        revenueAtRisk: true,
      },
      _count: {
        id: true,
      },
    });

    return {
      revenueAtRisk: result._sum.revenueAtRisk?.toString() ?? '0.00',
      currency: 'INR',
      recoveryCases: result._count.id,
    };
  }

  async getRevenueRecovered(merchantId?: string) {
    const result = await this.prisma.recoveryOutcome.aggregate({
      where: {
        successful: true,
        ...(merchantId && {
          recoveryCase: {
            merchantId,
          },
        }),
      },
      _sum: {
        recoveredAmount: true,
      },
      _count: {
        id: true,
      },
    });

    return {
      revenueRecovered: result._sum.recoveredAmount?.toString() ?? '0.00',
      currency: 'INR',
      successfulRecoveries: result._count.id,
    };
  }

  async getSummary(merchantId?: string) {
    const activeStatuses: RecoveryCaseStatus[] = [
      RecoveryCaseStatus.OPEN,
      RecoveryCaseStatus.ELIGIBLE,
      RecoveryCaseStatus.IN_PROGRESS,
      RecoveryCaseStatus.ESCALATED,
    ];

    const [
      activeRecoveryCases,
      agentActions,
      failedActions,
      escalations,
    ] = await Promise.all([
      this.prisma.recoveryCase.count({
        where: {
          ...(merchantId && { merchantId }),
          status: {
            in: activeStatuses,
          },
        },
      }),

      this.prisma.recoveryAction.count({
        where: {
          ...(merchantId && {
            recoveryCase: {
              merchantId,
            },
          }),
        },
      }),

      this.prisma.recoveryAction.count({
        where: {
          status: 'FAILED',
          ...(merchantId && {
            recoveryCase: {
              merchantId,
            },
          }),
        },
      }),

      this.prisma.recoveryCase.count({
        where: {
          status: RecoveryCaseStatus.ESCALATED,
          ...(merchantId && { merchantId }),
        },
      }),
    ]);

    return {
      activeRecoveryCases,
      agentActions,
      failedActions,
      escalations,
    };
  }

}