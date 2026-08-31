import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { RiskService } from '../risk/risk.service';
import { RecoveryAutoOrchestratorService } from '../recovery-auto/recovery-auto-orchestrator.service';

const DEFAULT_INTERVAL_MINUTES = 60;
const MAX_INVOICES_PER_SWEEP = 200;

/**
 * Real overdue-receivable detection: an Invoice created (via manual entry
 * today — see InvoicesService) that's still ISSUED past its dueDate. This
 * is the "detect" step for the B2B Receivables Chaser, structurally
 * identical to CheckoutSweepService for checkout drop-off — same agent
 * loop, different signal.
 */
@Injectable()
export class InvoiceOverdueSweepService implements OnModuleInit {
  private readonly logger = new Logger(InvoiceOverdueSweepService.name);

  /** Resolved lazily via ModuleRef — see RecoveryAutoModule's doc comment. */
  private autoOrchestrator!: RecoveryAutoOrchestratorService;

  constructor(
    @InjectQueue('invoice-overdue-sweep') private readonly sweepQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly riskService: RiskService,
    private readonly moduleRef: ModuleRef,
  ) {}

  private get intervalMinutes() {
    const configured = Number(
      process.env.INVOICE_OVERDUE_SWEEP_INTERVAL_MINUTES,
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
      'invoice-overdue-sweep',
      { every: this.intervalMinutes * 60 * 1000 },
      { name: 'sweep' },
    );

    this.logger.log(
      `Invoice overdue sweep scheduled every ${this.intervalMinutes} minute(s).`,
    );
  }

  /**
   * Flips any ISSUED invoice past its dueDate to OVERDUE, then opens a real
   * RecoveryCase for each via RiskService.assessInvoiceOverdue — detection
   * only, same convention as every other automatic path; the merchant (or
   * a batch run) still decides when to act on it.
   */
  async sweepOnce(merchantId?: string) {
    const staleInvoices = await this.prisma.invoice.findMany({
      where: {
        ...(merchantId ? { merchantId } : {}),
        status: 'ISSUED',
        dueDate: { lt: new Date() },
      },
      take: MAX_INVOICES_PER_SWEEP,
      select: { id: true },
    });

    if (staleInvoices.length > 0) {
      await this.prisma.invoice.updateMany({
        where: { id: { in: staleInvoices.map((invoice) => invoice.id) } },
        data: { status: 'OVERDUE' },
      });
    }

    const caseIds: string[] = [];

    for (const invoice of staleInvoices) {
      const recoveryCase = await this.riskService.assessInvoiceOverdue(
        invoice.id,
      );
      caseIds.push(recoveryCase.id);
      void this.autoOrchestrator.runAutomaticRecovery(recoveryCase.id);
    }

    if (staleInvoices.length > 0) {
      this.logger.log(
        `Invoice sweep: ${staleInvoices.length} invoice(s) turned overdue, opened ${caseIds.length} new case(s).`,
      );
    }

    return {
      scanned: staleInvoices.length,
      opened: caseIds.length,
      caseIds,
    };
  }
}
