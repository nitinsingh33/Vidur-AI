import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { RiskService } from '../risk/risk.service';
import { RecoveryAutoOrchestratorService } from '../recovery-auto/recovery-auto-orchestrator.service';
import { ACTIVE_RECOVERY_CASE_STATUSES } from '../recovery/recovery-case-status.util';
import {
  getCheckoutAbandonmentCutoff,
  getCheckoutAbandonmentGraceMinutes,
} from '../risk/checkout-abandonment.util';

const DEFAULT_INTERVAL_MINUTES = 5;
const MAX_ORDERS_PER_SWEEP = 200;

/**
 * Real checkout-drop-off detection: a genuine Order row created via
 * /razorpay/checkout that's still unpaid after a grace period. This is the
 * "customer abandons" half of Scenario 2 — the payment side (customer
 * fails a payment attempt) is already covered by the payment.failed
 * webhook; this covers the case where the customer never attempted one at
 * all.
 *
 * Detection only, same as every other automatic path (payment.failed
 * webhook, overdue-invoice checks) — this opens a RecoveryCase but does not
 * itself enqueue the agent. The merchant (or a batch run) decides when to
 * act on it.
 */
@Injectable()
export class CheckoutSweepService implements OnModuleInit {
  private readonly logger = new Logger(CheckoutSweepService.name);

  /** Resolved lazily via ModuleRef — see RecoveryAutoModule's doc comment. */
  private autoOrchestrator!: RecoveryAutoOrchestratorService;

  constructor(
    @InjectQueue('checkout-sweep') private readonly sweepQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly riskService: RiskService,
    private readonly moduleRef: ModuleRef,
  ) {}

  private get intervalMinutes() {
    const configured = Number(process.env.CHECKOUT_SWEEP_INTERVAL_MINUTES);
    return Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_INTERVAL_MINUTES;
  }

  async onModuleInit() {
    this.autoOrchestrator = this.moduleRef.get(
      RecoveryAutoOrchestratorService,
      { strict: false },
    );

    // upsertJobScheduler is keyed by jobSchedulerId, so calling this again
    // on every boot with the same id is idempotent — it updates the
    // existing scheduler rather than creating a duplicate.
    await this.sweepQueue.upsertJobScheduler(
      'checkout-abandonment-sweep',
      { every: this.intervalMinutes * 60 * 1000 },
      { name: 'sweep' },
    );

    this.logger.log(
      `Checkout abandonment sweep scheduled every ${this.intervalMinutes} minute(s), ` +
        `grace period ${getCheckoutAbandonmentGraceMinutes()} minute(s).`,
    );
  }

  /**
   * Scans for stale unpaid orders and opens a real RecoveryCase for each,
   * via the same RiskService.assessOrderAbandonment path as the manual
   * endpoint. Pass merchantId to scope a manual/on-demand run (e.g. a
   * "Run sweep now" button); omit it for the global scheduled sweep across
   * every merchant.
   */
  async sweepOnce(merchantId?: string) {
    const staleOrders = await this.prisma.order.findMany({
      where: {
        ...(merchantId ? { merchantId } : {}),
        status: 'CREATED',
        payments: { none: {} },
        recoveryCases: {
          none: { status: { in: ACTIVE_RECOVERY_CASE_STATUSES } },
        },
        OR: [
          { createdAt: { lte: getCheckoutAbandonmentCutoff() } },
          // A real browser tab-close/hide signal from the checkout page
          // (see StorefrontService.recordAbandonSignal) fast-tracks
          // detection instead of waiting out the full grace period.
          { abandonSignalAt: { not: null } },
        ],
      },
      take: MAX_ORDERS_PER_SWEEP,
      select: { id: true },
    });

    const caseIds: string[] = [];

    for (const order of staleOrders) {
      const recoveryCase = await this.riskService.assessOrderAbandonment(
        order.id,
      );
      caseIds.push(recoveryCase.id);
      void this.autoOrchestrator.runAutomaticRecovery(recoveryCase.id);
    }

    if (staleOrders.length > 0) {
      this.logger.log(
        `Checkout sweep: scanned ${staleOrders.length} stale order(s), opened ${caseIds.length} new case(s).`,
      );
    }

    return {
      scanned: staleOrders.length,
      opened: caseIds.length,
      caseIds,
    };
  }
}
