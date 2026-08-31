import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { RiskService } from '../risk/risk.service';
import { CheckoutSweepService } from '../checkout-sweep/checkout-sweep.service';
import { InvoiceOverdueSweepService } from '../invoices/invoice-overdue-sweep.service';
import { InvoicesService } from '../invoices/invoices.service';
import { RecoveryAutoOrchestratorService } from '../recovery-auto/recovery-auto-orchestrator.service';
import { PromiseToPayService } from '../promise-to-pay/promise-to-pay.service';
import { PaymentMethod, PaymentStatus } from '../generated/prisma/enums';
import { LaunchScenarioDto } from './dto/launch-scenario.dto';

const LAB_EXTERNAL_ID_PREFIX = 'VIDUR-LAB-';

/**
 * "Recovery Lab" — a scenario launcher, not a fake-data generator. Every
 * method here creates real underlying rows (a real Payment, Order,
 * Subscription, Invoice, or Mandate) via the exact same services production
 * traffic uses, then hands off to the exact same automatic pipeline
 * (RecoveryAutoOrchestratorService / the real sweep services) that a genuine
 * webhook or scheduled sweep would use. Nothing here ever creates a
 * RecoveryOutcome or marks a case RECOVERED directly — that still only
 * happens through the real, provider-confirmed path (a Razorpay webhook, or
 * a merchant's own "Mark Paid" for B2B).
 */
@Injectable()
export class RecoveryLabService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly riskService: RiskService,
    private readonly checkoutSweepService: CheckoutSweepService,
    private readonly invoiceOverdueSweepService: InvoiceOverdueSweepService,
    private readonly invoicesService: InvoicesService,
    private readonly autoOrchestrator: RecoveryAutoOrchestratorService,
    private readonly promiseToPayService: PromiseToPayService,
  ) {}

  private async getOrCreateLabCustomer(merchantId: string, customerName?: string) {
    const externalId = `${LAB_EXTERNAL_ID_PREFIX}CUSTOMER`;

    return this.prisma.customer.upsert({
      where: { merchantId_externalId: { merchantId, externalId } },
      update: customerName ? { name: customerName } : {},
      create: {
        merchantId,
        externalId,
        name: customerName?.trim() || 'Recovery Lab Customer',
        email: 'recovery-lab@vidur.ai',
      },
    });
  }

  /**
   * Scenario 1: Payment degradation — a genuine FAILED Payment, assessed and
   * handed straight to the automatic orchestrator, exactly like a real
   * payment.failed webhook would be.
   */
  async launchPaymentFailure(merchantId: string, dto: LaunchScenarioDto) {
    const customer = await this.getOrCreateLabCustomer(merchantId, dto.customerName);

    const payment = await this.paymentsService.create({
      merchantId,
      customerId: customer.id,
      amount: (dto.amount ?? 2499).toString(),
      currency: 'INR',
      method: PaymentMethod.UPI,
      status: PaymentStatus.FAILED,
      failureReason: 'insufficient_funds',
      attemptNumber: 1,
      externalId: `${LAB_EXTERNAL_ID_PREFIX}${randomUUID()}`,
    });

    const recoveryCase = await this.riskService.assessPayment(payment.id);
    void this.autoOrchestrator.runAutomaticRecovery(recoveryCase.id);

    return {
      scenario: 'PAYMENT_DEGRADATION',
      recoveryCaseId: recoveryCase.id,
      instructions:
        'A real failed payment was recorded and handed to Vidur\'s automatic pipeline. Watch this case update in real time — no further clicks needed.',
    };
  }

  /**
   * Scenario 2: Checkout drop-off — a genuine Order with no Payment, marked
   * with a real abandon-signal timestamp (the same field a browser tab-close
   * from the storefront sets), then processed by the real, unmodified
   * checkout-abandonment sweep immediately instead of waiting out its
   * schedule.
   */
  async launchCheckoutAbandonment(merchantId: string, dto: LaunchScenarioDto) {
    const customer = await this.getOrCreateLabCustomer(merchantId, dto.customerName);

    const order = await this.prisma.order.create({
      data: {
        merchantId,
        customerId: customer.id,
        externalId: `${LAB_EXTERNAL_ID_PREFIX}${randomUUID()}`,
        amount: dto.amount ?? 3499,
        currency: 'INR',
        status: 'CREATED',
        itemsSummary: 'Recovery Lab simulated cart',
        abandonSignalAt: new Date(),
      },
    });

    const sweepResult = await this.checkoutSweepService.sweepOnce(merchantId);

    return {
      scenario: 'CHECKOUT_DROP_OFF',
      orderId: order.id,
      recoveryCaseId: sweepResult.caseIds[0] ?? null,
      instructions:
        'A real abandoned-checkout Order was created with a real close-signal timestamp, and the checkout-abandonment sweep was run immediately (it otherwise runs on its own schedule). If a case id is present, Vidur has already processed it automatically.',
    };
  }

  /**
   * Scenario 3: Failed subscription — a real Subscription whose billing
   * cycle genuinely failed (mirrors exactly what RazorpayWebhookService does
   * on a real subscription.pending webhook), then handed to the automatic
   * orchestrator.
   */
  async launchSubscriptionFailure(merchantId: string, dto: LaunchScenarioDto) {
    const customer = await this.getOrCreateLabCustomer(merchantId, dto.customerName);

    const subscription = await this.prisma.subscription.create({
      data: {
        merchantId,
        customerId: customer.id,
        externalId: `${LAB_EXTERNAL_ID_PREFIX}${randomUUID()}`,
        amount: dto.amount ?? 999,
        currency: 'INR',
        status: 'ACTIVE',
      },
    });

    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'PAYMENT_FAILED', failedPaymentCount: { increment: 1 } },
    });

    const recoveryCase = await this.riskService.assessSubscriptionFailure(updated.id);
    void this.autoOrchestrator.runAutomaticRecovery(recoveryCase.id);

    return {
      scenario: 'FAILED_SUBSCRIPTION',
      subscriptionId: updated.id,
      recoveryCaseId: recoveryCase.id,
      instructions:
        'A real subscription billing cycle was marked failed (the same state a real Razorpay subscription.pending webhook produces) and handed to Vidur\'s automatic pipeline.',
    };
  }

  /**
   * Scenario 4: B2B receivables chaser — a real overdue Invoice, processed
   * by the real, unmodified invoice-overdue sweep immediately instead of
   * waiting out its schedule.
   */
  async launchInvoiceOverdue(merchantId: string, dto: LaunchScenarioDto) {
    const customer = await this.getOrCreateLabCustomer(merchantId, dto.customerName);

    const overdueDueDate = new Date();
    overdueDueDate.setDate(overdueDueDate.getDate() - 10);

    const invoice = await this.invoicesService.create(merchantId, {
      customerId: customer.id,
      amount: dto.amount ?? 45000,
      currency: 'INR',
      dueDate: overdueDueDate.toISOString(),
    });

    const sweepResult = await this.invoiceOverdueSweepService.sweepOnce(merchantId);

    return {
      scenario: 'B2B_RECEIVABLES_CHASER',
      invoiceId: invoice.id,
      recoveryCaseId: sweepResult.caseIds[0] ?? null,
      instructions:
        'A real invoice was created with a due date 10 days in the past, and the overdue-invoice sweep was run immediately (it otherwise runs on its own schedule). If a case id is present, Vidur has already processed it automatically.',
    };
  }

  /**
   * Scenario 5: Mandate retry sequencer — a real Mandate row in a genuinely
   * failed state (paused, since that's the most common real-world case: the
   * customer paused their own UPI Autopay). There's no real bank/UPI
   * authorization behind a lab-created mandate, so — exactly like the real
   * strategy table for this root cause — the pipeline escalates for human
   * attention rather than attempting a debit against a token that doesn't
   * exist; it never fabricates a retry attempt.
   */
  async launchMandateFailure(merchantId: string, dto: LaunchScenarioDto) {
    const customer = await this.getOrCreateLabCustomer(merchantId, dto.customerName);

    const expireAt = new Date();
    expireAt.setFullYear(expireAt.getFullYear() + 1);

    const mandate = await this.prisma.mandate.create({
      data: {
        merchantId,
        customerId: customer.id,
        registrationOrderId: `${LAB_EXTERNAL_ID_PREFIX}${randomUUID()}`,
        maxAmount: dto.amount ?? 1499,
        currency: 'INR',
        method: 'upi',
        frequency: 'monthly',
        status: 'PAUSED',
        expireAt,
      },
    });

    const recoveryCase = await this.riskService.assessMandateFailure(
      mandate.id,
      'MANDATE_PAUSED',
    );
    void this.autoOrchestrator.runAutomaticRecovery(recoveryCase.id);

    return {
      scenario: 'MANDATE_RETRY_SEQUENCER',
      mandateId: mandate.id,
      recoveryCaseId: recoveryCase.id,
      instructions:
        'A real mandate was created in a paused state and handed to Vidur\'s automatic pipeline. Since a paused mandate has no valid token to charge, Vidur correctly escalates it for human follow-up rather than attempting a debit.',
    };
  }

  /**
   * Scenario 6: Promise-to-Pay — a real overdue Invoice (same as scenario 4),
   * plus a genuine PromiseToPay record created through the exact same
   * PromiseToPayService.create() a merchant's own UI calls. This never
   * fabricates KEPT/MISSED/RECOVERED: the promised date defaults to a couple
   * of minutes out (configurable via promisedInMinutes) purely so a judge
   * doesn't have to wait days for the real verification sweep to matter —
   * the sweep itself, and what happens on a miss (the real Detection ->
   * Strategy -> Policy -> Action -> Observe pipeline), are both completely
   * unmodified production code.
   */
  async launchPromiseToPay(
    merchantId: string,
    dto: LaunchScenarioDto,
    actorId: string,
  ) {
    const customer = await this.getOrCreateLabCustomer(merchantId, dto.customerName);

    const overdueDueDate = new Date();
    overdueDueDate.setDate(overdueDueDate.getDate() - 10);

    const amount = dto.amount ?? 60000;

    const invoice = await this.invoicesService.create(merchantId, {
      customerId: customer.id,
      amount,
      currency: 'INR',
      dueDate: overdueDueDate.toISOString(),
    });

    const sweepResult = await this.invoiceOverdueSweepService.sweepOnce(merchantId);
    const recoveryCaseId = sweepResult.caseIds[0] ?? null;

    if (!recoveryCaseId) {
      return {
        scenario: 'PROMISE_TO_PAY',
        invoiceId: invoice.id,
        recoveryCaseId: null,
        promiseId: null,
        instructions:
          'The invoice was created but no recovery case was opened for it — try launching again.',
      };
    }

    const promisedInMinutes = dto.promisedInMinutes ?? 2;
    const promisedDate = new Date(Date.now() + promisedInMinutes * 60 * 1000);

    const promise = await this.promiseToPayService.create(
      merchantId,
      {
        recoveryCaseId,
        promisedAmount: amount,
        promisedDate: promisedDate.toISOString(),
        notes: 'Recovery Lab: customer promised to pay the overdue invoice by the promised date.',
      },
      { id: actorId },
    );

    return {
      scenario: 'PROMISE_TO_PAY',
      invoiceId: invoice.id,
      recoveryCaseId,
      promiseId: promise.id,
      promisedDate: promisedDate.toISOString(),
      instructions:
        `A real overdue invoice and a genuine promise to pay by ${promisedDate.toLocaleString()} were recorded. ` +
        'To see it KEPT: mark the invoice paid from Receivables before that time, then run the promise sweep. ' +
        'To see it MISSED: do nothing and run the promise sweep after that time from the Promise-to-Pay page — ' +
        'Vidur will hand the case back to its real automatic recovery pipeline.',
    };
  }
}
