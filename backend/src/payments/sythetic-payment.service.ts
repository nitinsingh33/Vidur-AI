import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, RecoveryActionType } from '../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';

export interface SyntheticRecoveryResult {
  paymentId: string;
  successful: boolean;
  previousStatus: PaymentStatus;
  status: PaymentStatus;
  attemptNumber: number;
  recoveredAmount: number;
  reason: string;
  message: string;
  channel: RecoveryActionType;
}

/**
 * Which recovery channels can actually resolve a given failure reason.
 * A blind retry doesn't fix an expired card; a payment link doesn't fix
 * insufficient funds. This is what makes "the agent picked the right
 * intervention" a real, observable outcome instead of a label.
 */
const RECOVERY_MATRIX: Record<string, RecoveryActionType[]> = {
  INSUFFICIENT_FUNDS: ['RETRY_PAYMENT'],
  NETWORK_ERROR: ['RETRY_PAYMENT'],
  CARD_EXPIRED: ['UPDATE_PAYMENT_METHOD', 'SEND_PAYMENT_LINK'],
  BANK_DECLINED: ['UPDATE_PAYMENT_METHOD', 'SEND_PAYMENT_LINK'],
  LIMIT_EXCEEDED: ['SEND_PAYMENT_LINK'],
};

/** Only a payment link actually resolves a checkout the customer never finished. */
const CHECKOUT_RECOVERY_CHANNELS: RecoveryActionType[] = ['SEND_PAYMENT_LINK'];

const CHANNEL_LABELS: Partial<Record<RecoveryActionType, string>> = {
  RETRY_PAYMENT: 'Payment retry',
  SEND_PAYMENT_LINK: 'Payment link',
  SEND_EMAIL: 'Recovery email',
  SEND_WHATSAPP: 'WhatsApp reminder',
  UPDATE_PAYMENT_METHOD: 'Payment method update request',
  FOLLOW_UP_RECEIVABLE: 'Receivable follow-up',
};

@Injectable()
export class SyntheticPaymentService {
  constructor(private readonly prisma: PrismaService) {}

  async attemptRecovery(
    paymentId: string,
    channel: RecoveryActionType,
  ): Promise<SyntheticRecoveryResult> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found.`);
    }

    const previousStatus = payment.status;
    const label = CHANNEL_LABELS[channel] ?? channel;

    if (payment.status === PaymentStatus.CAPTURED) {
      return {
        paymentId: payment.id,
        successful: true,
        previousStatus,
        status: payment.status,
        attemptNumber: payment.attemptNumber,
        recoveredAmount: Number(payment.amount),
        reason: 'Payment is already captured; this action was idempotent.',
        message: 'Payment is already captured; this action was idempotent.',
        channel,
      };
    }

    if (payment.status !== PaymentStatus.FAILED) {
      throw new Error(
        `Payment ${paymentId} cannot be recovered from status ${payment.status}.`,
      );
    }

    const nextAttemptNumber = payment.attemptNumber + 1;

    const eligibleChannels =
      RECOVERY_MATRIX[payment.failureReason ?? ''] ?? ['SEND_PAYMENT_LINK'];
    const successful = eligibleChannels.includes(channel);

    const successMessage = `${label} succeeded.`;
    const failureMessage = `${label} did not resolve ${
      payment.failureReason ?? 'the failure'
    }.`;

    return this.prisma.$transaction(async (tx) => {
      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: 'RETRY_STARTED',
          reason: `${label} started.`,
          metadata: { attemptNumber: nextAttemptNumber, channel },
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
          reason: successful ? successMessage : failureMessage,
          metadata: {
            attemptNumber: nextAttemptNumber,
            channel,
            simulated: true,
          },
        },
      });

      if (successful) {
        await tx.paymentEvent.create({
          data: {
            paymentId: payment.id,
            type: 'CAPTURED',
            reason: `Payment captured after ${label.toLowerCase()}.`,
            metadata: {
              attemptNumber: nextAttemptNumber,
              channel,
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
        recoveredAmount: successful ? Number(updatedPayment.amount) : 0,
        reason: successful ? successMessage : failureMessage,
        message: successful ? successMessage : failureMessage,
        channel,
      };
    });
  }

  /**
   * A checkout-abandonment case has no Payment yet — recovery means the
   * customer completes the purchase via the intervention (e.g. a payment
   * link), which is what actually creates the Payment for the first time.
   */
  async attemptCheckoutRecovery(
    orderId: string,
    channel: RecoveryActionType,
  ): Promise<SyntheticRecoveryResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found.`);
    }

    const existingPayment = await this.prisma.payment.findFirst({
      where: { orderId: order.id, status: PaymentStatus.CAPTURED },
    });

    if (existingPayment) {
      return {
        paymentId: existingPayment.id,
        successful: true,
        previousStatus: existingPayment.status,
        status: existingPayment.status,
        attemptNumber: existingPayment.attemptNumber,
        recoveredAmount: Number(existingPayment.amount),
        reason: 'Order already has a captured payment; this action was idempotent.',
        message: 'Order already has a captured payment; this action was idempotent.',
        channel,
      };
    }

    const label = CHANNEL_LABELS[channel] ?? channel;
    const successful = CHECKOUT_RECOVERY_CHANNELS.includes(channel);
    const successMessage = `${label} succeeded; customer completed checkout.`;
    const failureMessage = `${label} did not bring the customer back to complete checkout.`;

    if (!successful) {
      return {
        paymentId: '',
        successful: false,
        previousStatus: PaymentStatus.CREATED,
        status: PaymentStatus.CREATED,
        attemptNumber: 0,
        recoveredAmount: 0,
        reason: failureMessage,
        message: failureMessage,
        channel,
      };
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          merchantId: order.merchantId,
          customerId: order.customerId,
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          method: 'OTHER',
          status: PaymentStatus.CAPTURED,
          attemptNumber: 1,
          externalId: `link_${randomUUID()}`,
        },
      });

      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: 'CREATED',
          reason: `${label} generated a new payment for the abandoned checkout.`,
          metadata: { channel, simulated: true },
        },
      });

      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: 'CAPTURED',
          reason: successMessage,
          metadata: { channel, simulated: true },
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'PAID' },
      });

      return {
        paymentId: payment.id,
        successful: true,
        previousStatus: PaymentStatus.CREATED,
        status: payment.status,
        attemptNumber: payment.attemptNumber,
        recoveredAmount: Number(payment.amount),
        reason: successMessage,
        message: successMessage,
        channel,
      };
    });
  }
}
