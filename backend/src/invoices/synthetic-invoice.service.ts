import { Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, RecoveryActionType } from '../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';

export interface SyntheticInvoiceRecoveryResult {
  invoiceId: string;
  successful: boolean;
  previousStatus: InvoiceStatus;
  status: InvoiceStatus;
  recoveredAmount: number;
  reason: string;
  message: string;
  channel: RecoveryActionType;
}

/**
 * Which recovery channels can actually resolve an overdue invoice.
 * Only a genuine follow-up on the receivable moves it toward payment;
 * payment-specific channels (retry, card update) don't apply here.
 */
const RECOVERY_MATRIX: RecoveryActionType[] = ['FOLLOW_UP_RECEIVABLE'];

@Injectable()
export class SyntheticInvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  async attemptRecovery(
    invoiceId: string,
    channel: RecoveryActionType,
  ): Promise<SyntheticInvoiceRecoveryResult> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found.`);
    }

    const previousStatus = invoice.status;

    if (invoice.status === InvoiceStatus.PAID) {
      return {
        invoiceId: invoice.id,
        successful: true,
        previousStatus,
        status: invoice.status,
        recoveredAmount: Number(invoice.amount),
        reason: 'Invoice is already paid; this action was idempotent.',
        message: 'Invoice is already paid; this action was idempotent.',
        channel,
      };
    }

    if (invoice.status !== InvoiceStatus.OVERDUE) {
      throw new Error(
        `Invoice ${invoiceId} cannot be recovered from status ${invoice.status}.`,
      );
    }

    const successful = RECOVERY_MATRIX.includes(channel);
    const successMessage = 'Receivable follow-up succeeded.';
    const failureMessage = 'Receivable follow-up did not resolve the overdue invoice.';

    const updatedInvoice = await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: successful
        ? { status: InvoiceStatus.PAID, paidAt: new Date() }
        : {},
    });

    return {
      invoiceId: updatedInvoice.id,
      successful,
      previousStatus,
      status: updatedInvoice.status,
      recoveredAmount: successful ? Number(updatedInvoice.amount) : 0,
      reason: successful ? successMessage : failureMessage,
      message: successful ? successMessage : failureMessage,
      channel,
    };
  }
}
