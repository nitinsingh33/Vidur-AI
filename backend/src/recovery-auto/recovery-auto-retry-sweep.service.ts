import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { RecoveryAutoOrchestratorService } from './recovery-auto-orchestrator.service';

const DEFAULT_INTERVAL_MINUTES = 10;

/**
 * Makes a *second* (and third, etc.) automatic recovery attempt possible
 * without a merchant click — e.g. a payment link the customer hasn't paid
 * yet becomes retry-eligible once the policy's retry interval elapses.
 * Structurally identical to CheckoutSweepService/InvoiceOverdueSweepService:
 * a BullMQ-scheduled sweep, boot-cached interval.
 *
 * escalateOnRequireApproval is false here deliberately — a case that isn't
 * retry-eligible *yet* (the common case on any given sweep tick) should be
 * silently skipped, not escalated; escalating on every sweep cycle until the
 * interval elapses would be noise, not a signal.
 */
@Injectable()
export class RecoveryAutoRetrySweepService implements OnModuleInit {
  private readonly logger = new Logger(RecoveryAutoRetrySweepService.name);

  constructor(
    @InjectQueue('recovery-auto-retry') private readonly sweepQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly orchestrator: RecoveryAutoOrchestratorService,
  ) {}

  private get intervalMinutes() {
    const configured = Number(
      process.env.RECOVERY_AUTO_RETRY_SWEEP_INTERVAL_MINUTES,
    );
    return Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_INTERVAL_MINUTES;
  }

  async onModuleInit() {
    await this.sweepQueue.upsertJobScheduler(
      'recovery-auto-retry-sweep',
      { every: this.intervalMinutes * 60 * 1000 },
      { name: 'sweep' },
    );

    this.logger.log(
      `Automatic recovery retry sweep scheduled every ${this.intervalMinutes} minute(s).`,
    );
  }

  async sweepOnce(merchantId?: string) {
    const candidates = await this.prisma.recoveryCase.findMany({
      where: {
        ...(merchantId ? { merchantId } : {}),
        status: 'IN_PROGRESS',
        outcome: null,
        actions: {
          some: { status: 'FAILED' },
          none: { status: { in: ['PENDING', 'APPROVED', 'EXECUTING'] } },
        },
      },
      select: { id: true },
    });

    for (const candidate of candidates) {
      void this.orchestrator.runAutomaticRecovery(candidate.id, {
        escalateOnRequireApproval: false,
      });
    }

    if (candidates.length > 0) {
      this.logger.log(
        `Automatic retry sweep: found ${candidates.length} retry-eligible case(s).`,
      );
    }

    return { scanned: candidates.length };
  }
}
