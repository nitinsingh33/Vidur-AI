import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentMethod, PaymentStatus } from '../generated/prisma/enums';
import { AuditService } from '../audit/audit.service';
import { PaymentsService } from '../payments/payments.service';
import { RiskService } from '../risk/risk.service';
import { RazorpayService } from './razorpay.service';

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

interface RazorpayWebhookPayload {
  event: string;
  payload?: {
    payment?: {
      entity?: RazorpayPaymentEntity;
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
 * Real entry point for Feature #1 in production: turns a genuine Razorpay
 * `payment.failed` webhook into a Payment row and hands it to the
 * unmodified RiskService.assessPayment() pipeline, exactly like
 * DemoService.triggerPaymentFailure() does for the manual/demo path — the
 * only difference is where the FAILED Payment's data comes from.
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
  ) {}

  async handlePaymentFailedWebhook(
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

    if (event !== 'payment.failed') {
      return {
        received: true,
        processed: false,
        event,
        reason: 'Event type not handled in Phase 1 (payment.failed only).',
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

    const customer = await this.resolveCustomer(
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

    const recoveryCase = await this.riskService.assessPayment(payment.id);

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
