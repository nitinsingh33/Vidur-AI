import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { RecoveryService } from '../recovery/recovery.service';
import { PolicyService } from '../policy/policy.service';
import { ACTIVE_RECOVERY_CASE_STATUSES } from '../recovery/recovery-case-status.util';

const DEFAULT_INTERVAL_MINUTES = 30;
const MAX_CASES_PER_SWEEP = 200;

/**
 * The actual "sequencer": unlike Subscriptions, Razorpay does not auto-retry
 * a failed mandate (UPI Autopay/eNACH) debit on its own — the merchant
 * decides when to re-present it. This scheduled sweep is that decision,
 * made automatically instead of requiring a human to click "execute" for
 * every re-presentment.
 *
 * This service makes NO independent decision about retry count or timing —
 * it only finds hard-eligible candidates (case still open, mandate still
 * confirmed) and then defers entirely to PolicyService.checkForRecoveryCase,
 * the exact same call a manual "Execute" click goes through. Whether a given
 * case actually gets retried right now, needs approval, or is blocked is
 * decided by the merchant's own Policy row (Policies page: max retries,
 * retry interval, max amount, enabled/disabled) — never by a constant here.
 */
@Injectable()
export class MandateRetrySequencerService implements OnModuleInit {
  private readonly logger = new Logger(MandateRetrySequencerService.name);

  constructor(
    @InjectQueue('mandate-retry-sequencer') private readonly sweepQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly recoveryService: RecoveryService,
    private readonly policyService: PolicyService,
  ) {}

  private get intervalMinutes() {
    const configured = Number(
      process.env.MANDATE_RETRY_SEQUENCER_INTERVAL_MINUTES,
    );
    return Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_INTERVAL_MINUTES;
  }

  async onModuleInit() {
    await this.sweepQueue.upsertJobScheduler(
      'mandate-retry-sequencer-sweep',
      { every: this.intervalMinutes * 60 * 1000 },
      { name: 'sweep' },
    );

    this.logger.log(
      `Mandate retry sequencer scheduled every ${this.intervalMinutes} minute(s). ` +
        `Retry count/timing/amount are decided per-merchant by Policy (see the Policies page), not by this service.`,
    );
  }

  /**
   * Finds active cases whose failed payment came from a mandate-backed
   * debit where the mandate is still confirmed (a hard fact — a paused,
   * rejected, or cancelled mandate is never a candidate, regardless of
   * policy), then drives the same strategy -> policy -> execute pipeline a
   * human would otherwise click through manually. Retry-count, timing, and
   * amount eligibility are entirely PolicyService's call.
   */
  async sweepOnce(merchantId?: string) {
    const eligibleCases = await this.prisma.recoveryCase.findMany({
      where: {
        ...(merchantId ? { merchantId } : {}),
        status: { in: ACTIVE_RECOVERY_CASE_STATUSES },
        outcome: null,
        payment: {
          order: {
            mandateId: { not: null },
            mandate: { status: 'CONFIRMED' },
          },
        },
      },
      take: MAX_CASES_PER_SWEEP,
      select: { id: true },
    });

    let attempted = 0;
    let skipped = 0;

    for (const { id: caseId } of eligibleCases) {
      try {
        await this.recoveryService.createStrategyForCase(caseId);

        const policyResult = await this.policyService.checkForRecoveryCase(
          caseId,
          'RETRY_PAYMENT',
        );

        if (policyResult.decision !== 'ALLOW') {
          skipped++;
          this.logger.log(
            `Mandate retry sequencer: case ${caseId} not eligible yet (${policyResult.decision}): ${policyResult.reason}`,
          );
          continue;
        }
      } catch (error) {
        skipped++;
        this.logger.warn(
          `Mandate retry sequencer: skipped case ${caseId}: ${
            error instanceof Error ? error.message : error
          }`,
        );
        continue;
      }

      /*
       * From here on, a real retry attempt was made — executeRecoveryAction
       * re-throws after marking the action FAILED so its own callers see
       * the real error, but from the sequencer's perspective that's still
       * "attempted," not "skipped": the re-presentment happened and is
       * correctly recorded, it just didn't recover the money this time.
       */
      attempted++;

      try {
        await this.recoveryService.executeRecoveryAction(caseId);
      } catch (error) {
        this.logger.warn(
          `Mandate retry sequencer: attempt failed for case ${caseId}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }

    if (eligibleCases.length > 0) {
      this.logger.log(
        `Mandate retry sequencer: scanned ${eligibleCases.length} eligible case(s), ` +
          `attempted ${attempted}, skipped ${skipped}.`,
      );
    }

    return {
      scanned: eligibleCases.length,
      attempted,
      skipped,
    };
  }
}
