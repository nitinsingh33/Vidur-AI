import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus } from '../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';

export interface SyntheticRetryResult {
  paymentId: string;
  successful: boolean;
  previousStatus: PaymentStatus;
  status: PaymentStatus;
  attemptNumber: number;
  recoveredAmount: number;
  reason: string;
}

@Injectable()
export class SyntheticPaymentService {
  constructor(private readonly prisma: PrismaService) {}

  async retry(paymentId: string): Promise<SyntheticRetryResult> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found.`);
    }

    const previousStatus = payment.status;

    if (payment.status === PaymentStatus.CAPTURED) {
      return {
        paymentId: payment.id,
        successful: true,
        previousStatus,
        status: payment.status,
        attemptNumber: payment.attemptNumber,
        recoveredAmount: Number(payment.amount),
        reason: 'Payment is already captured; retry was idempotent.',
      };
    }

    if (payment.status !== PaymentStatus.FAILED) {
      throw new Error(
        `Payment ${paymentId} cannot be retried from status ${payment.status}.`,
      );
    }

    const nextAttemptNumber = payment.attemptNumber + 1;

    const successful =
      payment.failureReason === 'INSUFFICIENT_FUNDS' ||
      payment.failureReason === 'NETWORK_ERROR';

    return this.prisma.$transaction(async (tx) => {
      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: 'RETRY_STARTED',
          reason: 'Synthetic payment retry execution started.',
          metadata: { attemptNumber: nextAttemptNumber },
        },
      });

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          attemptNumber: nextAttemptNumber,
          ...(successful
            ? {
                status: PaymentStatus.CAPTURED,
                failureReason: null,
              }
            : {
                status: PaymentStatus.FAILED,
              }),
        },
      });

      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: successful ? 'RETRY_SUCCEEDED' : 'RETRY_FAILED',
          reason: successful
            ? 'Synthetic payment retry succeeded.'
            : `Synthetic payment retry failed: ${
                payment.failureReason ?? 'UNKNOWN'
              }.`,
          metadata: {
            attemptNumber: nextAttemptNumber,
            simulated: true,
          },
        },
      });

      if (successful) {
        await tx.paymentEvent.create({
          data: {
            paymentId: payment.id,
            type: 'CAPTURED',
            reason: 'Synthetic payment captured after successful retry.',
            metadata: {
              attemptNumber: nextAttemptNumber,
              simulated: true,
            },
          },
        });

        if (payment.orderId) {
          await tx.order.update({
            where: { id: payment.orderId },
            data: { status: 'PAID' },
          });
        }
      }

      return {
        paymentId: updatedPayment.id,
        successful,
        previousStatus,
        status: updatedPayment.status,
        attemptNumber: updatedPayment.attemptNumber,
        recoveredAmount: successful
          ? Number(updatedPayment.amount)
          : 0,
        reason: successful
          ? 'Synthetic payment retry succeeded.'
          : `Synthetic payment retry failed: ${
              payment.failureReason ?? 'UNKNOWN'
            }.`,
      };
    });
  }
}