import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PaymentMethod,
  PaymentStatus,
  RecoveryActionType,
} from '../generated/prisma/enums';
import { AuditService } from '../audit/audit.service';
import { PaymentsService } from '../payments/payments.service';
import { RiskService } from '../risk/risk.service';
import { RazorpayService } from './razorpay.service';
import { EscalationService } from '../escalation/escalation.service';
import { ACTIVE_RECOVERY_CASE_STATUSES } from '../recovery/recovery-case-status.util';

interface RazorpayPaymentEntity {
  id: string;
  order_id?: string | null;
  amount: number;
  currency?: string;
  method?: string;
  status?: string;
  email?: string;
  contact?: string;
  notes?: Record<string, string>;
  error_code?: string;
  error_description?: string;
  error_reason?: string;
  error_source?: string;
  error_step?: string;
}

interface RazorpayPaymentLinkEntity {
  id: string;
  status?: string;
  short_url?: string;
  amount?: number;
  notes?: Record<string, string>;
}

interface RazorpayOrderEntity {
  id: string;
  amount?: number;
  amount_paid?: number;
  status?: string;
  notes?: Record<string, string>;
}

interface RazorpaySubscriptionEntity {
  id: string;
  status?: string;
  current_end?: number;
  notes?: Record<string, string>;
}

interface RazorpayTokenEntity {
  id: string;
  status?: string;
}

interface RazorpayWebhookPayload {
  event: string;
  payload?: {
    payment?: {
      entity?: RazorpayPaymentEntity;
    };
    payment_link?: {
      entity?: RazorpayPaymentLinkEntity;
    };
    order?: {
      entity?: RazorpayOrderEntity;
    };
    subscription?: {
      entity?: RazorpaySubscriptionEntity;
    };
    token?: {
      entity?: RazorpayTokenEntity;
    };
  };
}

const METHOD_MAP: Record<string, PaymentMethod> = {
  card: PaymentMethod.CARD,
  upi: PaymentMethod.UPI,
  netbanking: PaymentMethod.NETBANKING,
  wallet: PaymentMethod.WALLET,
  emi: PaymentMethod.EMI,
};

/**
 * Real entry point for the webhook-driven recovery pipeline in production.
 * Four events handled:
 *  - `payment.failed` turns a genuine Razorpay failure into a Payment row
 *    and hands it to the unmodified RiskService.assessPayment() pipeline.
 *  - `payment_link.paid` confirms a SEND_PAYMENT_LINK/RETRY_PAYMENT/
 *    UPDATE_PAYMENT_METHOD/FOLLOW_UP_RECEIVABLE action actually resulted in
 *    payment — creating/sending the link never touches Payment/Order/
 *    Invoice status by itself (see RecoveryService.createAndSendPaymentLink).
 *  - `payment.captured` catches the customer paying independently of any
 *    Vidur-sent link (e.g. retrying directly on the merchant's own
 *    checkout) so a case doesn't sit open forever after the money already
 *    arrived.
 *  - `order.paid` is a defensive, order-level confirmation of the same
 *    fact, in case `payment.captured` was missed or arrives out of order.
 *  - `subscription.charged` confirms a recurring billing cycle succeeded —
 *    closes any open recovery case for that subscription and resets its
 *    failure count, or is a no-op for a routine (non-recovery) renewal.
 *  - `subscription.pending` is Razorpay's real signal that a recurring
 *    charge attempt failed and is now in its own automatic retry window;
 *    opens a recovery case directly from the Subscription (there's no
 *    Payment/Order/Invoice row for a cycle Razorpay charges automatically).
 *  - `subscription.halted` fires once Razorpay's own retries are exhausted
 *    — escalates the case for human attention rather than leaving it to
 *    keep silently failing.
 * Everything else is acknowledged (2xx) but not processed.
 */
@Injectable()
export class RazorpayWebhookService {
  private readonly logger = new Logger(RazorpayWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayService: RazorpayService,
    private readonly paymentsService: PaymentsService,
    private readonly riskService: RiskService,
    private readonly auditService: AuditService,
    private readonly escalationService: EscalationService,
  ) {}

  async handleWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
    eventId: string | undefined,
  ) {
    this.logger.log(
      `Razorpay webhook received (eventId=${eventId ?? 'unknown'}).`,
    );

    if (!rawBody) {
      throw new BadRequestException(
        'Missing raw request body; cannot verify webhook signature.',
      );
    }

    if (!this.razorpayService.verifyWebhookSignature(rawBody, signature)) {
      this.logger.warn(
        `Rejected Razorpay webhook with invalid signature (eventId=${eventId ?? 'unknown'}).`,
      );
      throw new UnauthorizedException('Invalid Razorpay webhook signature.');
    }

    this.logger.log(
      `Razorpay webhook signature verified (eventId=${eventId ?? 'unknown'}).`,
    );

    const payload = JSON.parse(
      rawBody.toString('utf8'),
    ) as RazorpayWebhookPayload;
    const event = payload.event;

    this.logger.log(
      `Razorpay webhook event type: ${event} (eventId=${eventId ?? 'unknown'}).`,
    );

    if (event === 'payment_link.paid') {
      return this.handlePaymentLinkPaid(payload, eventId);
    }

    if (event === 'payment.captured') {
      return this.handlePaymentCaptured(payload, eventId);
    }

    if (event === 'order.paid') {
      return this.handleOrderPaid(payload, eventId);
    }

    if (event === 'subscription.charged') {
      return this.handleSubscriptionCharged(payload, eventId);
    }

    if (event === 'subscription.pending') {
      return this.handleSubscriptionPending(payload, eventId);
    }

    if (event === 'subscription.halted') {
      return this.handleSubscriptionHalted(payload, eventId);
    }

    if (event === 'token.confirmed') {
      return this.handleTokenConfirmed(payload, eventId);
    }

    if (event === 'token.rejected') {
      return this.handleTokenRejected(payload, eventId);
    }

    if (event === 'token.paused') {
      return this.handleTokenPaused(payload, eventId);
    }

    if (event === 'token.cancelled') {
      return this.handleTokenCancelled(payload, eventId);
    }

    if (event !== 'payment.failed') {
      return {
        received: true,
        processed: false,
        event,
        reason:
          'Event type not handled (payment.failed, payment.captured, payment_link.paid, order.paid, ' +
          'subscription.charged, subscription.pending, subscription.halted, ' +
          'token.confirmed, token.rejected, token.paused, token.cancelled only).',
      };
    }

    const entity: RazorpayPaymentEntity | undefined =
      payload.payload?.payment?.entity;

    if (!entity?.id) {
      this.logger.warn(
        `payment.failed webhook missing payment entity (eventId=${eventId ?? 'unknown'}).`,
      );
      return {
        received: true,
        processed: false,
        reason: 'Malformed payload: missing payment entity.',
      };
    }

    const razorpayPaymentId = entity.id;
    const razorpayOrderId = entity.order_id ?? null;

    const merchantContext = await this.resolveMerchantContext(entity);

    if (!merchantContext) {
      this.logger.warn(
        `Could not resolve merchant for Razorpay payment ${razorpayPaymentId} ` +
          `(order ${razorpayOrderId ?? 'none'}); ignoring webhook.`,
      );
      return {
        received: true,
        processed: false,
        reason:
          'Unable to resolve merchant for this payment — order was not created via /razorpay/checkout.',
      };
    }

    const {
      merchantId,
      customerName,
      customerId: noteCustomerId,
    } = merchantContext;

    const existingDuplicate = await this.findExistingPayment(
      merchantId,
      razorpayPaymentId,
    );

    if (existingDuplicate) {
      this.logger.log(
        `Duplicate payment.failed webhook for ${razorpayPaymentId} ` +
          `(eventId=${eventId ?? 'unknown'}); already processed as payment ${existingDuplicate.id}.`,
      );

      return {
        received: true,
        processed: false,
        duplicate: true,
        paymentId: existingDuplicate.id,
        recoveryCaseId: existingDuplicate.recoveryCases[0]?.id ?? null,
      };
    }

    const internalOrder = razorpayOrderId
      ? await this.razorpayService.findInternalOrderByExternalId(
          merchantId,
          razorpayOrderId,
        )
      : null;

    /*
     * An order created with a known customerId (e.g. a mandate debit via
     * RazorpayService.createRecurringCharge) already has an authoritative
     * answer — trust it instead of re-deriving one from contact/email,
     * which would upsert a *different* Customer row (matched by contact,
     * not id) and silently orphan the cached razorpayCustomerId the
     * mandate/subscription flow already resolved for this exact customer.
     */
    const customer = internalOrder?.customerId
      ? await this.prisma.customer.findUnique({
          where: { id: internalOrder.customerId },
        })
      : await this.resolveCustomer(
          merchantId,
          entity,
          customerName,
          noteCustomerId,
        );

    const failureReason =
      entity.error_reason ||
      entity.error_description ||
      entity.error_code ||
      'payment_failed';

    const method =
      METHOD_MAP[(entity.method ?? '').toLowerCase()] ?? PaymentMethod.OTHER;
    const amountRupees = (Number(entity.amount) / 100).toString();

    let payment: Awaited<ReturnType<PaymentsService['create']>>;

    try {
      payment = await this.paymentsService.create({
        merchantId,
        customerId: customer?.id,
        orderId: internalOrder?.id,
        amount: amountRupees,
        currency: entity.currency ?? 'INR',
        method,
        status: PaymentStatus.FAILED,
        failureReason,
        attemptNumber: 1,
        externalId: razorpayPaymentId,
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        // Lost a race against a concurrent delivery of the same event.
        const raced = await this.findExistingPayment(
          merchantId,
          razorpayPaymentId,
        );

        return {
          received: true,
          processed: false,
          duplicate: true,
          paymentId: raced?.id ?? null,
          recoveryCaseId: raced?.recoveryCases[0]?.id ?? null,
        };
      }

      throw error;
    }

    await this.prisma.paymentEvent.create({
      data: {
        paymentId: payment.id,
        type: 'FAILED',
        reason: 'Razorpay payment.failed webhook received.',
        metadata: {
          source: 'razorpay_webhook',
          razorpayEventId: eventId ?? null,
          razorpayPaymentId,
          razorpayOrderId,
          errorCode: entity.error_code ?? null,
          errorDescription: entity.error_description ?? null,
          errorReason: entity.error_reason ?? null,
          errorSource: entity.error_source ?? null,
          errorStep: entity.error_step ?? null,
          rawMethod: entity.method ?? null,
        },
      },
    });

    this.logger.log(
      `Persisted failed payment ${payment.id} (razorpayPaymentId=${razorpayPaymentId}, ` +
        `merchantId=${merchantId}, eventId=${eventId ?? 'unknown'}).`,
    );

    /*
     * A failed debit against a mandate-backed order counts toward that
     * mandate's retry ceiling — MandateRetrySequencerService (and a manual
     * /execute) both refuse to keep retrying once this is exhausted.
     */
    if (internalOrder?.mandateId) {
      await this.prisma.mandate.update({
        where: { id: internalOrder.mandateId },
        data: { failedDebitCount: { increment: 1 } },
      });
    }

    /*
     * If this order already has an open checkout-abandonment case (no
     * Payment yet), the customer didn't abandon — they tried and failed.
     * Re-use the same case instead of opening a duplicate one.
     */
    const existingOrderCase = internalOrder
      ? await this.prisma.recoveryCase.findFirst({
          where: {
            orderId: internalOrder.id,
            paymentId: null,
            status: { in: ACTIVE_RECOVERY_CASE_STATUSES },
          },
        })
      : null;

    let recoveryCase: { id: string; riskLevel: string | null };

    if (existingOrderCase) {
      recoveryCase = await this.prisma.recoveryCase.update({
        where: { id: existingOrderCase.id },
        data: { paymentId: payment.id, rootCause: failureReason },
      });

      await this.auditService.record({
        merchantId,
        recoveryCaseId: recoveryCase.id,
        action: 'RECOVERY_CASE_LINKED_TO_FAILED_PAYMENT',
        actorType: 'SYSTEM',
        details: {
          paymentId: payment.id,
          razorpayPaymentId,
          previousRootCause: 'CHECKOUT_ABANDONED',
          newRootCause: failureReason,
        },
      });
    } else {
      recoveryCase = await this.riskService.assessPayment(payment.id);
    }

    this.logger.log(
      `Recovery case ${recoveryCase.id} created for payment ${payment.id} ` +
        `(riskLevel=${recoveryCase.riskLevel}, eventId=${eventId ?? 'unknown'}).`,
    );

    await this.auditService.record({
      merchantId,
      recoveryCaseId: recoveryCase.id,
      action: 'RAZORPAY_PAYMENT_FAILED_WEBHOOK',
      actorType: 'SYSTEM',
      details: {
        razorpayPaymentId,
        razorpayOrderId,
        eventId: eventId ?? null,
        failureReason,
      },
    });

    return {
      received: true,
      processed: true,
      paymentId: payment.id,
      recoveryCaseId: recoveryCase.id,
      razorpayPaymentId,
      razorpayOrderId,
      failureReason,
    };
  }

  /**
   * The only path allowed to turn a link-based recovery action
   * (SEND_PAYMENT_LINK / RETRY_PAYMENT / UPDATE_PAYMENT_METHOD /
   * FOLLOW_UP_RECEIVABLE — all four create a real Razorpay Payment Link,
   * see RecoveryService) into actual recovered revenue via that specific
   * link. Looks the paid link back up via
   * RecoveryAction.externalReferenceId, then delegates to closeRecoveryCase
   * for the actual state transition.
   */
  private async handlePaymentLinkPaid(
    payload: RazorpayWebhookPayload,
    eventId: string | undefined,
  ) {
    const linkEntity = payload.payload?.payment_link?.entity;

    if (!linkEntity?.id) {
      this.logger.warn(
        `payment_link.paid webhook missing payment_link entity (eventId=${eventId ?? 'unknown'}).`,
      );
      return {
        received: true,
        processed: false,
        reason: 'Malformed payload: missing payment_link entity.',
      };
    }

    const action = await this.prisma.recoveryAction.findFirst({
      where: { externalReferenceId: linkEntity.id },
    });

    if (!action) {
      this.logger.warn(
        `payment_link.paid webhook for unrecognized link ${linkEntity.id} ` +
          `(eventId=${eventId ?? 'unknown'}); ignoring.`,
      );
      return {
        received: true,
        processed: false,
        reason: 'Unrecognized payment link — not created by this system.',
      };
    }

    const result = await this.closeRecoveryCase(action.recoveryCaseId, {
      recoveryMethod: action.type,
      source: 'razorpay_payment_link_webhook',
      eventId,
    });

    this.logger.log(
      `payment_link.paid for link ${linkEntity.id} -> case ${action.recoveryCaseId} ` +
        `(${result.processed ? 'processed' : 'skipped/duplicate'}, eventId=${eventId ?? 'unknown'}).`,
    );

    return result;
  }

  /**
   * Catches the customer paying independently of anything Vidur sent —
   * e.g. retrying directly on the merchant's own checkout. If the payment
   * was made via a Vidur-sent Payment Link, Razorpay copies our
   * `notes.recoveryCaseId` onto the resulting payment entity too, so that
   * path is attributed to the real originating action rather than treated
   * as an anonymous "customer self-recovered" event.
   */
  private async handlePaymentCaptured(
    payload: RazorpayWebhookPayload,
    eventId: string | undefined,
  ) {
    const entity = payload.payload?.payment?.entity;

    if (!entity?.id) {
      return {
        received: true,
        processed: false,
        reason: 'Malformed payload: missing payment entity.',
      };
    }

    const merchantContext = await this.resolveMerchantContext(entity);

    if (!merchantContext) {
      return {
        received: true,
        processed: false,
        reason:
          'Unable to resolve merchant for this payment — order was not created via /razorpay/checkout.',
      };
    }

    const {
      merchantId,
      customerName,
      customerId: noteCustomerId,
    } = merchantContext;

    const internalOrder = entity.order_id
      ? await this.razorpayService.findInternalOrderByExternalId(
          merchantId,
          entity.order_id,
        )
      : null;

    const existingPayment = await this.findExistingPayment(
      merchantId,
      entity.id,
    );

    let paymentId: string;

    if (existingPayment) {
      if (existingPayment.status === PaymentStatus.CAPTURED) {
        return {
          received: true,
          processed: false,
          duplicate: true,
          paymentId: existingPayment.id,
        };
      }

      await this.prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          status: PaymentStatus.CAPTURED,
          failureReason: null,
          orderId: existingPayment.orderId ?? internalOrder?.id,
        },
      });

      paymentId = existingPayment.id;
    } else {
      const method =
        METHOD_MAP[(entity.method ?? '').toLowerCase()] ?? PaymentMethod.OTHER;
      const amountRupees = (Number(entity.amount) / 100).toString();
      const customer = internalOrder?.customerId
        ? await this.prisma.customer.findUnique({
            where: { id: internalOrder.customerId },
          })
        : await this.resolveCustomer(
            merchantId,
            entity,
            customerName,
            noteCustomerId,
          );

      const created = await this.paymentsService.create({
        merchantId,
        customerId: customer?.id,
        orderId: internalOrder?.id,
        amount: amountRupees,
        currency: entity.currency ?? 'INR',
        method,
        status: PaymentStatus.CAPTURED,
        attemptNumber: 1,
        externalId: entity.id,
      });

      paymentId = created.id;
    }

    await this.prisma.paymentEvent.create({
      data: {
        paymentId,
        type: 'CAPTURED',
        reason: 'Razorpay payment.captured webhook received.',
        metadata: {
          source: 'razorpay_webhook',
          razorpayEventId: eventId ?? null,
          razorpayPaymentId: entity.id,
        },
      },
    });

    if (internalOrder && internalOrder.status !== 'PAID') {
      await this.prisma.order.update({
        where: { id: internalOrder.id },
        data: { status: 'PAID' },
      });
    }

    const notedCaseId = entity.notes?.recoveryCaseId;

    let targetCaseId: string | null = null;

    if (notedCaseId) {
      const noted = await this.prisma.recoveryCase.findUnique({
        where: { id: notedCaseId },
        select: { id: true },
      });
      targetCaseId = noted?.id ?? null;
    }

    if (!targetCaseId && internalOrder) {
      const matched = await this.prisma.recoveryCase.findFirst({
        where: {
          status: { in: ACTIVE_RECOVERY_CASE_STATUSES },
          OR: [
            { orderId: internalOrder.id },
            { payment: { orderId: internalOrder.id } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      targetCaseId = matched?.id ?? null;
    }

    if (!targetCaseId) {
      return {
        received: true,
        processed: true,
        paymentId,
        note: 'No open recovery case matched this captured payment.',
      };
    }

    const recoveryMethod = notedCaseId
      ? await this.resolveOriginatingActionType(targetCaseId)
      : null;

    const result = await this.closeRecoveryCase(targetCaseId, {
      recoveryMethod,
      source: notedCaseId
        ? 'razorpay_payment_captured_via_recovery_link'
        : 'razorpay_payment_captured_direct',
      eventId,
    });

    return { ...result, paymentId };
  }

  /**
   * Defensive, order-level confirmation of the same fact as
   * payment.captured — closes the case if it's somehow still open (e.g.
   * payment.captured was missed or arrived out of order).
   */
  private async handleOrderPaid(
    payload: RazorpayWebhookPayload,
    eventId: string | undefined,
  ) {
    const entity = payload.payload?.order?.entity;

    if (!entity?.id) {
      return {
        received: true,
        processed: false,
        reason: 'Malformed payload: missing order entity.',
      };
    }

    const merchantId = entity.notes?.merchantId;

    if (!merchantId) {
      return {
        received: true,
        processed: false,
        reason: 'Unable to resolve merchant for this order.',
      };
    }

    const internalOrder =
      await this.razorpayService.findInternalOrderByExternalId(
        merchantId,
        entity.id,
      );

    if (!internalOrder) {
      return {
        received: true,
        processed: false,
        reason: 'No internal order found for this Razorpay order id.',
      };
    }

    if (internalOrder.status !== 'PAID') {
      await this.prisma.order.update({
        where: { id: internalOrder.id },
        data: { status: 'PAID' },
      });
    }

    const targetCase = await this.prisma.recoveryCase.findFirst({
      where: {
        status: { in: ACTIVE_RECOVERY_CASE_STATUSES },
        OR: [
          { orderId: internalOrder.id },
          { payment: { orderId: internalOrder.id } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!targetCase) {
      return {
        received: true,
        processed: true,
        orderId: internalOrder.id,
        note: 'No open recovery case matched this paid order.',
      };
    }

    const recoveryMethod = await this.resolveOriginatingActionType(
      targetCase.id,
    );

    return this.closeRecoveryCase(targetCase.id, {
      recoveryMethod,
      source: 'razorpay_order_paid',
      eventId,
      ensurePaymentCaptured: targetCase.orderId
        ? { externalId: `order_paid_${entity.id}`, method: PaymentMethod.OTHER }
        : undefined,
    });
  }

  /**
   * A recurring billing cycle succeeded. If it closes out an open recovery
   * case, closeRecoveryCase both records the outcome and resets the
   * Subscription's failure state; a routine (non-recovery) renewal just
   * refreshes the Subscription's billing state directly.
   */
  private async handleSubscriptionCharged(
    payload: RazorpayWebhookPayload,
    eventId: string | undefined,
  ) {
    const entity = payload.payload?.subscription?.entity;

    if (!entity?.id) {
      return {
        received: true,
        processed: false,
        reason: 'Malformed payload: missing subscription entity.',
      };
    }

    const subscription =
      await this.razorpayService.findInternalSubscriptionByExternalId(
        entity.id,
      );

    if (!subscription) {
      this.logger.warn(
        `subscription.charged webhook for unrecognized subscription ${entity.id} ` +
          `(eventId=${eventId ?? 'unknown'}); ignoring.`,
      );
      return {
        received: true,
        processed: false,
        reason: 'Unrecognized subscription — not created by this system.',
      };
    }

    const activeCase = await this.prisma.recoveryCase.findFirst({
      where: {
        subscriptionId: subscription.id,
        status: { in: ACTIVE_RECOVERY_CASE_STATUSES },
      },
    });

    if (!activeCase) {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          failedPaymentCount: 0,
          ...(entity.current_end && {
            nextBillingAt: new Date(entity.current_end * 1000),
          }),
        },
      });

      return {
        received: true,
        processed: true,
        subscriptionId: subscription.id,
        note: 'Routine successful charge; no open recovery case.',
      };
    }

    const recoveryMethod = await this.resolveOriginatingActionType(
      activeCase.id,
    );

    const result = await this.closeRecoveryCase(activeCase.id, {
      recoveryMethod,
      source: 'razorpay_subscription_charged',
      eventId,
    });

    this.logger.log(
      `subscription.charged for ${entity.id} -> case ${activeCase.id} ` +
        `(${result.processed ? 'processed' : 'skipped/duplicate'}, eventId=${eventId ?? 'unknown'}).`,
    );

    return { ...result, subscriptionId: subscription.id };
  }

  /**
   * A recurring charge attempt failed and Razorpay itself is now retrying
   * it on its own schedule. This is the primary detection signal for
   * subscription recovery — opens a case directly from the Subscription.
   */
  private async handleSubscriptionPending(
    payload: RazorpayWebhookPayload,
    eventId: string | undefined,
  ) {
    const entity = payload.payload?.subscription?.entity;

    if (!entity?.id) {
      return {
        received: true,
        processed: false,
        reason: 'Malformed payload: missing subscription entity.',
      };
    }

    const subscription =
      await this.razorpayService.findInternalSubscriptionByExternalId(
        entity.id,
      );

    if (!subscription) {
      this.logger.warn(
        `subscription.pending webhook for unrecognized subscription ${entity.id} ` +
          `(eventId=${eventId ?? 'unknown'}); ignoring.`,
      );
      return {
        received: true,
        processed: false,
        reason: 'Unrecognized subscription — not created by this system.',
      };
    }

    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'PAYMENT_FAILED',
        failedPaymentCount: { increment: 1 },
      },
    });

    const recoveryCase = await this.riskService.assessSubscriptionFailure(
      subscription.id,
    );

    this.logger.log(
      `subscription.pending for ${entity.id} -> case ${recoveryCase.id} ` +
        `(failedPaymentCount=${updated.failedPaymentCount}, eventId=${eventId ?? 'unknown'}).`,
    );

    await this.auditService.record({
      merchantId: subscription.merchantId,
      recoveryCaseId: recoveryCase.id,
      action: 'RAZORPAY_SUBSCRIPTION_PENDING_WEBHOOK',
      actorType: 'SYSTEM',
      details: {
        razorpaySubscriptionId: entity.id,
        eventId: eventId ?? null,
        failedPaymentCount: updated.failedPaymentCount,
      },
    });

    return {
      received: true,
      processed: true,
      subscriptionId: subscription.id,
      recoveryCaseId: recoveryCase.id,
    };
  }

  /**
   * Razorpay exhausted its own automatic retry schedule and halted the
   * subscription — no further auto-charge attempts will happen. Escalates
   * the case (opening one first if subscription.pending was somehow missed)
   * rather than leaving it to keep silently failing.
   */
  private async handleSubscriptionHalted(
    payload: RazorpayWebhookPayload,
    eventId: string | undefined,
  ) {
    const entity = payload.payload?.subscription?.entity;

    if (!entity?.id) {
      return {
        received: true,
        processed: false,
        reason: 'Malformed payload: missing subscription entity.',
      };
    }

    const subscription =
      await this.razorpayService.findInternalSubscriptionByExternalId(
        entity.id,
      );

    if (!subscription) {
      this.logger.warn(
        `subscription.halted webhook for unrecognized subscription ${entity.id} ` +
          `(eventId=${eventId ?? 'unknown'}); ignoring.`,
      );
      return {
        received: true,
        processed: false,
        reason: 'Unrecognized subscription — not created by this system.',
      };
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'PAYMENT_FAILED' },
    });

    let recoveryCase = await this.prisma.recoveryCase.findFirst({
      where: {
        subscriptionId: subscription.id,
        status: { in: ACTIVE_RECOVERY_CASE_STATUSES },
      },
    });

    if (!recoveryCase) {
      recoveryCase = await this.riskService.assessSubscriptionFailure(
        subscription.id,
      );
    }

    if (recoveryCase.status !== 'ESCALATED') {
      await this.prisma.recoveryCase.update({
        where: { id: recoveryCase.id },
        data: { rootCause: 'SUBSCRIPTION_HALTED' },
      });

      await this.escalationService.escalateRecoveryCase(
        recoveryCase.id,
        'Razorpay halted this subscription after exhausting its own automatic retry schedule.',
      );
    }

    this.logger.log(
      `subscription.halted for ${entity.id} -> case ${recoveryCase.id} escalated ` +
        `(eventId=${eventId ?? 'unknown'}).`,
    );

    return {
      received: true,
      processed: true,
      subscriptionId: subscription.id,
      recoveryCaseId: recoveryCase.id,
    };
  }

  /**
   * The bank/UPI app completed mandate registration — the token id now
   * exists and future recurring debits can be charged against it. Correlates
   * back to the internal Mandate via the authorization payment's order id,
   * since the token itself didn't exist when the Mandate row was created.
   */
  private async handleTokenConfirmed(
    payload: RazorpayWebhookPayload,
    eventId: string | undefined,
  ) {
    const tokenEntity = payload.payload?.token?.entity;
    const paymentEntity = payload.payload?.payment?.entity;

    if (!tokenEntity?.id || !paymentEntity?.order_id) {
      return {
        received: true,
        processed: false,
        reason: 'Malformed payload: missing token or payment entity.',
      };
    }

    const mandate =
      await this.razorpayService.findInternalMandateByRegistrationOrderId(
        paymentEntity.order_id,
      );

    if (!mandate) {
      this.logger.warn(
        `token.confirmed webhook for unrecognized registration order ${paymentEntity.order_id} ` +
          `(eventId=${eventId ?? 'unknown'}); ignoring.`,
      );
      return {
        received: true,
        processed: false,
        reason:
          'Unrecognized mandate registration — not created by this system.',
      };
    }

    if (mandate.status === 'CONFIRMED') {
      return {
        received: true,
        processed: false,
        duplicate: true,
        mandateId: mandate.id,
      };
    }

    await this.prisma.mandate.update({
      where: { id: mandate.id },
      data: { status: 'CONFIRMED', externalId: tokenEntity.id },
    });

    this.logger.log(
      `token.confirmed for mandate ${mandate.id} (token=${tokenEntity.id}, eventId=${eventId ?? 'unknown'}).`,
    );

    await this.auditService.record({
      merchantId: mandate.merchantId,
      action: 'MANDATE_CONFIRMED',
      actorType: 'SYSTEM',
      details: {
        mandateId: mandate.id,
        razorpayTokenId: tokenEntity.id,
        eventId: eventId ?? null,
      },
    });

    return { received: true, processed: true, mandateId: mandate.id };
  }

  /**
   * Mandate registration failed at the bank/UPI-app step. There's no token
   * and never was — this correlates the same way as token.confirmed, via
   * the authorization payment's order id.
   */
  private async handleTokenRejected(
    payload: RazorpayWebhookPayload,
    eventId: string | undefined,
  ) {
    const paymentEntity = payload.payload?.payment?.entity;

    if (!paymentEntity?.order_id) {
      return {
        received: true,
        processed: false,
        reason: 'Malformed payload: missing payment entity.',
      };
    }

    const mandate =
      await this.razorpayService.findInternalMandateByRegistrationOrderId(
        paymentEntity.order_id,
      );

    if (!mandate) {
      this.logger.warn(
        `token.rejected webhook for unrecognized registration order ${paymentEntity.order_id} ` +
          `(eventId=${eventId ?? 'unknown'}); ignoring.`,
      );
      return {
        received: true,
        processed: false,
        reason:
          'Unrecognized mandate registration — not created by this system.',
      };
    }

    await this.prisma.mandate.update({
      where: { id: mandate.id },
      data: { status: 'REJECTED' },
    });

    const recoveryCase = await this.riskService.assessMandateFailure(
      mandate.id,
      'MANDATE_REGISTRATION_REJECTED',
    );

    await this.auditService.record({
      merchantId: mandate.merchantId,
      recoveryCaseId: recoveryCase.id,
      action: 'MANDATE_REJECTED',
      actorType: 'SYSTEM',
      details: { mandateId: mandate.id, eventId: eventId ?? null },
    });

    this.logger.log(
      `token.rejected for mandate ${mandate.id} -> case ${recoveryCase.id} (eventId=${eventId ?? 'unknown'}).`,
    );

    return {
      received: true,
      processed: true,
      mandateId: mandate.id,
      recoveryCaseId: recoveryCase.id,
    };
  }

  /**
   * The customer paused their UPI Autopay mandate — future debits will fail
   * until they resume it. Correlates via the token id directly (this
   * happens well after registration; there's no payment to key off).
   */
  private async handleTokenPaused(
    payload: RazorpayWebhookPayload,
    eventId: string | undefined,
  ) {
    const tokenEntity = payload.payload?.token?.entity;

    if (!tokenEntity?.id) {
      return {
        received: true,
        processed: false,
        reason: 'Malformed payload: missing token entity.',
      };
    }

    const mandate = await this.razorpayService.findInternalMandateByExternalId(
      tokenEntity.id,
    );

    if (!mandate) {
      this.logger.warn(
        `token.paused webhook for unrecognized token ${tokenEntity.id} ` +
          `(eventId=${eventId ?? 'unknown'}); ignoring.`,
      );
      return {
        received: true,
        processed: false,
        reason: 'Unrecognized token — not created by this system.',
      };
    }

    await this.prisma.mandate.update({
      where: { id: mandate.id },
      data: { status: 'PAUSED' },
    });

    const recoveryCase = await this.riskService.assessMandateFailure(
      mandate.id,
      'MANDATE_PAUSED',
    );

    await this.auditService.record({
      merchantId: mandate.merchantId,
      recoveryCaseId: recoveryCase.id,
      action: 'MANDATE_PAUSED',
      actorType: 'SYSTEM',
      details: { mandateId: mandate.id, eventId: eventId ?? null },
    });

    this.logger.log(
      `token.paused for mandate ${mandate.id} -> case ${recoveryCase.id} (eventId=${eventId ?? 'unknown'}).`,
    );

    return {
      received: true,
      processed: true,
      mandateId: mandate.id,
      recoveryCaseId: recoveryCase.id,
    };
  }

  /** The mandate was cancelled outright — no future debits are possible via it, ever. */
  private async handleTokenCancelled(
    payload: RazorpayWebhookPayload,
    eventId: string | undefined,
  ) {
    const tokenEntity = payload.payload?.token?.entity;

    if (!tokenEntity?.id) {
      return {
        received: true,
        processed: false,
        reason: 'Malformed payload: missing token entity.',
      };
    }

    const mandate = await this.razorpayService.findInternalMandateByExternalId(
      tokenEntity.id,
    );

    if (!mandate) {
      this.logger.warn(
        `token.cancelled webhook for unrecognized token ${tokenEntity.id} ` +
          `(eventId=${eventId ?? 'unknown'}); ignoring.`,
      );
      return {
        received: true,
        processed: false,
        reason: 'Unrecognized token — not created by this system.',
      };
    }

    await this.prisma.mandate.update({
      where: { id: mandate.id },
      data: { status: 'CANCELLED' },
    });

    const recoveryCase = await this.riskService.assessMandateFailure(
      mandate.id,
      'MANDATE_CANCELLED',
    );

    await this.auditService.record({
      merchantId: mandate.merchantId,
      recoveryCaseId: recoveryCase.id,
      action: 'MANDATE_CANCELLED',
      actorType: 'SYSTEM',
      details: { mandateId: mandate.id, eventId: eventId ?? null },
    });

    this.logger.log(
      `token.cancelled for mandate ${mandate.id} -> case ${recoveryCase.id} (eventId=${eventId ?? 'unknown'}).`,
    );

    return {
      received: true,
      processed: true,
      mandateId: mandate.id,
      recoveryCaseId: recoveryCase.id,
    };
  }

  /** Most recent action Vidur actually ran for this case — used to attribute recovered revenue. */
  private async resolveOriginatingActionType(
    recoveryCaseId: string,
  ): Promise<RecoveryActionType | null> {
    const action = await this.prisma.recoveryAction.findFirst({
      where: {
        recoveryCaseId,
        status: { in: ['EXECUTING', 'SUCCESS'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    return action?.type ?? null;
  }

  /**
   * Single, idempotent state transition shared by every "this case's money
   * actually arrived" path: marks the underlying Payment/Order/Invoice
   * paid, records a RecoveryOutcome, and closes the case as RECOVERED.
   * Safe to call more than once for the same case — a case that already
   * has an outcome (or is already RECOVERED) is a no-op.
   */
  private async closeRecoveryCase(
    recoveryCaseId: string,
    params: {
      recoveryMethod: RecoveryActionType | null;
      source: string;
      eventId: string | undefined;
      ensurePaymentCaptured?: { externalId: string; method: PaymentMethod };
    },
  ) {
    const recoveryCase = await this.prisma.recoveryCase.findUnique({
      where: { id: recoveryCaseId },
      include: {
        payment: {
          include: {
            order: true,
          },
        },
        order: true,
        invoice: true,
        subscription: true,
        outcome: true,
      },
    });

    if (!recoveryCase) {
      return {
        received: true,
        processed: false,
        reason: `Recovery case ${recoveryCaseId} not found.`,
      };
    }

    if (recoveryCase.outcome || recoveryCase.status === 'RECOVERED') {
      this.logger.log(
        `Duplicate recovery confirmation for case ${recoveryCase.id} ` +
          `(source=${params.source}, eventId=${params.eventId ?? 'unknown'}); already recovered.`,
      );
      return {
        received: true,
        processed: false,
        duplicate: true,
        recoveryCaseId: recoveryCase.id,
      };
    }

    const recoveredAmount = recoveryCase.payment
      ? Number(recoveryCase.payment.amount)
      : recoveryCase.order
        ? Number(recoveryCase.order.amount)
        : recoveryCase.invoice
          ? Number(recoveryCase.invoice.amount)
          : Number(recoveryCase.subscription?.amount ?? 0);

    try {
      await this.prisma.$transaction(async (tx) => {
        if (recoveryCase.payment) {
          await tx.payment.update({
            where: { id: recoveryCase.payment.id },
            data: { status: PaymentStatus.CAPTURED, failureReason: null },
          });

          await tx.paymentEvent.create({
            data: {
              paymentId: recoveryCase.payment.id,
              type: 'CAPTURED',
              reason: `Captured via ${params.source}.`,
              metadata: {
                source: params.source,
                razorpayEventId: params.eventId ?? null,
              },
            },
          });

          if (recoveryCase.payment.orderId) {
            await tx.order.update({
              where: { id: recoveryCase.payment.orderId },
              data: { status: 'PAID' },
            });
          }

          if (recoveryCase.payment.order?.mandateId) {
            await tx.mandate.update({
              where: { id: recoveryCase.payment.order.mandateId },
              data: { failedDebitCount: 0 },
            });
          }
        } else if (recoveryCase.orderId) {
          if (params.ensurePaymentCaptured) {
            const existingCaptured = await tx.payment.findFirst({
              where: { orderId: recoveryCase.orderId, status: 'CAPTURED' },
            });

            if (!existingCaptured) {
              await tx.payment.create({
                data: {
                  merchantId: recoveryCase.merchantId,
                  customerId: recoveryCase.customerId,
                  orderId: recoveryCase.orderId,
                  amount: recoveryCase.order?.amount ?? 0,
                  currency: recoveryCase.order?.currency ?? 'INR',
                  method: params.ensurePaymentCaptured.method,
                  status: PaymentStatus.CAPTURED,
                  attemptNumber: 1,
                  externalId: params.ensurePaymentCaptured.externalId,
                },
              });
            }
          }

          await tx.order.update({
            where: { id: recoveryCase.orderId },
            data: { status: 'PAID' },
          });
        } else if (recoveryCase.invoiceId) {
          await tx.invoice.update({
            where: { id: recoveryCase.invoiceId },
            data: { status: 'PAID', paidAt: new Date() },
          });
        } else if (recoveryCase.subscriptionId) {
          await tx.subscription.update({
            where: { id: recoveryCase.subscriptionId },
            data: { status: 'ACTIVE', failedPaymentCount: 0 },
          });
        }

        await tx.recoveryOutcome.create({
          data: {
            recoveryCaseId: recoveryCase.id,
            recoveredAmount,
            successful: true,
            recoveryMethod: params.recoveryMethod,
            recoveredAt: new Date(),
          },
        });

        await tx.recoveryCase.update({
          where: { id: recoveryCase.id },
          data: { status: 'RECOVERED', closedAt: new Date() },
        });
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Unique constraint')
      ) {
        // Lost a race against a concurrent delivery of an equivalent event.
        this.logger.log(
          `Duplicate recovery confirmation for case ${recoveryCase.id} ` +
            `(source=${params.source}, eventId=${params.eventId ?? 'unknown'}); already recorded.`,
        );
        return {
          received: true,
          processed: false,
          duplicate: true,
          recoveryCaseId: recoveryCase.id,
        };
      }

      throw error;
    }

    this.logger.log(
      `Recovery case ${recoveryCase.id} marked RECOVERED via ${params.source} ` +
        `(amount=${recoveredAmount}, eventId=${params.eventId ?? 'unknown'}).`,
    );

    await this.auditService.record({
      merchantId: recoveryCase.merchantId,
      recoveryCaseId: recoveryCase.id,
      action: 'RECOVERY_SUCCEEDED',
      actorType: 'SYSTEM',
      details: {
        recoveredAmount,
        recoveryMethod: params.recoveryMethod,
        source: params.source,
        eventId: params.eventId ?? null,
      },
    });

    return {
      received: true,
      processed: true,
      recoveryCaseId: recoveryCase.id,
      recoveredAmount,
    };
  }

  /**
   * The order's `notes` (stamped at creation in RazorpayService.createOrder)
   * is how a webhook — which carries no merchant JWT — knows which merchant
   * this payment belongs to. Falls back to a live order lookup via the
   * existing RazorpayService.getOrder() when the payment entity itself
   * didn't carry notes.
   */
  private async resolveMerchantContext(entity: RazorpayPaymentEntity): Promise<{
    merchantId: string;
    customerName?: string;
    customerId?: string;
  } | null> {
    if (entity.notes?.merchantId) {
      return {
        merchantId: entity.notes.merchantId,
        customerName: entity.notes.customerName,
        customerId: entity.notes.customerId,
      };
    }

    if (!entity.order_id) {
      return null;
    }

    try {
      const order = await this.razorpayService.getOrder(entity.order_id);
      const merchantId = order.notes?.merchantId;

      if (!merchantId) {
        return null;
      }

      return {
        merchantId,
        customerName: order.notes?.customerName,
        customerId: order.notes?.customerId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to look up Razorpay order ${entity.order_id}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return null;
    }
  }

  private findExistingPayment(merchantId: string, externalId: string) {
    return this.prisma.payment.findUnique({
      where: { merchantId_externalId: { merchantId, externalId } },
      include: { recoveryCases: true },
    });
  }

  private async resolveCustomer(
    merchantId: string,
    entity: RazorpayPaymentEntity,
    customerName: string | undefined,
    noteCustomerId: string | undefined,
  ) {
    const externalId = entity.contact || entity.email || noteCustomerId;

    if (!externalId) {
      return null;
    }

    return this.prisma.customer.upsert({
      where: { merchantId_externalId: { merchantId, externalId } },
      update: {},
      create: {
        merchantId,
        externalId,
        name: customerName?.trim() || 'Razorpay Test Mode Customer',
        email: entity.email || undefined,
        phone: entity.contact || undefined,
      },
    });
  }
}
