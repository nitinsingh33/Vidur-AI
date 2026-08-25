import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RiskService } from '../risk/risk.service';
import { RecoveryQueueService } from '../recovery-queue/recovery-queue.service';
import { AuditService } from '../audit/audit.service';
import {
  ACTIVE_RECOVERY_CASE_STATUSES,
  TERMINAL_RECOVERY_CASE_STATUSES,
} from '../recovery/recovery-case-status.util';
import { RecoveryCaseStatus } from '../generated/prisma/enums';

const RUNNABLE_CASE_STATUSES: RecoveryCaseStatus[] = [
  RecoveryCaseStatus.OPEN,
  RecoveryCaseStatus.ELIGIBLE,
];

@Injectable()
export class RecoveryBatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly riskService: RiskService,
    private readonly recoveryQueueService: RecoveryQueueService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Scans across all three revenue-loss scenarios for one merchant and opens
   * a RecoveryCase for each eligible candidate found, up to limitPerType per
   * scenario. Detection itself reuses RiskService — this only groups the
   * results under one batch so they can be run and measured together.
   */
  async detectBatch(input: { merchantId: string; limitPerType?: number }) {
    const limitPerType = Math.min(input.limitPerType ?? 10, 50);
    const merchantId = input.merchantId;

    const [failedPayments, abandonedOrders, overdueInvoices] =
      await Promise.all([
        this.prisma.payment.findMany({
          where: {
            merchantId,
            status: 'FAILED',
            recoveryCases: {
              none: { status: { in: ACTIVE_RECOVERY_CASE_STATUSES } },
            },
          },
          take: limitPerType,
          select: { id: true },
        }),

        this.prisma.order.findMany({
          where: {
            merchantId,
            payments: { none: {} },
            recoveryCases: {
              none: { status: { in: ACTIVE_RECOVERY_CASE_STATUSES } },
            },
          },
          take: limitPerType,
          select: { id: true },
        }),

        this.prisma.invoice.findMany({
          where: {
            merchantId,
            status: 'OVERDUE',
            recoveryCases: {
              none: { status: { in: ACTIVE_RECOVERY_CASE_STATUSES } },
            },
          },
          take: limitPerType,
          select: { id: true },
        }),
      ]);

    const caseIds: string[] = [];

    for (const payment of failedPayments) {
      const recoveryCase = await this.riskService.assessPayment(payment.id);
      caseIds.push(recoveryCase.id);
    }

    for (const order of abandonedOrders) {
      const recoveryCase = await this.riskService.assessOrderAbandonment(
        order.id,
      );
      caseIds.push(recoveryCase.id);
    }

    for (const invoice of overdueInvoices) {
      const recoveryCase = await this.riskService.assessInvoiceOverdue(
        invoice.id,
      );
      caseIds.push(recoveryCase.id);
    }

    const uniqueCaseIds = [...new Set(caseIds)];

    const batch = await this.prisma.recoveryBatch.create({
      data: {
        merchantId,
        totalCases: uniqueCaseIds.length,
      },
    });

    // Only claim cases that aren't already tracked by an earlier batch.
    await this.prisma.recoveryCase.updateMany({
      where: { id: { in: uniqueCaseIds }, batchId: null },
      data: { batchId: batch.id },
    });

    await this.auditService.record({
      merchantId,
      action: 'RECOVERY_BATCH_DETECTED',
      actorType: 'SYSTEM',
      details: {
        batchId: batch.id,
        totalCases: uniqueCaseIds.length,
        failedPayments: failedPayments.length,
        abandonedOrders: abandonedOrders.length,
        overdueInvoices: overdueInvoices.length,
      },
    });

    return this.getBatchStatus(batch.id);
  }

  /** Enqueues one bounded agent run per still-eligible case in the batch. */
  async runBatch(batchId: string) {
    const batch = await this.prisma.recoveryBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new NotFoundException(`Recovery batch ${batchId} not found.`);
    }

    const runnableCases = await this.prisma.recoveryCase.findMany({
      where: { batchId, status: { in: RUNNABLE_CASE_STATUSES } },
      select: { id: true },
    });

    for (const recoveryCase of runnableCases) {
      await this.recoveryQueueService.addRecoveryJob(recoveryCase.id);
    }

    await this.prisma.recoveryBatch.update({
      where: { id: batchId },
      data: {
        status: 'RUNNING',
        startedAt: batch.startedAt ?? new Date(),
      },
    });

    await this.auditService.record({
      merchantId: batch.merchantId,
      action: 'RECOVERY_BATCH_RUN_STARTED',
      actorType: 'SYSTEM',
      details: { batchId, enqueuedCount: runnableCases.length },
    });

    return { batchId, enqueuedCount: runnableCases.length };
  }

  /**
   * Computes batch progress live from the cases themselves rather than
   * maintaining running counters — there's one source of truth (the cases'
   * actual statuses), so this can never drift out of sync with reality.
   */
  async getBatchStatus(batchId: string) {
    const batch = await this.prisma.recoveryBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new NotFoundException(`Recovery batch ${batchId} not found.`);
    }

    /*
     * revenueAtRisk here is the actual exposure (the underlying payment /
     * order / invoice amount) — not RecoveryCase.revenueAtRisk, which is
     * the risk engine's probability-discounted expected loss. Recovered
     * amounts are always the full exposure, so using the discounted figure
     * as the denominator against it produced recovery rates over 100%.
     */
    const cases = await this.prisma.recoveryCase.findMany({
      where: { batchId },
      select: {
        status: true,
        payment: { select: { amount: true } },
        order: { select: { amount: true } },
        invoice: { select: { amount: true } },
      },
    });

    const byStatus: Record<string, number> = {};
    let revenueAtRisk = 0;

    for (const recoveryCase of cases) {
      byStatus[recoveryCase.status] = (byStatus[recoveryCase.status] ?? 0) + 1;

      const exposure =
        recoveryCase.payment?.amount ??
        recoveryCase.order?.amount ??
        recoveryCase.invoice?.amount ??
        0;

      revenueAtRisk += Number(exposure);
    }

    const recoveredAgg = await this.prisma.recoveryOutcome.aggregate({
      where: { successful: true, recoveryCase: { batchId } },
      _sum: { recoveredAmount: true },
      _count: { _all: true },
    });

    const revenueRecovered = Number(recoveredAgg._sum.recoveredAmount ?? 0);
    const recoveredCases = recoveredAgg._count._all;

    const terminalCount = TERMINAL_RECOVERY_CASE_STATUSES.reduce(
      (sum, status) => sum + (byStatus[status] ?? 0),
      0,
    );

    const isComplete =
      batch.totalCases > 0 && terminalCount >= batch.totalCases;

    let { status, completedAt } = batch;

    if (isComplete && status !== 'COMPLETED') {
      const updated = await this.prisma.recoveryBatch.update({
        where: { id: batchId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      status = updated.status;
      completedAt = updated.completedAt;

      await this.auditService.record({
        merchantId: batch.merchantId,
        action: 'RECOVERY_BATCH_COMPLETED',
        actorType: 'SYSTEM',
        details: {
          batchId,
          totalCases: batch.totalCases,
          recoveredCases,
          revenueAtRisk,
          revenueRecovered,
        },
      });
    }

    return {
      batchId: batch.id,
      merchantId: batch.merchantId,
      status,
      totalCases: batch.totalCases,
      byStatus,
      isComplete,
      recoveredCases,
      revenueAtRisk,
      revenueRecovered,
      recoveryRate:
        revenueAtRisk > 0
          ? Number((revenueRecovered / revenueAtRisk).toFixed(4))
          : 0,
      createdAt: batch.createdAt,
      startedAt: batch.startedAt,
      completedAt,
    };
  }
}
