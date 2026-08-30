import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

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

@Injectable()
export class RazorpayService {
  private readonly keyId = process.env.RAZORPAY_KEY_ID;

  private readonly keySecret = process.env.RAZORPAY_KEY_SECRET;

  private readonly webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

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
   * secret).
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

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: this.keyId,
    };
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
