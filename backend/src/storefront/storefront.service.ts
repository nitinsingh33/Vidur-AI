import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RazorpayService } from '../razorpay/razorpay.service';
import { CreateStorefrontOrderDto } from './dto/create-storefront-order.dto';
import { CreateStorefrontSubscriptionDto } from './dto/create-storefront-subscription.dto';

/**
 * FashionKart Plus is a single fixed membership tier, not a Product-catalog
 * item — there's no "plan" concept in the schema to look up, so the price is
 * a server-side constant instead. Never taken from the client, same rule
 * createOrder already follows for cart totals.
 */
const FASHIONKART_PLUS_AMOUNT_INR = 499;
const FASHIONKART_PLUS_PERIOD = 'monthly' as const;

/**
 * The public (unauthenticated) storefront a shopper actually sees —
 * FashionKart, or any other merchant with a configured `slug`. Everything
 * here reuses the real checkout/webhook/recovery pipeline that every other
 * merchant integration goes through; nothing about "detection" or
 * "recovery" is special-cased for storefront orders.
 */
@Injectable()
export class StorefrontService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayService: RazorpayService,
  ) {}

  private async findMerchantBySlug(slug: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        currency: true,
        slug: true,
        isDemoMerchant: true,
      },
    });

    if (!merchant) {
      throw new NotFoundException(`Store "${slug}" not found.`);
    }

    return merchant;
  }

  async getStorefront(slug: string) {
    const merchant = await this.findMerchantBySlug(slug);

    const products = await this.prisma.product.findMany({
      where: { merchantId: merchant.id, active: true },
      orderBy: { createdAt: 'asc' },
    });

    return { merchant, products };
  }

  async getProduct(slug: string, productId: string) {
    const merchant = await this.findMerchantBySlug(slug);

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || product.merchantId !== merchant.id || !product.active) {
      throw new NotFoundException(`Product ${productId} not found.`);
    }

    return { merchant, product };
  }

  /**
   * The real checkout entry point: totals are computed here, from the
   * database's own Product prices — a client-supplied amount is never
   * trusted. Creates (or reuses) a guest Customer keyed by email, then opens
   * a real Razorpay order via the same RazorpayService.createCheckoutOrder
   * every other checkout path uses.
   */
  async createOrder(slug: string, dto: CreateStorefrontOrderDto) {
    const merchant = await this.findMerchantBySlug(slug);

    const productIds = dto.items.map((item) => item.productId);

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, merchantId: merchant.id, active: true },
    });

    if (products.length !== new Set(productIds).size) {
      throw new BadRequestException(
        'One or more items in your cart are no longer available.',
      );
    }

    const productById = new Map(products.map((product) => [product.id, product]));

    let amount = 0;
    const summaryParts: string[] = [];

    for (const item of dto.items) {
      const product = productById.get(item.productId)!;
      amount += Number(product.priceAmount) * item.quantity;
      summaryParts.push(`${item.quantity}x ${product.name}`);
    }

    const customer = await this.prisma.customer.upsert({
      where: {
        merchantId_externalId: {
          merchantId: merchant.id,
          externalId: dto.customer.email,
        },
      },
      // Never overwrite an existing customer's identity — a later checkout
      // with a different typed name for the same email must not rewrite
      // history for every past order/recovery case that already points at
      // this customer. Only a brand-new email creates a new record.
      //
      // Exception: a demo merchant's storefront (e.g. FashionKart) is
      // reused by many different testers typing many different names
      // against the same handful of throwaway emails — there is no real
      // customer history to protect there, so each checkout's typed name/
      // phone is allowed to overwrite what's on file instead of silently
      // sticking to whichever tester typed first.
      update: merchant.isDemoMerchant
        ? { name: dto.customer.name, phone: dto.customer.phone }
        : {},
      create: {
        merchantId: merchant.id,
        externalId: dto.customer.email,
        name: dto.customer.name,
        email: dto.customer.email,
        phone: dto.customer.phone,
      },
    });

    const checkoutOrder = await this.razorpayService.createCheckoutOrder({
      merchantId: merchant.id,
      amount,
      customerName: dto.customer.name,
      customerId: customer.id,
      itemsSummary: summaryParts.join(', '),
    });

    return checkoutOrder;
  }

  /**
   * FashionKart Plus — a real recurring Razorpay Subscription, priced at the
   * fixed FASHIONKART_PLUS_AMOUNT_INR constant above (never the client's
   * word for it). Reuses the exact same guest-customer-upsert pattern as
   * createOrder, then delegates to the already-real
   * RazorpayService.createSubscription — the same method the merchant
   * dashboard's "New subscription" flow uses, just reached from a public,
   * slug-scoped route instead of a merchant JWT. Returns only shortUrl: the
   * customer completes the actual mandate authorization on Razorpay's own
   * hosted page, exactly like a Payment Link.
   */
  async createSubscription(slug: string, dto: CreateStorefrontSubscriptionDto) {
    const merchant = await this.findMerchantBySlug(slug);

    const customer = await this.prisma.customer.upsert({
      where: {
        merchantId_externalId: {
          merchantId: merchant.id,
          externalId: dto.customer.email,
        },
      },
      // Same "never overwrite an existing customer" rule as createOrder,
      // with the same demo-merchant exception — see createOrder's comment.
      update: merchant.isDemoMerchant
        ? { name: dto.customer.name, phone: dto.customer.phone }
        : {},
      create: {
        merchantId: merchant.id,
        externalId: dto.customer.email,
        name: dto.customer.name,
        email: dto.customer.email,
        phone: dto.customer.phone,
      },
    });

    const subscription = await this.razorpayService.createSubscription({
      merchantId: merchant.id,
      customerId: customer.id,
      amount: FASHIONKART_PLUS_AMOUNT_INR,
      currency: merchant.currency,
      period: FASHIONKART_PLUS_PERIOD,
      customerName: dto.customer.name,
      customerEmail: dto.customer.email,
      customerPhone: dto.customer.phone,
    });

    return { shortUrl: subscription.shortUrl };
  }

  /**
   * A real browser signal (tab close/hide) sent from the checkout page
   * before payment completed. Only fast-tracks detection for the checkout
   * sweep — never itself opens a RecoveryCase or claims a recovery
   * happened. Silently ignored for an order that's already paid or already
   * signaled, so a retried/duplicate beacon can't do anything.
   */
  async recordAbandonSignal(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, abandonSignalAt: true },
    });

    if (!order || order.status !== 'CREATED' || order.abandonSignalAt) {
      return { recorded: false };
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { abandonSignalAt: new Date() },
    });

    return { recorded: true };
  }

  /**
   * Lets the storefront checkout page show the customer, in real time, that
   * Vidur already noticed their payment failed and sent a new way to pay —
   * without the shopper ever needing to know a "recovery case" exists. Only
   * ever reflects real state: an actually-paid Order, or a real Razorpay
   * Payment Link Vidur's automatic pipeline already created for this exact
   * order's recovery case.
   */
  async getOrderStatus(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found.`);
    }

    // A case opened directly from a checkout-abandonment Order carries
    // orderId; one opened from a failed Payment on this order (the far more
    // common storefront path) only carries paymentId, with the Payment
    // itself pointing back at orderId — the same either-shape lookup
    // RazorpayWebhookService already uses to close a case, so this endpoint
    // reflects the exact same real case a webhook would find.
    const recoveryCase = await this.prisma.recoveryCase.findFirst({
      where: {
        OR: [{ orderId: order.id }, { payment: { orderId: order.id } }],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        actions: {
          where: { externalReferenceUrl: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { type: true, externalReferenceUrl: true },
        },
      },
    });

    const latestLinkAction = recoveryCase?.actions[0];

    return {
      status: order.status,
      recovery: latestLinkAction
        ? {
            actionType: latestLinkAction.type,
            paymentLinkUrl: latestLinkAction.externalReferenceUrl,
          }
        : null,
    };
  }
}
