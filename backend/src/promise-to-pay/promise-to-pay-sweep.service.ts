import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ModuleRef } from '@nestjs/core';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RecoveryAutoOrchestratorService } from '../recovery-auto/recovery-auto-orchestrator.service';
import { runWithConcurrency } from '../recovery-auto/concurrency.util';
import { RecoveryCaseStatus } from '../generated/prisma/enums';

const DEFAULT_INTERVAL_MINUTES = 15;
const MAX_PROMISES_PER_SWEEP = 200;
const AUTO_RECOVERY_CONCURRENCY = 3;

/**
 * A case in one of these statuses is still being actively worked by the
 * automatic pipeline — safe to hand a missed promise straight back into
 * runAutomaticRecovery. ESCALATED is deliberately excluded: it means
 * "paused pending human review," and a missed promise should not silently
 * resume automatic action on a case a human is meant to look at first.
 * STOPPED/EXHAUSTED/RECOVERED are terminal — nothing more happens to them.
 */
const RESUMABLE_CASE_STATUSES: RecoveryCaseStatus[] = [
  RecoveryCaseStatus.OPEN,
  RecoveryCaseStatus.ELIGIBLE,
  RecoveryCaseStatus.IN_PROGRESS,
];

/**
 * The one and only place that decides whether a promise was KEPT or MISSED —
 * and it never trusts the promise itself. On/after the promised date, it
 * reads the linked RecoveryCase's own status/outcome, the same real
 * webhook- or markPaid-derived ground truth every other recovery path in
 * this system already relies on. A missed promise is hosted back into the
 * exact same Detection -> Strategy -> Policy -> Action -> Observe pipeline
 * via RecoveryAutoOrchestratorService — no parallel recovery engine.
 */
@Injectable()
export class PromiseToPaySweepService implements OnModuleInit {
  private readonly logger = new Logger(PromiseToPaySweepService.name);

  /** Resolved lazily via ModuleRef — see RecoveryAutoModule's doc comment. */
  private autoOrchestrator!: RecoveryAutoOrchestratorService;

  constructor(
    @InjectQueue('promise-to-pay-sweep') private readonly sweepQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly moduleRef: ModuleRef,
  ) {}

  private get intervalMinutes() {
    const configured = Number(
      process.env.PROMISE_TO_PAY_SWEEP_INTERVAL_MINUTES,
    );
    return Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_INTERVAL_MINUTES;
  }

  async onModuleInit() {
    this.autoOrchestrator = this.moduleRef.get(
      RecoveryAutoOrchestratorService,
      { strict: false },
    );

    await this.sweepQueue.upsertJobScheduler(
      'promise-to-pay-sweep',
      { every: this.intervalMinutes * 60 * 1000 },
      { name: 'sweep' },
    );

    this.logger.log(
      `Promise-to-Pay verification sweep scheduled every ${this.intervalMinutes} minute(s).`,
    );
  }

  async sweepOnce(merchantId?: string) {
    const duePromises = await this.prisma.promiseToPay.findMany({
      where: {
        ...(merchantId ? { merchantId } : {}),
        status: 'PENDING',
        promisedDate: { lte: new Date() },
      },
      include: {
        recoveryCase: { include: { outcome: true } },
      },
      take: MAX_PROMISES_PER_SWEEP,
    });

    let kept = 0;
    let missed = 0;
    const resumeCaseIds: string[] = [];

    for (const promise of duePromises) {
      const recoveryCase = promise.recoveryCase;

      /*
       * Never trust the promise as proof of payment — the real signal is
       * the recovery case's own status/outcome, which only a real Razorpay
       * webhook or the merchant's own "Mark Paid" attestation can set (see
       * RazorpayWebhookService / InvoicesService.markPaid). This never
       * fabricates or independently recomputes recoveredAmount — it's
       * copied verbatim from the RecoveryOutcome the real payment already
       * verified.
       */
      const isRecovered =
        recoveryCase.status === 'RECOVERED' && !!recoveryCase.outcome;

      if (isRecovered) {
        const claim = await this.prisma.promiseToPay.updateMany({
          where: { id: promise.id, status: 'PENDING' },
          data: {
            status: 'KEPT',
            resolvedAt: new Date(),
            recoveredAmount: recoveryCase.outcome!.recoveredAmount,
          },
        });

        // Guards against double-processing if the sweep is ever invoked
        // concurrently — only the run that actually flips PENDING->KEPT acts.
        if (claim.count !== 1) {
          continue;
        }

        kept += 1;

        await this.auditService.record({
          merchantId: promise.merchantId,
          recoveryCaseId: promise.recoveryCaseId,
          action: 'PROMISE_TO_PAY_KEPT',
          actorType: 'SYSTEM',
          details: {
            promiseId: promise.id,
            recoveredAmount: Number(recoveryCase.outcome!.recoveredAmount),
          },
        });

        continue;
      }

      const claim = await this.prisma.promiseToPay.updateMany({
        where: { id: promise.id, status: 'PENDING' },
        data: { status: 'MISSED', resolvedAt: new Date() },
      });

      if (claim.count !== 1) {
        continue;
      }

      missed += 1;

      await this.auditService.record({
        merchantId: promise.merchantId,
        recoveryCaseId: promise.recoveryCaseId,
        action: 'PROMISE_TO_PAY_MISSED',
        actorType: 'SYSTEM',
        details: {
          promiseId: promise.id,
          promisedAmount: Number(promise.promisedAmount),
        },
      });

      /*
       * Hand the case straight back into the real, unmodified automatic
       * pipeline — createStrategyForCase / checkForRecoveryCase / execute /
       * observe already bound retries via Policy.maxRetries and converge to
       * EXHAUSTED, so this can never retry indefinitely. escalateOnRequireApproval
       * stays at its default (true): a missed promise is a fresh, real signal
       * worth surfacing immediately if policy requires approval, not routine
       * background noise.
       */
      if (RESUMABLE_CASE_STATUSES.includes(recoveryCase.status)) {
        resumeCaseIds.push(recoveryCase.id);
      }
    }

    // Fire-and-forget from sweepOnce's perspective (unchanged timing
    // contract), but internally bounded so a sweep with many missed
    // promises can't burst dozens of concurrent /diagnose calls at Gemini —
    // see concurrency.util.ts.
    void runWithConcurrency(
      resumeCaseIds,
      AUTO_RECOVERY_CONCURRENCY,
      (caseId) => this.autoOrchestrator.runAutomaticRecovery(caseId),
    );

    if (duePromises.length > 0) {
      this.logger.log(
        `Promise-to-Pay sweep: ${duePromises.length} promise(s) due, ${kept} kept, ${missed} missed.`,
      );
    }

    return { scanned: duePromises.length, kept, missed };
  }
}
