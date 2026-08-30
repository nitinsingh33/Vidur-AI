import { Module } from '@nestjs/common';

/**
 * Placeholder — the real Invoice lifecycle service (create/issue/mark
 * overdue) lands in the B2B Receivables Chaser phase. The synthetic
 * fake-outcome mutator that used to live here has been removed; invoice
 * recovery now goes through RecoveryService's real Razorpay Payment Link
 * mechanism, same as every other channel.
 */
@Module({})
export class InvoicesModule {}
