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
import { EscalationService } from '../escalation/escalation.service';

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
      findFirst: jest.fn(),
    },
    customer: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
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
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    order: {
      update: jest.fn(),
    },
    invoice: {
      update: jest.fn(),
    },
    subscription: {
      update: jest.fn(),
    },
    mandate: {
      update: jest.fn(),
    },
    $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
      callback(prisma),
    ),
  } as unknown as PrismaService;

  const razorpayService = {
    verifyWebhookSignature: jest.fn(),
    getOrder: jest.fn(),
    findInternalOrderByExternalId: jest.fn().mockResolvedValue(null),
    findInternalSubscriptionByExternalId: jest.fn().mockResolvedValue(null),
    findInternalMandateByRegistrationOrderId: jest.fn().mockResolvedValue(null),
    findInternalMandateByExternalId: jest.fn().mockResolvedValue(null),
  } as unknown as RazorpayService;

  const paymentsService = {
    create: jest.fn(),
  } as unknown as PaymentsService;

  const riskService = {
    assessPayment: jest.fn(),
    assessSubscriptionFailure: jest.fn(),
    assessMandateFailure: jest.fn(),
  } as unknown as RiskService;

  const auditService = {
    record: jest.fn(),
  } as unknown as AuditService;

  const escalationService = {
    escalateRecoveryCase: jest.fn(),
  } as unknown as EscalationService;

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
      escalationService,
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
      service.handleWebhook(signedBody(validPayload), 'bad-signature', 'evt-1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(paymentsService.create).not.toHaveBeenCalled();
    expect(riskService.assessPayment).not.toHaveBeenCalled();
  });

  it('acknowledges but does not process an event outside the handled set', async () => {
    (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);

    const result = await service.handleWebhook(
      signedBody({ event: 'refund.processed', payload: {} }),
      'valid-signature',
      'evt-1',
    );

    expect(result).toEqual(
      expect.objectContaining({
        received: true,
        processed: false,
        event: 'refund.processed',
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

  it('trusts an order-linked customerId (e.g. a mandate debit) instead of re-deriving one from contact/email', async () => {
    (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);
    (
      razorpayService.findInternalOrderByExternalId as jest.Mock
    ).mockResolvedValue({
      id: 'internal-order-1',
      customerId: 'customer-known',
    });
    (prisma.customer.findUnique as jest.Mock).mockResolvedValue({
      id: 'customer-known',
      razorpayCustomerId: 'cust_alreadyKnown',
    });
    (paymentsService.create as jest.Mock).mockResolvedValue({
      id: 'payment-mandate-1',
    });
    (prisma.paymentEvent.create as jest.Mock).mockResolvedValue({});
    (riskService.assessPayment as jest.Mock).mockResolvedValue({
      id: 'case-mandate-debit',
      riskLevel: 'LOW',
    });

    await service.handleWebhook(
      signedBody(validPayload),
      'valid-signature',
      'evt-mandate-debit',
    );

    expect(prisma.customer.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'customer-known' } }),
    );
    expect(prisma.customer.upsert).not.toHaveBeenCalled();
    expect(paymentsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'customer-known' }),
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
          entity: {
            id: 'plink_test123',
            status: 'paid',
            short_url: 'https://rzp.io/i/abc',
          },
        },
        payment: {
          entity: {
            id: 'pay_link_test123',
            status: 'captured',
            amount: 2500000,
          },
        },
      },
    };

    it('captures the underlying payment and records a real recovery outcome', async () => {
      (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(
        true,
      );
      (prisma.recoveryAction.findFirst as jest.Mock).mockResolvedValue({
        id: 'action-1',
        recoveryCaseId: 'case-1',
        type: 'SEND_PAYMENT_LINK',
      });
      (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue({
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
            recoveryMethod: 'SEND_PAYMENT_LINK',
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
      (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(
        true,
      );
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
      (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(
        true,
      );
      (prisma.recoveryAction.findFirst as jest.Mock).mockResolvedValue({
        id: 'action-1',
        recoveryCaseId: 'case-1',
        type: 'SEND_PAYMENT_LINK',
      });
      (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue({
        id: 'case-1',
        status: 'RECOVERED',
        outcome: { id: 'outcome-1' },
        payment: null,
        order: null,
        invoice: null,
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

  describe('payment.captured', () => {
    const capturedPayload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_captured_1',
            order_id: 'order_test123',
            amount: 2500000,
            currency: 'INR',
            method: 'card',
            email: 'customer@example.com',
            notes: { merchantId: 'merchant-1' },
          },
        },
      },
    };

    it('records a direct/self-recovered payment and closes the matching open case', async () => {
      (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(
        true,
      );
      (
        razorpayService.findInternalOrderByExternalId as jest.Mock
      ).mockResolvedValue({ id: 'internal-order-1', status: 'CREATED' });
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.customer.upsert as jest.Mock).mockResolvedValue({
        id: 'customer-1',
      });
      (paymentsService.create as jest.Mock).mockResolvedValue({
        id: 'payment-captured-1',
      });
      (prisma.recoveryCase.findFirst as jest.Mock).mockResolvedValue({
        id: 'case-1',
      });
      (prisma.recoveryAction.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue({
        id: 'case-1',
        merchantId: 'merchant-1',
        status: 'ELIGIBLE',
        outcome: null,
        payment: null,
        order: { amount: '25000', currency: 'INR' },
        invoice: null,
        orderId: 'internal-order-1',
      });

      const result = await service.handleWebhook(
        signedBody(capturedPayload),
        'valid-signature',
        'evt-cap-1',
      );

      expect(paymentsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'CAPTURED',
          orderId: 'internal-order-1',
        }),
      );
      expect(prisma.recoveryOutcome.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recoveryMethod: null,
            successful: true,
          }),
        }),
      );
      expect(result).toEqual(expect.objectContaining({ processed: true }));
    });

    it('attributes the outcome to the originating action when the payment carries a recoveryCaseId note', async () => {
      const payloadWithCaseNote = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              ...capturedPayload.payload.payment.entity,
              notes: { merchantId: 'merchant-1', recoveryCaseId: 'case-noted' },
            },
          },
        },
      };

      (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(
        true,
      );
      (
        razorpayService.findInternalOrderByExternalId as jest.Mock
      ).mockResolvedValue(null);
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.customer.upsert as jest.Mock).mockResolvedValue({
        id: 'customer-1',
      });
      (paymentsService.create as jest.Mock).mockResolvedValue({
        id: 'payment-captured-2',
      });
      (prisma.recoveryCase.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 'case-noted' }) // noted-case existence check
        .mockResolvedValueOnce({
          id: 'case-noted',
          merchantId: 'merchant-1',
          status: 'IN_PROGRESS',
          outcome: null,
          payment: { id: 'payment-1', amount: '25000', orderId: null },
          order: null,
          invoice: null,
        }); // closeRecoveryCase's own fetch
      (prisma.recoveryAction.findFirst as jest.Mock).mockResolvedValue({
        type: 'RETRY_PAYMENT',
      });

      const result = await service.handleWebhook(
        signedBody(payloadWithCaseNote),
        'valid-signature',
        'evt-cap-2',
      );

      expect(prisma.recoveryOutcome.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ recoveryMethod: 'RETRY_PAYMENT' }),
        }),
      );
      expect(result).toEqual(expect.objectContaining({ processed: true }));
    });

    it('is idempotent for an already-captured payment', async () => {
      (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(
        true,
      );
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        id: 'payment-existing',
        status: 'CAPTURED',
        orderId: null,
      });

      const result = await service.handleWebhook(
        signedBody(capturedPayload),
        'valid-signature',
        'evt-cap-3',
      );

      expect(paymentsService.create).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({ processed: false, duplicate: true }),
      );
    });
  });

  describe('subscription webhooks', () => {
    const subscriptionPayload = (event: string) => ({
      event,
      payload: {
        subscription: {
          entity: {
            id: 'sub_test123',
            status: event === 'subscription.halted' ? 'halted' : 'pending',
            current_end: 1_800_000_000,
          },
        },
      },
    });

    it('subscription.pending opens a recovery case directly from the subscription', async () => {
      (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(
        true,
      );
      (
        razorpayService.findInternalSubscriptionByExternalId as jest.Mock
      ).mockResolvedValue({ id: 'subscription-1', merchantId: 'merchant-1' });
      (prisma.subscription.update as jest.Mock).mockResolvedValue({
        id: 'subscription-1',
        failedPaymentCount: 1,
      });
      (riskService.assessSubscriptionFailure as jest.Mock).mockResolvedValue({
        id: 'case-sub-1',
      });

      const result = await service.handleWebhook(
        signedBody(subscriptionPayload('subscription.pending')),
        'valid-signature',
        'evt-sub-pending',
      );

      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'subscription-1' },
          data: expect.objectContaining({ status: 'PAYMENT_FAILED' }),
        }),
      );
      expect(riskService.assessSubscriptionFailure).toHaveBeenCalledWith(
        'subscription-1',
      );
      expect(result).toEqual(
        expect.objectContaining({
          received: true,
          processed: true,
          recoveryCaseId: 'case-sub-1',
        }),
      );
    });

    it('subscription.charged closes an open case and resets the subscription failure state', async () => {
      (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(
        true,
      );
      (
        razorpayService.findInternalSubscriptionByExternalId as jest.Mock
      ).mockResolvedValue({ id: 'subscription-1', merchantId: 'merchant-1' });
      (prisma.recoveryCase.findFirst as jest.Mock).mockResolvedValue({
        id: 'case-sub-1',
      });
      (prisma.recoveryAction.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue({
        id: 'case-sub-1',
        merchantId: 'merchant-1',
        status: 'IN_PROGRESS',
        outcome: null,
        payment: null,
        order: null,
        invoice: null,
        subscriptionId: 'subscription-1',
        subscription: { amount: '999' },
      });

      const result = await service.handleWebhook(
        signedBody(subscriptionPayload('subscription.charged')),
        'valid-signature',
        'evt-sub-charged',
      );

      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'subscription-1' },
          data: { status: 'ACTIVE', failedPaymentCount: 0 },
        }),
      );
      expect(prisma.recoveryCase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'case-sub-1' },
          data: expect.objectContaining({ status: 'RECOVERED' }),
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({ received: true, processed: true }),
      );
    });

    it('subscription.halted escalates the case for human attention', async () => {
      (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(
        true,
      );
      (
        razorpayService.findInternalSubscriptionByExternalId as jest.Mock
      ).mockResolvedValue({ id: 'subscription-1', merchantId: 'merchant-1' });
      (prisma.recoveryCase.findFirst as jest.Mock).mockResolvedValue({
        id: 'case-sub-1',
        status: 'IN_PROGRESS',
      });
      (prisma.recoveryCase.update as jest.Mock).mockResolvedValue({
        id: 'case-sub-1',
      });

      const result = await service.handleWebhook(
        signedBody(subscriptionPayload('subscription.halted')),
        'valid-signature',
        'evt-sub-halted',
      );

      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'subscription-1' },
          data: { status: 'PAYMENT_FAILED' },
        }),
      );
      expect(escalationService.escalateRecoveryCase).toHaveBeenCalledWith(
        'case-sub-1',
        expect.any(String),
      );
      expect(result).toEqual(
        expect.objectContaining({
          received: true,
          processed: true,
          recoveryCaseId: 'case-sub-1',
        }),
      );
    });
  });

  describe('mandate webhooks', () => {
    it('token.confirmed activates the mandate and records the token id', async () => {
      (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(
        true,
      );
      (
        razorpayService.findInternalMandateByRegistrationOrderId as jest.Mock
      ).mockResolvedValue({
        id: 'mandate-1',
        merchantId: 'merchant-1',
        status: 'CREATED',
      });

      const payload = {
        event: 'token.confirmed',
        payload: {
          token: { entity: { id: 'token_test123' } },
          payment: { entity: { id: 'pay_auth1', order_id: 'order_reg1' } },
        },
      };

      const result = await service.handleWebhook(
        signedBody(payload),
        'valid-signature',
        'evt-token-confirmed',
      );

      expect(
        razorpayService.findInternalMandateByRegistrationOrderId,
      ).toHaveBeenCalledWith('order_reg1');
      expect(prisma.mandate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mandate-1' },
          data: { status: 'CONFIRMED', externalId: 'token_test123' },
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          received: true,
          processed: true,
          mandateId: 'mandate-1',
        }),
      );
    });

    it('token.rejected marks the mandate rejected and opens a case', async () => {
      (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(
        true,
      );
      (
        razorpayService.findInternalMandateByRegistrationOrderId as jest.Mock
      ).mockResolvedValue({ id: 'mandate-2', merchantId: 'merchant-1' });
      (riskService.assessMandateFailure as jest.Mock).mockResolvedValue({
        id: 'case-mandate-2',
      });

      const payload = {
        event: 'token.rejected',
        payload: {
          payment: { entity: { id: 'pay_auth2', order_id: 'order_reg2' } },
        },
      };

      const result = await service.handleWebhook(
        signedBody(payload),
        'valid-signature',
        'evt-token-rejected',
      );

      expect(prisma.mandate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mandate-2' },
          data: { status: 'REJECTED' },
        }),
      );
      expect(riskService.assessMandateFailure).toHaveBeenCalledWith(
        'mandate-2',
        'MANDATE_REGISTRATION_REJECTED',
      );
      expect(result).toEqual(
        expect.objectContaining({
          received: true,
          processed: true,
          recoveryCaseId: 'case-mandate-2',
        }),
      );
    });

    it('token.paused marks the mandate paused and opens a case', async () => {
      (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(
        true,
      );
      (
        razorpayService.findInternalMandateByExternalId as jest.Mock
      ).mockResolvedValue({ id: 'mandate-3', merchantId: 'merchant-1' });
      (riskService.assessMandateFailure as jest.Mock).mockResolvedValue({
        id: 'case-mandate-3',
      });

      const payload = {
        event: 'token.paused',
        payload: { token: { entity: { id: 'token_test456' } } },
      };

      const result = await service.handleWebhook(
        signedBody(payload),
        'valid-signature',
        'evt-token-paused',
      );

      expect(prisma.mandate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mandate-3' },
          data: { status: 'PAUSED' },
        }),
      );
      expect(riskService.assessMandateFailure).toHaveBeenCalledWith(
        'mandate-3',
        'MANDATE_PAUSED',
      );
      expect(result).toEqual(
        expect.objectContaining({
          received: true,
          processed: true,
          recoveryCaseId: 'case-mandate-3',
        }),
      );
    });

    it('token.cancelled marks the mandate cancelled and opens a case', async () => {
      (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(
        true,
      );
      (
        razorpayService.findInternalMandateByExternalId as jest.Mock
      ).mockResolvedValue({ id: 'mandate-4', merchantId: 'merchant-1' });
      (riskService.assessMandateFailure as jest.Mock).mockResolvedValue({
        id: 'case-mandate-4',
      });

      const payload = {
        event: 'token.cancelled',
        payload: { token: { entity: { id: 'token_test789' } } },
      };

      const result = await service.handleWebhook(
        signedBody(payload),
        'valid-signature',
        'evt-token-cancelled',
      );

      expect(prisma.mandate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mandate-4' },
          data: { status: 'CANCELLED' },
        }),
      );
      expect(riskService.assessMandateFailure).toHaveBeenCalledWith(
        'mandate-4',
        'MANDATE_CANCELLED',
      );
      expect(result).toEqual(
        expect.objectContaining({
          received: true,
          processed: true,
          recoveryCaseId: 'case-mandate-4',
        }),
      );
    });

    it('acknowledges without processing an unrecognized token', async () => {
      (razorpayService.verifyWebhookSignature as jest.Mock).mockReturnValue(
        true,
      );
      (
        razorpayService.findInternalMandateByExternalId as jest.Mock
      ).mockResolvedValue(null);

      const result = await service.handleWebhook(
        signedBody({
          event: 'token.paused',
          payload: { token: { entity: { id: 'token_unknown' } } },
        }),
        'valid-signature',
        'evt-token-unknown',
      );

      expect(prisma.mandate.update).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({ received: true, processed: false }),
      );
    });
  });
});
