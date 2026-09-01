import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { RiskService } from '../risk/risk.service';
import { AuditService } from '../audit/audit.service';
import { PaymentMethod, PaymentStatus } from '../generated/prisma/enums';
import { TriggerPaymentFailureDto } from './dto/trigger-payment-failure.dto';
import {
  DEMO_CUSTOMER_EXTERNAL_ID,
  DEMO_EXTERNAL_ID_PREFIX,
} from './demo.constants';

/**
 * Judge-facing demo mechanism for Feature #1 ("detect revenue at risk").
 *
 * This intentionally does NOT compute risk itself. It only synthesizes a
 * realistic FAILED Payment and hands it to the real, unmodified pipeline
 * (PaymentsService.create -> RiskService.assessPayment -> RiskEngineService)
 * so the resulting revenueAtRisk/riskLevel/RecoveryCase are produced by
 * production code, not by this demo layer.
 */
@Injectable()
export class DemoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly riskService: RiskService,
    private readonly auditService: AuditService,
  ) {}

  private async getOrCreateDemoCustomer(
    merchantId: string,
    customerName?: string,
  ) {
    return this.prisma.customer.upsert({
      where: {
        merchantId_externalId: {
          merchantId,
          externalId: DEMO_CUSTOMER_EXTERNAL_ID,
        },
      },
      update: {},
      create: {
        merchantId,
        externalId: DEMO_CUSTOMER_EXTERNAL_ID,
        name: customerName?.trim() || 'Vidur Demo Customer',
        email: 'demo-customer@vidur.ai',
      },
    });
  }

  async triggerPaymentFailure(
    merchantId: string,
    dto: TriggerPaymentFailureDto,
  ) {
    const customer = await this.getOrCreateDemoCustomer(
      merchantId,
      dto.customerName,
    );

    const payment = await this.paymentsService.create(
      {
        merchantId,
        customerId: customer.id,
        amount: dto.amount.toString(),
        currency: 'INR',
        method: dto.method ?? PaymentMethod.UPI,
        status: PaymentStatus.FAILED,
        failureReason: dto.failureReason ?? 'insufficient_funds',
        attemptNumber: 1,
        externalId: `${DEMO_EXTERNAL_ID_PREFIX}${randomUUID()}`,
      },
      // This entire endpoint exists only to synthesize demo data by
      // design (see the class doc comment) — unconditionally true, unlike
      // RecoveryLabService which checks merchant.isDemoMerchant since it's
      // reachable by any merchant.
      { isDemoData: true },
    );

    const recoveryCase = await this.riskService.assessPayment(payment.id);

    return { payment, recoveryCase };
  }

  /**
   * Removes only demo-tagged records (Payment.externalId prefixed with
   * VIDUR-DEMO-) for the authenticated merchant, and only the RecoveryCase /
   * AuditLog rows that trace back to those payments. Never touches other
   * merchants, real payments, or the demo customer record itself (reused
   * across runs so repeated demos don't churn Customer rows).
   */
  async reset(merchantId: string) {
    const demoPayments = await this.prisma.payment.findMany({
      where: {
        merchantId,
        externalId: { startsWith: DEMO_EXTERNAL_ID_PREFIX },
      },
      select: { id: true },
    });

    const paymentIds = demoPayments.map((payment) => payment.id);

    if (paymentIds.length === 0) {
      return {
        paymentsDeleted: 0,
        recoveryCasesDeleted: 0,
        auditLogsDeleted: 0,
      };
    }

    const demoCases = await this.prisma.recoveryCase.findMany({
      where: {
        merchantId,
        paymentId: { in: paymentIds },
      },
      select: { id: true },
    });

    const caseIds = demoCases.map((recoveryCase) => recoveryCase.id);

    const [auditLogsDeleted, recoveryCasesDeleted, paymentsDeleted] =
      await this.prisma.$transaction([
        this.prisma.auditLog.deleteMany({
          where: { recoveryCaseId: { in: caseIds } },
        }),
        this.prisma.recoveryCase.deleteMany({
          where: { id: { in: caseIds } },
        }),
        this.prisma.payment.deleteMany({
          where: { id: { in: paymentIds } },
        }),
      ]);

    // Recorded after the transaction — the very audit rows this action
    // deletes are gone by then, which is correct: that history only ever
    // existed while the demo data did.
    await this.auditService.record({
      merchantId,
      action: 'DEMO_RESET',
      actorType: 'SYSTEM',
      details: {
        paymentsDeleted: paymentsDeleted.count,
        recoveryCasesDeleted: recoveryCasesDeleted.count,
        auditLogsDeleted: auditLogsDeleted.count,
      },
    });

    return {
      paymentsDeleted: paymentsDeleted.count,
      recoveryCasesDeleted: recoveryCasesDeleted.count,
      auditLogsDeleted: auditLogsDeleted.count,
    };
  }
}
