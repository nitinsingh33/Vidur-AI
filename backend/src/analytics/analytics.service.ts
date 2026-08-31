import { Injectable } from '@nestjs/common';
import { RecoveryCaseStatus } from '../generated/prisma/enums';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface DailyPaymentHealthRow {
  day: Date;
  captured: bigint;
  failed: bigint;
}

interface FailureReasonRow {
  failureReason: string | null;
  count: bigint;
}

interface MethodHealthRow {
  method: string;
  captured: bigint;
  failed: bigint;
}

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

    const [activeRecoveryCases, agentActions, failedActions, escalations] =
      await Promise.all([
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

  /**
   * Real payment-degradation analytics, computed entirely from Payment
   * history — daily success-rate trend, root-cause breakdown, per-method
   * health, and a baseline (previous window) vs current comparison. No
   * hardcoded percentages or predefined incidents: an empty/healthy
   * merchant genuinely gets back empty/100% numbers.
   */
  async getPaymentHealth(merchantId: string, days = 30) {
    const windowStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const previousWindowStart = new Date(
      windowStart.getTime() - days * 24 * 60 * 60 * 1000,
    );

    const [dailyRows, reasonRows, methodRows, currentWindow, previousWindow] =
      await Promise.all([
        this.prisma.$queryRaw<DailyPaymentHealthRow[]>(Prisma.sql`
          SELECT
            date_trunc('day', "createdAt") AS day,
            COUNT(*) FILTER (WHERE status = 'CAPTURED') AS captured,
            COUNT(*) FILTER (WHERE status = 'FAILED') AS failed
          FROM "Payment"
          WHERE "merchantId" = ${merchantId}
            AND "createdAt" >= ${windowStart}
            AND status IN ('CAPTURED', 'FAILED')
          GROUP BY day
          ORDER BY day ASC
        `),

        this.prisma.$queryRaw<FailureReasonRow[]>(Prisma.sql`
          SELECT "failureReason", COUNT(*) AS count
          FROM "Payment"
          WHERE "merchantId" = ${merchantId}
            AND status = 'FAILED'
            AND "createdAt" >= ${windowStart}
          GROUP BY "failureReason"
          ORDER BY count DESC
          LIMIT 10
        `),

        this.prisma.$queryRaw<MethodHealthRow[]>(Prisma.sql`
          SELECT
            method::text AS method,
            COUNT(*) FILTER (WHERE status = 'CAPTURED') AS captured,
            COUNT(*) FILTER (WHERE status = 'FAILED') AS failed
          FROM "Payment"
          WHERE "merchantId" = ${merchantId}
            AND "createdAt" >= ${windowStart}
            AND status IN ('CAPTURED', 'FAILED')
          GROUP BY method
          ORDER BY COUNT(*) DESC
        `),

        this.prisma.payment.groupBy({
          by: ['status'],
          where: {
            merchantId,
            createdAt: { gte: windowStart },
            status: { in: ['CAPTURED', 'FAILED'] },
          },
          _count: { id: true },
        }),

        this.prisma.payment.groupBy({
          by: ['status'],
          where: {
            merchantId,
            createdAt: { gte: previousWindowStart, lt: windowStart },
            status: { in: ['CAPTURED', 'FAILED'] },
          },
          _count: { id: true },
        }),
      ]);

    const successRateOf = (rows: { status: string; _count: { id: number } }[]) => {
      const captured =
        rows.find((row) => row.status === 'CAPTURED')?._count.id ?? 0;
      const failed = rows.find((row) => row.status === 'FAILED')?._count.id ?? 0;
      const total = captured + failed;
      return total === 0 ? null : captured / total;
    };

    return {
      windowDays: days,
      daily: dailyRows.map((row) => {
        const captured = Number(row.captured);
        const failed = Number(row.failed);
        const total = captured + failed;
        return {
          date: row.day.toISOString().slice(0, 10),
          captured,
          failed,
          successRate: total === 0 ? null : captured / total,
        };
      }),
      failureReasons: reasonRows.map((row) => ({
        reason: row.failureReason ?? 'unknown',
        count: Number(row.count),
      })),
      byMethod: methodRows.map((row) => {
        const captured = Number(row.captured);
        const failed = Number(row.failed);
        const total = captured + failed;
        return {
          method: row.method,
          captured,
          failed,
          successRate: total === 0 ? null : captured / total,
        };
      }),
      currentWindowSuccessRate: successRateOf(currentWindow),
      previousWindowSuccessRate: successRateOf(previousWindow),
    };
  }

  /**
   * Real recovery-pipeline funnel — a count of RecoveryCase rows at each
   * stage, computed live from the database. "Detected" is every case ever
   * opened (not just currently-active ones), so the funnel reads as a
   * cumulative pipeline rather than a snapshot.
   */
  async getRecoveryFunnel(merchantId: string) {
    const [detected, inProgress, escalated, recovered, exhausted] =
      await Promise.all([
        this.prisma.recoveryCase.count({ where: { merchantId } }),
        this.prisma.recoveryCase.count({
          where: { merchantId, status: RecoveryCaseStatus.IN_PROGRESS },
        }),
        this.prisma.recoveryCase.count({
          where: { merchantId, status: RecoveryCaseStatus.ESCALATED },
        }),
        this.prisma.recoveryCase.count({
          where: { merchantId, status: RecoveryCaseStatus.RECOVERED },
        }),
        this.prisma.recoveryCase.count({
          where: { merchantId, status: RecoveryCaseStatus.EXHAUSTED },
        }),
      ]);

    return { detected, inProgress, escalated, recovered, exhausted };
  }
}
