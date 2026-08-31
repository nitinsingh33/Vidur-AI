import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface CreateCheckoutOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface RazorpayPaymentLink {
  id: string;
  short_url: string;
  status: string;
  amount: number;
  currency: string;
}

export interface CreateSubscriptionResult {
  id: string;
  externalId: string;
  shortUrl: string;
  status: string;
  amount: number;
  currency: string;
}

export interface CreateMandateRegistrationResult {
  id: string;
  registrationOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
  method: 'upi' | 'emandate';
}

export interface RecurringChargeResult {
  internalOrderId: string;
  externalOrderId: string;
  paymentId: string;
  status: string;
}

@Injectable()
export class RazorpayService {
  private readonly keyId = process.env.RAZORPAY_KEY_ID;

  private readonly keySecret = process.env.RAZORPAY_KEY_SECRET;

  private readonly webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  constructor(private readonly prisma: PrismaService) {}

  private basicAuthHeader(): string {
    if (!this.keyId || !this.keySecret) {
      throw new InternalServerErrorException(
        'Razorpay credentials are not configured.',
      );
    }

    return Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
  }

  async getOrder(orderId: string): Promise<RazorpayOrder> {
    const response = await fetch(
      `https://api.razorpay.com/v1/orders/${orderId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${this.basicAuthHeader()}`,
        },
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();

      throw new InternalServerErrorException(
        `Razorpay API request failed: ${errorBody}`,
      );
    }

    return (await response.json()) as RazorpayOrder;
  }

  /**
   * Creates a real Razorpay Test/Live Mode order via the Orders API. The
   * merchant/customer context is stamped into `notes` because this backend
   * uses one Razorpay account for all merchants — the webhook has no JWT to
   * identify the merchant from, so it looks the order back up by id and
   * reads these notes (see RazorpayWebhookService).
   */
  async createOrder(params: {
    amount: number;
    currency?: string;
    merchantId: string;
    customerId?: string;
    customerName?: string;
    /** Auto-capture on success — needed for server-initiated charges where
     *  there's no customer present afterward to trigger a manual capture. */
    paymentCapture?: boolean;
  }): Promise<RazorpayOrder> {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${this.basicAuthHeader()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(params.amount * 100),
        currency: params.currency ?? 'INR',
        receipt: `vidur_${randomUUID()}`,
        ...(params.paymentCapture && { payment_capture: 1 }),
        notes: {
          merchantId: params.merchantId,
          customerId: params.customerId ?? '',
          customerName: params.customerName ?? '',
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();

      throw new InternalServerErrorException(
        `Razorpay order creation failed: ${errorBody}`,
      );
    }

    return (await response.json()) as RazorpayOrder;
  }

  /**
   * What the frontend needs to open Razorpay Checkout.js for a real Test
   * Mode payment attempt: an order id and the public key id (never the
   * secret). Also persists an internal Order row (status CREATED,
   * externalId = the Razorpay order id) so that a customer who never
   * completes payment is a real, queryable "checkout started, no payment"
   * record — not just an inference made after the fact — and so
   * payment.captured/order.paid webhooks can find their way back here.
   */
  async createCheckoutOrder(params: {
    merchantId: string;
    amount: number;
    customerName?: string;
  }): Promise<CreateCheckoutOrderResult> {
    if (!this.keyId) {
      throw new InternalServerErrorException(
        'Razorpay credentials are not configured.',
      );
    }

    const order = await this.createOrder(params);

    await this.prisma.order.create({
      data: {
        merchantId: params.merchantId,
        externalId: order.id,
        amount: params.amount,
        currency: order.currency,
        status: 'CREATED',
      },
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: this.keyId,
    };
  }

  /** Internal Order row for a Razorpay order id, if one was persisted at checkout-creation time. */
  findInternalOrderByExternalId(merchantId: string, razorpayOrderId: string) {
    return this.prisma.order.findUnique({
      where: {
        merchantId_externalId: { merchantId, externalId: razorpayOrderId },
      },
    });
  }

  /**
   * Creates a real Razorpay Test/Live Mode Payment Link via the Payment
   * Links API (POST /v1/payment_links/) — used by the SEND_PAYMENT_LINK
   * recovery action. Razorpay itself delivers the notification (email/SMS)
   * when notify.email/notify.sms are true, so no separate provider is
   * needed for this channel. `notes.recoveryCaseId` lets the
   * payment_link.paid webhook find its way back here as a fallback, but
   * the primary lookup is RecoveryAction.externalReferenceId = link id.
   */
  async createPaymentLink(params: {
    amount: number;
    currency?: string;
    description: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    recoveryCaseId: string;
    merchantId: string;
  }): Promise<RazorpayPaymentLink> {
    const response = await fetch('https://api.razorpay.com/v1/payment_links/', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${this.basicAuthHeader()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(params.amount * 100),
        currency: params.currency ?? 'INR',
        description: params.description,
        customer: {
          name: params.customerName,
          email: params.customerEmail,
          contact: params.customerPhone,
        },
        notify: {
          sms: Boolean(params.customerPhone),
          email: Boolean(params.customerEmail),
        },
        reminder_enable: true,
        notes: {
          recoveryCaseId: params.recoveryCaseId,
          merchantId: params.merchantId,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();

      throw new InternalServerErrorException(
        `Razorpay payment link creation failed: ${errorBody}`,
      );
    }

    return (await response.json()) as RazorpayPaymentLink;
  }

  /**
   * Creates a real Razorpay Test/Live Mode recurring Subscription: a Plan
   * (the billing schedule) followed by a Subscription against it. Razorpay
   * requires the customer to complete a one-time mandate authorization via
   * `short_url` (like a Payment Link) before recurring charges begin — only
   * after that do subscription.charged/pending/halted webhooks fire for
   * this subscription. Persists an internal Subscription row (externalId =
   * the Razorpay subscription id) so those webhooks can find their way back
   * here without a merchant JWT.
   */
  async createSubscription(params: {
    merchantId: string;
    customerId: string;
    amount: number;
    currency?: string;
    period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    totalCount?: number;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
  }): Promise<CreateSubscriptionResult> {
    const planResponse = await fetch('https://api.razorpay.com/v1/plans', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${this.basicAuthHeader()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        period: params.period ?? 'monthly',
        interval: 1,
        item: {
          name: `Vidur AI subscription — ${params.customerName ?? 'customer'}`,
          amount: Math.round(params.amount * 100),
          currency: params.currency ?? 'INR',
        },
      }),
    });

    if (!planResponse.ok) {
      const errorBody = await planResponse.text();

      throw new InternalServerErrorException(
        `Razorpay plan creation failed: ${errorBody}`,
      );
    }

    const plan = (await planResponse.json()) as { id: string };

    const subscriptionResponse = await fetch(
      'https://api.razorpay.com/v1/subscriptions',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${this.basicAuthHeader()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan_id: plan.id,
          total_count: params.totalCount ?? 12,
          customer_notify: 1,
          notes: {
            merchantId: params.merchantId,
            customerId: params.customerId,
          },
        }),
      },
    );

    if (!subscriptionResponse.ok) {
      const errorBody = await subscriptionResponse.text();

      throw new InternalServerErrorException(
        `Razorpay subscription creation failed: ${errorBody}`,
      );
    }

    const subscription = (await subscriptionResponse.json()) as {
      id: string;
      status: string;
      short_url: string;
    };

    const record = await this.prisma.subscription.create({
      data: {
        merchantId: params.merchantId,
        customerId: params.customerId,
        externalId: subscription.id,
        amount: params.amount,
        currency: params.currency ?? 'INR',
        status: 'ACTIVE',
      },
    });

    return {
      id: record.id,
      externalId: subscription.id,
      shortUrl: subscription.short_url,
      status: subscription.status,
      amount: params.amount,
      currency: params.currency ?? 'INR',
    };
  }

  /**
   * Internal Subscription row for a Razorpay subscription id. Unlike
   * findInternalOrderByExternalId, this doesn't require merchantId up
   * front — subscription webhooks (charged/pending/halted) carry no
   * merchant JWT and no order/payment notes to resolve one from, so the
   * Subscription row itself (already merchant-scoped at creation time) is
   * the only way to learn which merchant this event belongs to.
   */
  findInternalSubscriptionByExternalId(razorpaySubscriptionId: string) {
    return this.prisma.subscription.findFirst({
      where: { externalId: razorpaySubscriptionId },
    });
  }

  /**
   * Mandate registration (UPI Autopay / eNACH) requires a real Razorpay
   * Customer id, not just contact/email in notes — the recurring-payment
   * APIs key everything off it. Created lazily on first mandate
   * registration and cached on the Customer row; `fail_existing: 0` makes
   * this idempotent (returns the existing Razorpay customer instead of
   * erroring if one already exists for this contact/email).
   */
  private async getOrCreateRazorpayCustomer(customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    razorpayCustomerId: string | null;
  }): Promise<string> {
    if (customer.razorpayCustomerId) {
      return customer.razorpayCustomerId;
    }

    const response = await fetch('https://api.razorpay.com/v1/customers', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${this.basicAuthHeader()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: customer.name,
        email: customer.email ?? undefined,
        contact: customer.phone ?? undefined,
        fail_existing: 0,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();

      throw new InternalServerErrorException(
        `Razorpay customer creation failed: ${errorBody}`,
      );
    }

    const razorpayCustomer = (await response.json()) as { id: string };

    await this.prisma.customer.update({
      where: { id: customer.id },
      data: { razorpayCustomerId: razorpayCustomer.id },
    });

    return razorpayCustomer.id;
  }

  /**
   * Registers a real Razorpay recurring mandate (UPI Autopay or eNACH): an
   * Order carrying a `token` block (max_amount/expire_at/frequency) instead
   * of a one-off amount. The customer still has to complete authorization
   * via Razorpay Checkout.js against this order (recurring: true) — that's
   * a real bank/UPI-app interaction Razorpay itself owns; this call only
   * gets the mandate to the point where that authorization can happen.
   * Persists an internal Mandate row (status CREATED) keyed by the
   * registration order id, since the eventual token id doesn't exist yet.
   */
  async createMandateRegistrationOrder(params: {
    merchantId: string;
    customer: {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      razorpayCustomerId: string | null;
    };
    maxAmount: number;
    currency?: string;
    method: 'upi' | 'emandate';
    frequency?: string;
    expireAt: Date;
  }): Promise<CreateMandateRegistrationResult> {
    if (!this.keyId) {
      throw new InternalServerErrorException(
        'Razorpay credentials are not configured.',
      );
    }

    const razorpayCustomerId = await this.getOrCreateRazorpayCustomer(
      params.customer,
    );

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${this.basicAuthHeader()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(params.maxAmount * 100),
        currency: params.currency ?? 'INR',
        payment_capture: 1,
        method: params.method,
        customer_id: razorpayCustomerId,
        token: {
          max_amount: Math.round(params.maxAmount * 100),
          expire_at: Math.floor(params.expireAt.getTime() / 1000),
          frequency: params.frequency ?? 'monthly',
        },
        notes: {
          merchantId: params.merchantId,
          customerId: params.customer.id,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();

      throw new InternalServerErrorException(
        `Razorpay mandate registration order creation failed: ${errorBody}`,
      );
    }

    const order = (await response.json()) as RazorpayOrder;

    const mandate = await this.prisma.mandate.create({
      data: {
        merchantId: params.merchantId,
        customerId: params.customer.id,
        registrationOrderId: order.id,
        method: params.method,
        maxAmount: params.maxAmount,
        currency: params.currency ?? 'INR',
        frequency: params.frequency ?? 'monthly',
        expireAt: params.expireAt,
        status: 'CREATED',
      },
    });

    return {
      id: mandate.id,
      registrationOrderId: order.id,
      amount: params.maxAmount,
      currency: params.currency ?? 'INR',
      keyId: this.keyId,
      method: params.method,
    };
  }

  /**
   * Correlates a token.confirmed/rejected webhook (which carries no
   * merchant JWT) back to the internal Mandate — via the authorization
   * payment's order id, since the token id itself doesn't exist until
   * confirmation.
   */
  findInternalMandateByRegistrationOrderId(razorpayOrderId: string) {
    return this.prisma.mandate.findFirst({
      where: { registrationOrderId: razorpayOrderId },
    });
  }

  /** For token.paused/token.cancelled webhooks, which reference the token id directly. */
  findInternalMandateByExternalId(razorpayTokenId: string) {
    return this.prisma.mandate.findFirst({
      where: { externalId: razorpayTokenId },
    });
  }

  /**
   * The actual "retry" in the mandate retry sequencer: a headless recurring
   * debit against an already-confirmed mandate's token — no customer
   * interaction, exactly like a real NPCI/UPI Autopay re-presentment.
   * Persists an internal Order (mandateId set) so the resulting
   * payment.captured/payment.failed webhook can find its way back here
   * through the same generic pipeline every other payment uses — this call
   * only ever reports "the attempt was made," never "the money arrived."
   */
  async createRecurringCharge(params: {
    merchantId: string;
    customer: {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      razorpayCustomerId: string | null;
    };
    mandateId: string;
    razorpayTokenId: string;
    amount: number;
    currency?: string;
  }): Promise<RecurringChargeResult> {
    const razorpayCustomerId = await this.getOrCreateRazorpayCustomer(
      params.customer,
    );

    const order = await this.createOrder({
      amount: params.amount,
      currency: params.currency,
      merchantId: params.merchantId,
      customerId: params.customer.id,
      customerName: params.customer.name,
      paymentCapture: true,
    });

    const internalOrder = await this.prisma.order.create({
      data: {
        merchantId: params.merchantId,
        customerId: params.customer.id,
        externalId: order.id,
        mandateId: params.mandateId,
        amount: params.amount,
        currency: order.currency,
        status: 'CREATED',
      },
    });

    const chargeResponse = await fetch(
      'https://api.razorpay.com/v1/payments/create/recurring',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${this.basicAuthHeader()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: params.customer.email ?? undefined,
          contact: params.customer.phone ?? undefined,
          amount: Math.round(params.amount * 100),
          currency: params.currency ?? 'INR',
          order_id: order.id,
          customer_id: razorpayCustomerId,
          token: params.razorpayTokenId,
          recurring: '1',
        }),
      },
    );

    if (!chargeResponse.ok) {
      const errorBody = await chargeResponse.text();

      throw new InternalServerErrorException(
        `Razorpay recurring charge failed: ${errorBody}`,
      );
    }

    const charge = (await chargeResponse.json()) as {
      id: string;
      status: string;
    };

    return {
      internalOrderId: internalOrder.id,
      externalOrderId: order.id,
      paymentId: charge.id,
      status: charge.status,
    };
  }

  /**
   * Verifies X-Razorpay-Signature against the raw (unparsed) request body,
   * per Razorpay's documented webhook verification: HMAC-SHA256 of the raw
   * body using the dashboard-configured webhook secret, compared to the
   * header. Constant-time compare to avoid timing attacks.
   */
  verifyWebhookSignature(
    rawBody: Buffer,
    signature: string | undefined,
  ): boolean {
    if (!this.webhookSecret || !signature) {
      return false;
    }

    const expected = createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, signatureBuffer);
  }
}
