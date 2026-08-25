import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  InvoiceStatus,
  PaymentStatus,
  RecoveryCaseStatus,
} from '../generated/prisma/enums';

import { PrismaService } from '../../prisma/prisma.service';
import { RiskEngineService } from './risk-engine.service';
import { AuditService } from '../audit/audit.service';
import { ACTIVE_RECOVERY_CASE_STATUSES } from '../recovery/recovery-case-status.util';

@Injectable()
export class RiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly riskEngine: RiskEngineService,
    private readonly auditService: AuditService,
  ) {}

  /** Shared by every detection path: how has this customer paid before? */
  private async getCustomerPaymentStats(
    customerId: string | null,
    excludePaymentId?: string,
  ) {
    if (!customerId) {
      return { successfulPaymentCount: 0, failedPaymentCount: 0 };
    }

    const [successfulPaymentCount, failedPaymentCount] = await Promise.all([
      this.prisma.payment.count({
        where: {
          customerId,
          status: PaymentStatus.CAPTURED,
          ...(excludePaymentId && { id: { not: excludePaymentId } }),
        },
      }),

      this.prisma.payment.count({
        where: {
          customerId,
          status: PaymentStatus.FAILED,
          ...(excludePaymentId && { id: { not: excludePaymentId } }),
        },
      }),
    ]);

    return { successfulPaymentCount, failedPaymentCount };
  }

  async assessPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
    });

    if (!payment) {
      throw new NotFoundException(
        `Payment ${paymentId} not found.`,
      );
    }

    if (payment.status !== PaymentStatus.FAILED) {
      throw new BadRequestException(
        `Payment ${paymentId} is not eligible for recovery risk assessment.`,
      );
    }

    const existingCase =
      await this.prisma.recoveryCase.findFirst({
        where: {
          paymentId: payment.id,
          status: { in: ACTIVE_RECOVERY_CASE_STATUSES },
        },
      });

    if (existingCase) {
      return existingCase;
    }

    const { successfulPaymentCount, failedPaymentCount } =
      await this.getCustomerPaymentStats(payment.customerId, payment.id);

    const assessment = this.riskEngine.assess({
      amount: Number(payment.amount),
      attemptNumber: payment.attemptNumber,
      successfulPaymentCount,
      failedPaymentCount,
    });

    const recoveryCase =
      await this.prisma.recoveryCase.create({
        data: {
          merchantId: payment.merchantId,
          customerId: payment.customerId,
          paymentId: payment.id,
          status: RecoveryCaseStatus.ELIGIBLE,
          riskLevel: assessment.riskLevel,
          revenueAtRisk: assessment.revenueAtRisk,
          recoveryProbability:
            assessment.recoveryProbability,
          rootCause:
            payment.failureReason ?? 'PAYMENT_FAILED',
        },
        include: {
          customer: true,
          payment: true,
          actions: true,
          outcome: true,
        },
      });

    await this.auditService.record({
      merchantId: recoveryCase.merchantId,
      recoveryCaseId: recoveryCase.id,
      action: 'RECOVERY_CASE_OPENED',
      actorType: 'SYSTEM',
      details: {
        paymentId: payment.id,
        rootCause: recoveryCase.rootCause,
        riskLevel: recoveryCase.riskLevel,
        revenueAtRisk: assessment.revenueAtRisk,
        recoveryProbability: assessment.recoveryProbability,
      },
    });

    return recoveryCase;
  }

  /**
   * Checkout abandonment: an Order that was created but never produced a
   * single Payment. There's nothing to retry — the customer never started
   * paying — so this is detected from the Order side, not the Payment side.
   */
  async assessOrderAbandonment(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found.`);
    }

    if (!order.customerId) {
      throw new BadRequestException(
        `Order ${orderId} has no customer to recover.`,
      );
    }

    const existingPayment = await this.prisma.payment.findFirst({
      where: { orderId: order.id },
    });

    if (existingPayment) {
      throw new BadRequestException(
        `Order ${orderId} already has a payment; use payment-based risk assessment instead.`,
      );
    }

    const existingCase = await this.prisma.recoveryCase.findFirst({
      where: {
        orderId: order.id,
        status: { in: ACTIVE_RECOVERY_CASE_STATUSES },
      },
    });

    if (existingCase) {
      return existingCase;
    }

    const { successfulPaymentCount, failedPaymentCount } =
      await this.getCustomerPaymentStats(order.customerId);

    const assessment = this.riskEngine.assess({
      amount: Number(order.amount),
      attemptNumber: 1,
      successfulPaymentCount,
      failedPaymentCount,
    });

    const recoveryCase = await this.prisma.recoveryCase.create({
      data: {
        merchantId: order.merchantId,
        customerId: order.customerId,
        orderId: order.id,
        status: RecoveryCaseStatus.ELIGIBLE,
        riskLevel: assessment.riskLevel,
        revenueAtRisk: assessment.revenueAtRisk,
        recoveryProbability: assessment.recoveryProbability,
        rootCause: 'CHECKOUT_ABANDONED',
      },
      include: {
        customer: true,
        order: true,
        actions: true,
        outcome: true,
      },
    });

    await this.auditService.record({
      merchantId: recoveryCase.merchantId,
      recoveryCaseId: recoveryCase.id,
      action: 'RECOVERY_CASE_OPENED',
      actorType: 'SYSTEM',
      details: {
        orderId: order.id,
        rootCause: recoveryCase.rootCause,
        riskLevel: recoveryCase.riskLevel,
        revenueAtRisk: assessment.revenueAtRisk,
        recoveryProbability: assessment.recoveryProbability,
      },
    });

    return recoveryCase;
  }

  /**
   * Overdue receivable: an Invoice past due with no associated Payment.
   * Recovery here means the invoice itself gets paid, not a Payment retry.
   */
  async assessInvoiceOverdue(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found.`);
    }

    if (invoice.status !== InvoiceStatus.OVERDUE) {
      throw new BadRequestException(
        `Invoice ${invoiceId} is not eligible for recovery risk assessment.`,
      );
    }

    const existingCase = await this.prisma.recoveryCase.findFirst({
      where: {
        invoiceId: invoice.id,
        status: { in: ACTIVE_RECOVERY_CASE_STATUSES },
      },
    });

    if (existingCase) {
      return existingCase;
    }

    const { successfulPaymentCount, failedPaymentCount } =
      await this.getCustomerPaymentStats(invoice.customerId);

    const assessment = this.riskEngine.assess({
      amount: Number(invoice.amount),
      attemptNumber: 1,
      successfulPaymentCount,
      failedPaymentCount,
    });

    const recoveryCase = await this.prisma.recoveryCase.create({
      data: {
        merchantId: invoice.merchantId,
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        status: RecoveryCaseStatus.ELIGIBLE,
        riskLevel: assessment.riskLevel,
        revenueAtRisk: assessment.revenueAtRisk,
        recoveryProbability: assessment.recoveryProbability,
        rootCause: 'INVOICE_OVERDUE',
      },
      include: {
        customer: true,
        invoice: true,
        actions: true,
        outcome: true,
      },
    });

    await this.auditService.record({
      merchantId: recoveryCase.merchantId,
      recoveryCaseId: recoveryCase.id,
      action: 'RECOVERY_CASE_OPENED',
      actorType: 'SYSTEM',
      details: {
        invoiceId: invoice.id,
        rootCause: recoveryCase.rootCause,
        riskLevel: recoveryCase.riskLevel,
        revenueAtRisk: assessment.revenueAtRisk,
        recoveryProbability: assessment.recoveryProbability,
      },
    });

    return recoveryCase;
  }
}
