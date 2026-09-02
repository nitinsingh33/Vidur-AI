import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RazorpayService } from '../razorpay/razorpay.service';
import { StorefrontService } from './storefront.service';

describe('StorefrontService', () => {
  let service: StorefrontService;

  const prisma = {
    merchant: { findUnique: jest.fn() },
    product: { findMany: jest.fn(), findUnique: jest.fn() },
    customer: { upsert: jest.fn() },
    order: { findUnique: jest.fn(), update: jest.fn() },
    recoveryCase: { findFirst: jest.fn() },
  } as unknown as PrismaService;

  const razorpayService = {
    createCheckoutOrder: jest.fn(),
    createSubscription: jest.fn(),
  } as unknown as RazorpayService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StorefrontService(prisma, razorpayService);
  });

  it('rejects an unknown store slug', async () => {
    (prisma.merchant.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.getStorefront('nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('computes the checkout amount from real Product prices, never a client-supplied amount', async () => {
    (prisma.merchant.findUnique as jest.Mock).mockResolvedValue({
      id: 'merchant-1',
      name: 'FashionKart',
      currency: 'INR',
      slug: 'fashionkart',
    });
    (prisma.product.findMany as jest.Mock).mockResolvedValue([
      { id: 'p1', name: 'Classic Tee', priceAmount: 799 },
      { id: 'p2', name: 'Denim Jacket', priceAmount: 2999 },
    ]);
    (prisma.customer.upsert as jest.Mock).mockResolvedValue({ id: 'customer-1' });
    (razorpayService.createCheckoutOrder as jest.Mock).mockResolvedValue({
      orderId: 'order_razorpay',
      internalOrderId: 'internal-1',
      amount: 4597,
      currency: 'INR',
      keyId: 'rzp_test_key',
    });

    await service.createOrder('fashionkart', {
      items: [
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 1 },
      ],
      customer: { name: 'Jane Doe', email: 'jane@example.com' },
    });

    // 2 * 799 + 1 * 2999 = 4597 — computed server-side, not from the client.
    expect(razorpayService.createCheckoutOrder).toHaveBeenCalledWith(
      expect.objectContaining({ merchantId: 'merchant-1', amount: 4597 }),
    );
  });

  it('rejects checkout if a cart item references a product that does not exist or belongs to another merchant', async () => {
    (prisma.merchant.findUnique as jest.Mock).mockResolvedValue({
      id: 'merchant-1',
      name: 'FashionKart',
      currency: 'INR',
      slug: 'fashionkart',
    });
    (prisma.product.findMany as jest.Mock).mockResolvedValue([]);

    await expect(
      service.createOrder('fashionkart', {
        items: [{ productId: 'does-not-exist', quantity: 1 }],
        customer: { name: 'Jane Doe', email: 'jane@example.com' },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('getOrderStatus only ever reflects real Order/RecoveryAction state, never fabricates a recovery link', async () => {
    (prisma.order.findUnique as jest.Mock).mockResolvedValue({
      id: 'order-1',
      status: 'CREATED',
    });
    (prisma.recoveryCase.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await service.getOrderStatus('order-1');

    expect(result).toEqual({ status: 'CREATED', recovery: null });
  });

  it('getOrderStatus finds the recovery case via payment.orderId, not just orderId directly', async () => {
    (prisma.order.findUnique as jest.Mock).mockResolvedValue({
      id: 'order-1',
      status: 'CREATED',
    });
    (prisma.recoveryCase.findFirst as jest.Mock).mockResolvedValue({
      actions: [
        { type: 'RETRY_PAYMENT', externalReferenceUrl: 'https://rzp.io/rzp/abc' },
      ],
    });

    const result = await service.getOrderStatus('order-1');

    expect(prisma.recoveryCase.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ orderId: 'order-1' }, { payment: { orderId: 'order-1' } }] },
      }),
    );
    expect(result).toEqual({
      status: 'CREATED',
      recovery: { actionType: 'RETRY_PAYMENT', paymentLinkUrl: 'https://rzp.io/rzp/abc' },
    });
  });

  describe('createSubscription — FashionKart Plus', () => {
    const merchant = {
      id: 'merchant-1',
      name: 'FashionKart',
      currency: 'INR',
      slug: 'fashionkart',
    };

    beforeEach(() => {
      (prisma.merchant.findUnique as jest.Mock).mockResolvedValue(merchant);
      (prisma.customer.upsert as jest.Mock).mockResolvedValue({ id: 'customer-1' });
      (razorpayService.createSubscription as jest.Mock).mockResolvedValue({
        id: 'sub-internal-1',
        externalId: 'sub_test123',
        shortUrl: 'https://rzp.io/rzp/subscription-auth',
        status: 'created',
        amount: 499,
        currency: 'INR',
      });
    });

    it('ignores any client-supplied amount and always prices FashionKart Plus at the fixed ₹499/month', async () => {
      await service.createSubscription('fashionkart', {
        // @ts-expect-error — deliberately probing that a client-supplied
        // amount is never read, even if a caller tried to send one.
        amount: 1,
        customer: { name: 'Jane Doe', email: 'jane@example.com' },
      });

      expect(razorpayService.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          merchantId: 'merchant-1',
          amount: 499,
          period: 'monthly',
        }),
      );
    });

    it('upserts the guest customer by email before creating the subscription', async () => {
      await service.createSubscription('fashionkart', {
        customer: { name: 'Jane Doe', email: 'jane@example.com', phone: '9999999999' },
      });

      expect(prisma.customer.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            merchantId_externalId: {
              merchantId: 'merchant-1',
              externalId: 'jane@example.com',
            },
          },
        }),
      );
      expect(razorpayService.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: 'customer-1' }),
      );
    });

    it('returns only shortUrl — never a raw Razorpay credential or internal id', async () => {
      const result = await service.createSubscription('fashionkart', {
        customer: { name: 'Jane Doe', email: 'jane@example.com' },
      });

      expect(result).toEqual({ shortUrl: 'https://rzp.io/rzp/subscription-auth' });
    });

    it('rejects an unknown store slug before touching Razorpay', async () => {
      (prisma.merchant.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createSubscription('nonexistent', {
          customer: { name: 'Jane Doe', email: 'jane@example.com' },
        }),
      ).rejects.toThrow(NotFoundException);

      expect(razorpayService.createSubscription).not.toHaveBeenCalled();
    });
  });

  it('recordAbandonSignal is a no-op for an order that is already paid', async () => {
    (prisma.order.findUnique as jest.Mock).mockResolvedValue({
      id: 'order-1',
      status: 'PAID',
      abandonSignalAt: null,
    });

    const result = await service.recordAbandonSignal('order-1');

    expect(result).toEqual({ recorded: false });
    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});
