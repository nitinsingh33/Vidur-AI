import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { RiskService } from '../risk/risk.service';
import { CheckoutSweepService } from '../checkout-sweep/checkout-sweep.service';
import { InvoiceOverdueSweepService } from '../invoices/invoice-overdue-sweep.service';
import { InvoicesService } from '../invoices/invoices.service';
import { PromiseToPayService } from '../promise-to-pay/promise-to-pay.service';
import { PaymentMethod, PaymentStatus } from '../generated/prisma/enums';
import { LaunchScenarioDto } from './dto/launch-scenario.dto';

const LAB_EXTERNAL_ID_PREFIX = 'VIDUR-LAB-';

/**
 * "Recovery Lab" — a scenario launcher, not a fake-data generator. Every
 * method here creates real underlying rows (a real Payment, Order,
 * Subscription, Invoice, or Mandate) via the exact same services production
 * traffic uses, then opens a real case via the exact same risk-assessment /
 * sweep services a genuine webhook or scheduled sweep would use. Unlike a
 * real webhook or scheduled sweep, none of these six scenarios auto-run
 * RecoveryAutoOrchestratorService — this is the surface a merchant (or a
 * judge) is actively watching, so the case is left OPEN for them to run
 * "Run full agent" on themselves and see the unmodified pipeline execute
 * live, rather than it finishing invisibly before anyone opens the case.
 * (The two scenarios that reuse a real sweep service — checkout-abandonment
 * and invoice-overdue/promise-to-pay — pass that sweep's autoRun: false
 * option for exactly this reason; the real scheduled sweeps keep autoRun's
 * default of true.) Nothing here ever creates
 * a RecoveryOutcome or marks a case RECOVERED directly — that still only
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
    private readonly promiseToPayService: PromiseToPayService,
  ) {}

  /**
   * Recovery Lab data is always test/lab data by definition, for whichever
   * merchant launches it — but isDemoData is only meaningful (and only
   * ever eligible for FashionKartDemoResetService to delete) when the
   * merchant itself is the dedicated demo tenant. Checking this here keeps
   * isDemoData's meaning consistent with RazorpayService.createCheckoutOrder
   * rather than tagging every merchant's lab runs unconditionally.
   */
  private async isDemoMerchant(merchantId: string): Promise<boolean> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { isDemoMerchant: true },
    });

    return merchant?.isDemoMerchant ?? false;
  }

  private async getOrCreateLabCustomer(merchantId: string, customerName?: string) {
    const externalId = `${LAB_EXTERNAL_ID_PREFIX}CUSTOMER`;

    return this.prisma.customer.upsert({
      where: { merchantId_externalId: { merchantId, externalId } },
      // Never overwrite the existing lab customer's name — every scenario
      // shares this one externalId, so renaming it here would retroactively
      // relabel every past Recovery Lab case for this merchant.
      update: {},
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
   * left OPEN. Deliberately does NOT auto-run the orchestrator the way a
   * real payment.failed webhook does: this is the demo surface a judge is
   * watching live, and firing it in the background here means the whole
   * diagnose/decide/execute pipeline has already finished by the time
   * anyone opens the case — nothing left to actually watch happen. Pressing
   * "Run full agent" on the case page runs the exact same unmodified
   * pipeline, just with the judge present to see it.
   */
  async launchPaymentFailure(merchantId: string, dto: LaunchScenarioDto) {
    const customer = await this.getOrCreateLabCustomer(merchantId, dto.customerName);
    const isDemoData = await this.isDemoMerchant(merchantId);

    const payment = await this.paymentsService.create(
      {
        merchantId,
        customerId: customer.id,
        amount: (dto.amount ?? 2499).toString(),
        currency: 'INR',
        method: PaymentMethod.UPI,
        status: PaymentStatus.FAILED,
        failureReason: 'insufficient_funds',
        attemptNumber: 1,
        externalId: `${LAB_EXTERNAL_ID_PREFIX}${randomUUID()}`,
      },
      { isDemoData },
    );

    const recoveryCase = await this.riskService.assessPayment(payment.id);

    return {
      scenario: 'PAYMENT_DEGRADATION',
      recoveryCaseId: recoveryCase.id,
      instructions:
        'A real failed payment was recorded and a recovery case opened. Open the case and click "Run full agent" to watch Vidur diagnose it, decide, and act live.',
    };
  }

  /**
   * Scenario 2: Checkout drop-off — a genuine Order with no Payment, marked
   * with a real abandon-signal timestamp (the same field a browser tab-close
   * from the storefront sets), then processed by the real, unmodified
   * checkout-abandonment sweep immediately instead of waiting out its
   * schedule. autoRun: false so the resulting case is left OPEN for the
   * judge to run "Run full agent" themselves, same as every other scenario.
   */
  async launchCheckoutAbandonment(merchantId: string, dto: LaunchScenarioDto) {
    const customer = await this.getOrCreateLabCustomer(merchantId, dto.customerName);
    const isDemoData = await this.isDemoMerchant(merchantId);

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
        isDemoData,
      },
    });

    const sweepResult = await this.checkoutSweepService.sweepOnce(merchantId, {
      autoRun: false,
    });

    return {
      scenario: 'CHECKOUT_DROP_OFF',
      orderId: order.id,
      recoveryCaseId: sweepResult.caseIds[0] ?? null,
      instructions:
        'A real abandoned-checkout Order was created with a real close-signal timestamp, and the checkout-abandonment sweep was run immediately (it otherwise runs on its own schedule) to open the case. Open the case and click "Run full agent" to watch Vidur handle it live.',
    };
  }

  /**
   * Scenario 3: Failed subscription — a real Subscription whose billing
   * cycle genuinely failed (mirrors exactly what RazorpayWebhookService does
   * on a real subscription.pending webhook), left OPEN for the same reason
   * as launchPaymentFailure above: the judge should watch the agent run,
   * not arrive to an already-finished case.
   */
  async launchSubscriptionFailure(merchantId: string, dto: LaunchScenarioDto) {
    const customer = await this.getOrCreateLabCustomer(merchantId, dto.customerName);
    const isDemoData = await this.isDemoMerchant(merchantId);

    const subscription = await this.prisma.subscription.create({
      data: {
        merchantId,
        customerId: customer.id,
        externalId: `${LAB_EXTERNAL_ID_PREFIX}${randomUUID()}`,
        amount: dto.amount ?? 999,
        currency: 'INR',
        status: 'ACTIVE',
        isDemoData,
      },
    });

    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'PAYMENT_FAILED', failedPaymentCount: { increment: 1 } },
    });

    const recoveryCase = await this.riskService.assessSubscriptionFailure(updated.id);

    return {
      scenario: 'FAILED_SUBSCRIPTION',
      subscriptionId: updated.id,
      recoveryCaseId: recoveryCase.id,
      instructions:
        'A real subscription billing cycle was marked failed (the same state a real Razorpay subscription.pending webhook produces) and a recovery case opened. Open the case and click "Run full agent" to watch Vidur handle it live.',
    };
  }

  /**
   * Scenario 4: B2B receivables chaser — a real overdue Invoice, processed
   * by the real, unmodified invoice-overdue sweep immediately instead of
   * waiting out its schedule. autoRun: false so the resulting case is left
   * OPEN for the judge to run "Run full agent" themselves.
   */
  async launchInvoiceOverdue(merchantId: string, dto: LaunchScenarioDto) {
    const customer = await this.getOrCreateLabCustomer(merchantId, dto.customerName);
    const isDemoData = await this.isDemoMerchant(merchantId);

    const overdueDueDate = new Date();
    overdueDueDate.setDate(overdueDueDate.getDate() - 10);

    const invoice = await this.invoicesService.create(
      merchantId,
      {
        customerId: customer.id,
        amount: dto.amount ?? 45000,
        currency: 'INR',
        dueDate: overdueDueDate.toISOString(),
      },
      { isDemoData },
    );

    const sweepResult = await this.invoiceOverdueSweepService.sweepOnce(
      merchantId,
      { autoRun: false },
    );

    return {
      scenario: 'B2B_RECEIVABLES_CHASER',
      invoiceId: invoice.id,
      recoveryCaseId: sweepResult.caseIds[0] ?? null,
      instructions:
        'A real invoice was created with a due date 10 days in the past, and the overdue-invoice sweep was run immediately (it otherwise runs on its own schedule) to open the case. Open the case and click "Run full agent" to watch Vidur handle it live.',
    };
  }

  /**
   * Scenario 5: Mandate retry sequencer — a real Mandate row in a genuinely
   * failed state (paused, since that's the most common real-world case: the
   * customer paused their own UPI Autopay). There's no real bank/UPI
   * authorization behind a lab-created mandate, so — exactly like the real
   * strategy table for this root cause — the pipeline escalates for human
   * attention rather than attempting a debit against a token that doesn't
   * exist; it never fabricates a retry attempt. Left OPEN for the same
   * reason as the other auto-orchestrated scenarios above.
   */
  async launchMandateFailure(merchantId: string, dto: LaunchScenarioDto) {
    const customer = await this.getOrCreateLabCustomer(merchantId, dto.customerName);
    const isDemoData = await this.isDemoMerchant(merchantId);

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
        isDemoData,
      },
    });

    const recoveryCase = await this.riskService.assessMandateFailure(
      mandate.id,
      'MANDATE_PAUSED',
    );

    return {
      scenario: 'MANDATE_RETRY_SEQUENCER',
      mandateId: mandate.id,
      recoveryCaseId: recoveryCase.id,
      instructions:
        'A real mandate was created in a paused state and a recovery case opened. Open the case and click "Run full agent" — since a paused mandate has no valid token to charge, watch Vidur correctly escalate it for human follow-up instead of fabricating a retry.',
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
   * unmodified production code. The initial invoice-overdue sweep runs with
   * autoRun: false — the case sits OPEN (no payment link sent yet) while the
   * promise is recorded, which is also the truer sequence: a merchant who
   * already has a promise on file wouldn't want the automatic pipeline
   * hitting the customer with a payment link in the same breath.
   */
  async launchPromiseToPay(
    merchantId: string,
    dto: LaunchScenarioDto,
    actorId: string,
  ) {
    const customer = await this.getOrCreateLabCustomer(merchantId, dto.customerName);
    const isDemoData = await this.isDemoMerchant(merchantId);

    const overdueDueDate = new Date();
    overdueDueDate.setDate(overdueDueDate.getDate() - 10);

    const amount = dto.amount ?? 60000;

    const invoice = await this.invoicesService.create(
      merchantId,
      {
        customerId: customer.id,
        amount,
        currency: 'INR',
        dueDate: overdueDueDate.toISOString(),
      },
      { isDemoData },
    );

    const sweepResult = await this.invoiceOverdueSweepService.sweepOnce(
      merchantId,
      { autoRun: false },
    );
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
