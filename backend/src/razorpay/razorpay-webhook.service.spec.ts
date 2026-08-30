import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { RiskService } from '../risk/risk.service';
import { AuditService } from '../audit/audit.service';
import { RazorpayService } from './razorpay.service';
import { RazorpayWebhookService } from './razorpay-webhook.service';

function signedBody(payload: unknown) {
  return Buffer.from(JSON.stringify(payload));
}

describe('RazorpayWebhookService', () => {
  let service: RazorpayWebhookService;

  const prisma = {
    payment: {
      findUnique: jest.fn(),
    },
    customer: {
      upsert: jest.fn(),
    },
    paymentEvent: {
      create: jest.fn(),
    },
  } as unknown as PrismaService;

  const razorpayService = {
    verifyWebhookSignature: jest.fn(),
    getOrder: jest.fn(),
  } as unknown as RazorpayService;

  const paymentsService = {
    create: jest.fn(),
  } as unknown as PaymentsService;

  const riskService = {
    assessPayment: jest.fn(),
  } as unknown as RiskService;

  const auditService = {
    record: jest.fn(),
  } as unknown as AuditService;

  const validPayload = {
    event: 'payment.failed',
    payload: {
      payment: {
        entity: {
          id: 'pay_test123',
          order_id: 'order_test123',
          amount: 2500000,
          currency: 'INR',
          method: 'upi',
          email: 'customer@example.com',
          contact: '+919999999999',
          notes: { merchantId: 'merchant-1', customerName: 'Test Customer' },
          error_reason: 'insufficient_funds',
        },
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RazorpayWebhookService(
      prisma,
      razorpayService,
      paymentsService,
      riskService,
      auditService,
    );
  });

  it('rejects when the raw body is missing (cannot verify signature)', async () => {
    await expect(
      service.handlePaymentFailedWebhook(undefined, 'sig', 'evt-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an invalid signature with 401 and never touches the database', async () => {
    (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(
      false,
    );

    await expect(
      service.handlePaymentFailedWebhook(
        signedBody(validPayload),
        'bad-signature',
        'evt-1',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(paymentsService.create).not.toHaveBeenCalled();
    expect(riskService.assessPayment).not.toHaveBeenCalled();
  });

  it('acknowledges but does not process events other than payment.failed', async () => {
    (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);

    const result = await service.handlePaymentFailedWebhook(
      signedBody({ event: 'payment.captured', payload: {} }),
      'valid-signature',
      'evt-1',
    );

    expect(result).toEqual(
      expect.objectContaining({
        received: true,
        processed: false,
        event: 'payment.captured',
      }),
    );
    expect(paymentsService.create).not.toHaveBeenCalled();
  });

  it('acknowledges but does not process a malformed payload missing the payment entity', async () => {
    (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);

    const result = await service.handlePaymentFailedWebhook(
      signedBody({ event: 'payment.failed', payload: {} }),
      'valid-signature',
      'evt-1',
    );

    expect(result).toEqual(
      expect.objectContaining({ received: true, processed: false }),
    );
    expect(paymentsService.create).not.toHaveBeenCalled();
  });

  it('resolves the merchant from order notes, persists a FAILED payment, and triggers the real recovery pipeline', async () => {
    (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.customer.upsert as jest.Mock).mockResolvedValue({
      id: 'customer-1',
    });
    (paymentsService.create as jest.Mock).mockResolvedValue({
      id: 'payment-1',
    });
    (prisma.paymentEvent.create as jest.Mock).mockResolvedValue({});
    (riskService.assessPayment as jest.Mock).mockResolvedValue({
      id: 'case-1',
      riskLevel: 'HIGH',
    });

    const result = await service.handlePaymentFailedWebhook(
      signedBody(validPayload),
      'valid-signature',
      'evt-1',
    );

    expect(paymentsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'merchant-1',
        status: 'FAILED',
        externalId: 'pay_test123',
        failureReason: 'insufficient_funds',
      }),
    );
    expect(riskService.assessPayment).toHaveBeenCalledWith('payment-1');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'merchant-1',
        recoveryCaseId: 'case-1',
        action: 'RAZORPAY_PAYMENT_FAILED_WEBHOOK',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        received: true,
        processed: true,
        paymentId: 'payment-1',
        recoveryCaseId: 'case-1',
      }),
    );
  });

  it('is idempotent: a duplicate delivery for an already-processed payment is acknowledged without creating a second payment', async () => {
    (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
      id: 'payment-existing',
      recoveryCases: [{ id: 'case-existing' }],
    });

    const result = await service.handlePaymentFailedWebhook(
      signedBody(validPayload),
      'valid-signature',
      'evt-2',
    );

    expect(paymentsService.create).not.toHaveBeenCalled();
    expect(riskService.assessPayment).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        received: true,
        processed: false,
        duplicate: true,
        paymentId: 'payment-existing',
        recoveryCaseId: 'case-existing',
      }),
    );
  });

  it('is idempotent under a race: a concurrent duplicate delivery that loses the unique-constraint race is still acknowledged cleanly', async () => {
    (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    (prisma.payment.findUnique as jest.Mock)
      .mockResolvedValueOnce(null) // pre-create existence check
      .mockResolvedValueOnce({
        id: 'payment-raced',
        recoveryCases: [{ id: 'case-raced' }],
      }); // post-conflict lookup
    (prisma.customer.upsert as jest.Mock).mockResolvedValue({
      id: 'customer-1',
    });
    (paymentsService.create as jest.Mock).mockRejectedValue(
      new ConflictException(
        'A payment with this externalId already exists for this merchant.',
      ),
    );

    const result = await service.handlePaymentFailedWebhook(
      signedBody(validPayload),
      'valid-signature',
      'evt-3',
    );

    expect(riskService.assessPayment).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        received: true,
        processed: false,
        duplicate: true,
        paymentId: 'payment-raced',
        recoveryCaseId: 'case-raced',
      }),
    );
  });

  it('falls back to a live order lookup when the payment entity carries no notes', async () => {
    (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    (razorpayService.getOrder as jest.Mock).mockResolvedValue({
      id: 'order_test123',
      amount: 2500000,
      currency: 'INR',
      notes: { merchantId: 'merchant-from-order' },
    });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.customer.upsert as jest.Mock).mockResolvedValue({
      id: 'customer-1',
    });
    (paymentsService.create as jest.Mock).mockResolvedValue({
      id: 'payment-2',
    });
    (prisma.paymentEvent.create as jest.Mock).mockResolvedValue({});
    (riskService.assessPayment as jest.Mock).mockResolvedValue({
      id: 'case-2',
      riskLevel: 'MEDIUM',
    });

    const payloadWithoutNotes = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_test456',
            order_id: 'order_test123',
            amount: 2500000,
          },
        },
      },
    };

    const result = await service.handlePaymentFailedWebhook(
      signedBody(payloadWithoutNotes),
      'valid-signature',
      'evt-4',
    );

    expect(razorpayService.getOrder).toHaveBeenCalledWith('order_test123');
    expect(paymentsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ merchantId: 'merchant-from-order' }),
    );
    expect(result).toEqual(expect.objectContaining({ processed: true }));
  });

  it('acknowledges without processing when the merchant cannot be resolved at all', async () => {
    (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);

    const payloadUnresolvable = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: { id: 'pay_orphan', amount: 100 },
        },
      },
    };

    const result = await service.handlePaymentFailedWebhook(
      signedBody(payloadUnresolvable),
      'valid-signature',
      'evt-5',
    );

    expect(paymentsService.create).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ received: true, processed: false }),
    );
  });
});
