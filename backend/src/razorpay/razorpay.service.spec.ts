import { InternalServerErrorException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CredentialEncryptionService } from '../credential-encryption/credential-encryption.service';
import { RazorpayService } from './razorpay.service';

describe('RazorpayService — per-merchant credential resolution', () => {
  let service: RazorpayService;
  let fetchMock: jest.Mock;

  const prisma = {
    merchant: {
      findUnique: jest.fn(),
    },
    order: {
      create: jest.fn(),
    },
  } as unknown as PrismaService;

  const credentialEncryption = new CredentialEncryptionService();

  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'test-key';
    process.env.RAZORPAY_KEY_ID = 'rzp_global_key';
    process.env.RAZORPAY_KEY_SECRET = 'global_secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'global_webhook_secret';

    service = new RazorpayService(prisma, credentialEncryption);

    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'order_123', amount: 100000, currency: 'INR' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('falls back to the global (shared sandbox) credentials when a merchant has not connected their own', async () => {
    (prisma.merchant.findUnique as jest.Mock).mockResolvedValue(null);

    await service.createOrder({ amount: 1000, merchantId: 'merchant-fashionkart' });

    const [, options] = fetchMock.mock.calls[0];
    const authHeader = (options.headers as Record<string, string>).Authorization;
    const decoded = Buffer.from(
      authHeader.replace('Basic ', ''),
      'base64',
    ).toString('utf8');

    expect(decoded).toBe('rzp_global_key:global_secret');
  });

  it("uses a merchant's own connected credentials instead of the global ones", async () => {
    (prisma.merchant.findUnique as jest.Mock).mockResolvedValue({
      razorpayKeyId: 'rzp_merchant_own_key',
      razorpayKeySecretEncrypted: credentialEncryption.encrypt('merchant_own_secret'),
    });

    await service.createOrder({ amount: 1000, merchantId: 'merchant-real' });

    const [, options] = fetchMock.mock.calls[0];
    const authHeader = (options.headers as Record<string, string>).Authorization;
    const decoded = Buffer.from(
      authHeader.replace('Basic ', ''),
      'base64',
    ).toString('utf8');

    expect(decoded).toBe('rzp_merchant_own_key:merchant_own_secret');
  });

  it('throws instead of transacting when neither the merchant nor the global env has credentials configured', async () => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    // Global credentials are read at construction time — must recreate the
    // service after clearing them, not just clear env after the fact.
    const unconfiguredService = new RazorpayService(prisma, credentialEncryption);
    (prisma.merchant.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      unconfiguredService.createOrder({
        amount: 1000,
        merchantId: 'merchant-unconfigured',
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  describe('verifyCredentials — real-looking validation call before saving', () => {
    it('returns true when Razorpay accepts the credentials', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

      const result = await service.verifyCredentials('key_id', 'key_secret');

      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/v1/payments'),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('returns false when Razorpay rejects the credentials', async () => {
      fetchMock.mockResolvedValue({ ok: false });

      const result = await service.verifyCredentials('bad_key', 'bad_secret');

      expect(result).toBe(false);
    });
  });

  describe('createPaymentLink — Razorpay rate-limit retry', () => {
    const params = {
      amount: 1000,
      description: 'test payment link',
      recoveryCaseId: 'case-1',
      merchantId: 'merchant-1',
    };

    const rateLimitedResponse = {
      ok: false,
      text: async () =>
        JSON.stringify({
          error: { description: 'Too many requests', code: 'BAD_REQUEST_ERROR' },
        }),
    };

    const successResponse = {
      ok: true,
      json: async () => ({
        id: 'plink_1',
        short_url: 'https://rzp.io/l/abc',
        status: 'created',
        amount: 100000,
        currency: 'INR',
      }),
    };

    it('fails immediately on a permanent (non-rate-limit) error, without retrying', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        text: async () =>
          JSON.stringify({
            error: {
              description: 'amount exceeds maximum amount allowed.',
              code: 'BAD_REQUEST_ERROR',
            },
          }),
      });

      await expect(service.createPaymentLink(params)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retries a rate-limited response and succeeds once Razorpay accepts it', async () => {
      fetchMock
        .mockResolvedValueOnce(rateLimitedResponse)
        .mockResolvedValueOnce(successResponse);

      const result = await service.createPaymentLink(params);

      expect(result.id).toBe('plink_1');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    }, 10000);

    it('gives up after exhausting retries if every attempt is rate-limited', async () => {
      fetchMock.mockResolvedValue(rateLimitedResponse);

      await expect(service.createPaymentLink(params)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );

      // Bounded: initial attempt + PAYMENT_LINK_MAX_RETRIES retries, never more.
      expect(fetchMock).toHaveBeenCalledTimes(3);
    }, 10000);
  });

  describe('webhook signature isolation between merchants', () => {
    function sign(secret: string, body: Buffer): string {
      return createHmac('sha256', secret).update(body).digest('hex');
    }

    const rawBody = Buffer.from(JSON.stringify({ event: 'payment.failed' }));

    it('accepts a signature computed with the shared/global secret on the global route', () => {
      const signature = sign('global_webhook_secret', rawBody);

      expect(service.verifyWebhookSignature(rawBody, signature)).toBe(true);
    });

    it("accepts a signature computed with merchant A's own secret when checked against merchant A", async () => {
      (prisma.merchant.findUnique as jest.Mock).mockResolvedValue({
        razorpayWebhookSecretEncrypted: credentialEncryption.encrypt(
          'merchant-a-webhook-secret',
        ),
      });

      const signature = sign('merchant-a-webhook-secret', rawBody);

      await expect(
        service.verifyWebhookSignatureForMerchant(rawBody, signature, 'merchant-a'),
      ).resolves.toBe(true);
    });

    it("rejects a signature computed with merchant A's secret when checked against merchant B — this is the actual cross-merchant isolation guarantee", async () => {
      (prisma.merchant.findUnique as jest.Mock).mockResolvedValue({
        razorpayWebhookSecretEncrypted: credentialEncryption.encrypt(
          'merchant-b-webhook-secret',
        ),
      });

      const signatureSignedByMerchantA = sign('merchant-a-webhook-secret', rawBody);

      await expect(
        service.verifyWebhookSignatureForMerchant(
          rawBody,
          signatureSignedByMerchantA,
          'merchant-b',
        ),
      ).resolves.toBe(false);
    });

    it("falls back to the global secret for a merchant who hasn't configured their own webhook secret", async () => {
      (prisma.merchant.findUnique as jest.Mock).mockResolvedValue({
        razorpayWebhookSecretEncrypted: null,
      });

      const signature = sign('global_webhook_secret', rawBody);

      await expect(
        service.verifyWebhookSignatureForMerchant(rawBody, signature, 'merchant-fashionkart'),
      ).resolves.toBe(true);
    });

    it('rejects a garbage/missing signature outright', () => {
      expect(service.verifyWebhookSignature(rawBody, undefined)).toBe(false);
      expect(service.verifyWebhookSignature(rawBody, 'not-a-real-signature')).toBe(
        false,
      );
    });
  });
});
