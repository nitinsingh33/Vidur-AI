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
      update: jest.fn(),
      create: jest.fn(),
    },
    customer: {
      upsert: jest.fn(),
    },
    paymentEvent: {
      create: jest.fn(),
    },
    recoveryAction: {
      findFirst: jest.fn(),
    },
    recoveryOutcome: {
      create: jest.fn(),
    },
    recoveryCase: {
      update: jest.fn(),
    },
    order: {
      update: jest.fn(),
    },
    invoice: {
      update: jest.fn(),
    },
    $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
      callback(prisma),
    ),
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
      service.handleWebhook(undefined, 'sig', 'evt-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an invalid signature with 401 and never touches the database', async () => {
    (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(
      false,
    );

    await expect(
      service.handleWebhook(
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

    const result = await service.handleWebhook(
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

    const result = await service.handleWebhook(
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

    const result = await service.handleWebhook(
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

    const result = await service.handleWebhook(
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

    const result = await service.handleWebhook(
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

    const result = await service.handleWebhook(
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

    const result = await service.handleWebhook(
      signedBody(payloadUnresolvable),
      'valid-signature',
      'evt-5',
    );

    expect(paymentsService.create).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ received: true, processed: false }),
    );
  });

  describe('payment_link.paid', () => {
    const paidLinkPayload = {
      event: 'payment_link.paid',
      payload: {
        payment_link: {
          entity: { id: 'plink_test123', status: 'paid', short_url: 'https://rzp.io/i/abc' },
        },
        payment: {
          entity: { id: 'pay_link_test123', status: 'captured', amount: 2500000 },
        },
      },
    };

    it('captures the underlying payment and records a real recovery outcome', async () => {
      (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
      (prisma.recoveryAction.findFirst as jest.Mock).mockResolvedValue({
        id: 'action-1',
        recoveryCase: {
          id: 'case-1',
          merchantId: 'merchant-1',
          customerId: 'customer-1',
          orderId: null,
          invoiceId: null,
          status: 'IN_PROGRESS',
          outcome: null,
          payment: { id: 'payment-1', amount: '25000', orderId: null },
          order: null,
          invoice: null,
        },
      });

      const result = await service.handleWebhook(
        signedBody(paidLinkPayload),
        'valid-signature',
        'evt-link-1',
      );

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'payment-1' },
          data: expect.objectContaining({ status: 'CAPTURED' }),
        }),
      );
      expect(prisma.recoveryOutcome.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recoveryCaseId: 'case-1',
            recoveredAmount: 25000,
            successful: true,
          }),
        }),
      );
      expect(prisma.recoveryCase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'case-1' },
          data: expect.objectContaining({ status: 'RECOVERED' }),
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          received: true,
          processed: true,
          recoveryCaseId: 'case-1',
          recoveredAmount: 25000,
        }),
      );
    });

    it('acknowledges without processing an unrecognized payment link', async () => {
      (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
      (prisma.recoveryAction.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.handleWebhook(
        signedBody(paidLinkPayload),
        'valid-signature',
        'evt-link-2',
      );

      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({ received: true, processed: false }),
      );
    });

    it('is idempotent: a duplicate payment_link.paid for an already-recovered case is acknowledged without double-processing', async () => {
      (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
      (prisma.recoveryAction.findFirst as jest.Mock).mockResolvedValue({
        id: 'action-1',
        recoveryCase: {
          id: 'case-1',
          status: 'RECOVERED',
          outcome: { id: 'outcome-1' },
          payment: null,
          order: null,
          invoice: null,
        },
      });

      const result = await service.handleWebhook(
        signedBody(paidLinkPayload),
        'valid-signature',
        'evt-link-3',
      );

      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(prisma.recoveryOutcome.create).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          received: true,
          processed: false,
          duplicate: true,
          recoveryCaseId: 'case-1',
        }),
      );
    });
  });
});
