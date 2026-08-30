// RecoveryService is Database Orchestration

import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { RecoveryStrategyService } from './recovery-strategy.service';
import { SyntheticPaymentService } from '../payments/sythetic-payment.service';
import { SyntheticInvoiceService } from '../invoices/synthetic-invoice.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { RazorpayService } from '../razorpay/razorpay.service';

@Injectable()
export class RecoveryService {
  private readonly MAX_RECOVERY_ATTEMPTS = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly strategyService: RecoveryStrategyService,
    private readonly syntheticPaymentService: SyntheticPaymentService,
    private readonly syntheticInvoiceService: SyntheticInvoiceService,
    private readonly notificationService: NotificationService,
    private readonly auditService: AuditService,
    private readonly razorpayService: RazorpayService,
  ) {}

  async getCaseById(recoveryCaseId: string) {
    const recoveryCase = await this.prisma.recoveryCase.findUnique({
      where: {
        id: recoveryCaseId,
      },
      include: {
        customer: true,
        payment: {
          include: {
            events: true,
          },
        },
        invoice: true,
        order: true,
        actions: true,
        outcome: true,
      },
    });

    if (!recoveryCase) {
      throw new NotFoundException(`Recovery case ${recoveryCaseId} not found.`);
    }

    return recoveryCase;
  }

  /**
   * Persists the LLM's narration of a case the deterministic strategy
   * service already decided on. Additive only — this never influences
   * which action gets taken, only explains it.
   */
  async recordDiagnosis(recoveryCaseId: string, reasoning: string) {
    const recoveryCase = await this.prisma.recoveryCase.update({
      where: { id: recoveryCaseId },
      data: { aiReasoning: reasoning },
    });

    await this.auditService.record({
      merchantId: recoveryCase.merchantId,
      recoveryCaseId: recoveryCase.id,
      action: 'AI_DIAGNOSIS_GENERATED',
      actorType: 'AGENT',
      details: { reasoning },
    });

    return recoveryCase;
  }

  async getMlFeatures(recoveryCaseId: string) {
    const recoveryCase = await this.prisma.recoveryCase.findUnique({
      where: {
        id: recoveryCaseId,
      },
      include: {
        payment: {
          include: {
            events: true,
          },
        },
      },
    });

    if (!recoveryCase) {
      throw new NotFoundException(`Recovery case ${recoveryCaseId} not found.`);
    }

    const customerId = recoveryCase.customerId;

    if (!customerId) {
      throw new NotFoundException(
        `Recovery case ${recoveryCaseId} has no customer.`,
      );
    }

    const historicalPayments = await this.prisma.payment.findMany({
      where: {
        customerId,
        ...(recoveryCase.paymentId && {
          id: {
            not: recoveryCase.paymentId,
          },
        }),
      },
      select: {
        id: true,
        amount: true,
        status: true,
      },
    });

    const previousSuccesses = historicalPayments.filter(
      (payment) => payment.status === 'CAPTURED',
    ).length;

    const previousFailures = historicalPayments.filter(
      (payment) => payment.status === 'FAILED',
    ).length;

    const customerValue = historicalPayments
      .filter((payment) => payment.status === 'CAPTURED')
      .reduce((total, payment) => total + Number(payment.amount), 0);

    const payment = recoveryCase.payment;

    if (!payment) {
      return {
        amount: Number(recoveryCase.revenueAtRisk),
        failure_reason: recoveryCase.invoiceId
          ? 'INVOICE_OVERDUE'
          : 'CHECKOUT_ABANDONED',
        payment_method: 'NONE',
        customer_history: historicalPayments.length,
        previous_failures: previousFailures,
        previous_successes: previousSuccesses,
        customer_value: Number(customerValue.toFixed(2)),
        retry_count: 0,
        retry_failed_events: 0,
      };
    }

    const retryFailedEvents = payment.events.filter(
      (event) => event.type === 'RETRY_FAILED',
    ).length;

    return {
      amount: Number(payment.amount),
      failure_reason: payment.failureReason ?? 'NONE',
      payment_method: payment.method,
      customer_history: historicalPayments.length,
      previous_failures: previousFailures,
      previous_successes: previousSuccesses,
      customer_value: Number(customerValue.toFixed(2)),
      retry_count: payment.attemptNumber,
      retry_failed_events: retryFailedEvents,
    };
  }

  async createStrategyForCase(recoveryCaseId: string) {
    const recoveryCase = await this.prisma.recoveryCase.findUnique({
      where: {
        id: recoveryCaseId,
      },
    });

    if (!recoveryCase) {
      throw new NotFoundException(`Recovery case ${recoveryCaseId} not found.`);
    }

    const strategy = this.strategyService.determine(recoveryCase.rootCause);

    const existingAction = await this.prisma.recoveryAction.findFirst({
      where: {
        recoveryCaseId: recoveryCase.id,
        type: strategy.actionType,
        status: {
          in: ['PENDING', 'APPROVED', 'EXECUTING'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (existingAction) {
      return existingAction;
    }

    const action = await this.prisma.recoveryAction.create({
      data: {
        recoveryCaseId: recoveryCase.id,
        type: strategy.actionType,
        status: 'PENDING',
        reason: strategy.reason,
      },
    });

    await this.auditService.record({
      merchantId: recoveryCase.merchantId,
      recoveryCaseId: recoveryCase.id,
      action: 'STRATEGY_SELECTED',
      actorType: 'AGENT',
      details: {
        actionId: action.id,
        actionType: strategy.actionType,
        rootCause: recoveryCase.rootCause,
        reason: strategy.reason,
      },
    });

    return action;
  }

  async executeRecoveryAction(recoveryCaseId: string) {
    const recoveryCase = await this.prisma.recoveryCase.findUnique({
      where: { id: recoveryCaseId },
      include: {
        payment: true,
        customer: true,
        order: true,
        invoice: true,
        actions: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!recoveryCase) {
      throw new NotFoundException(`Recovery case ${recoveryCaseId} not found.`);
    }

    if (
      recoveryCase.status === 'RECOVERED' ||
      recoveryCase.status === 'STOPPED' ||
      recoveryCase.status === 'ESCALATED' ||
      recoveryCase.status === 'EXHAUSTED'
    ) {
      throw new NotFoundException(
        `Recovery case ${recoveryCaseId} is already ${recoveryCase.status}.`,
      );
    }

    const action = recoveryCase.actions.find(
      (item) => item.status === 'PENDING',
    );

    if (!action) {
      throw new NotFoundException(
        `No pending recovery action found for case ${recoveryCaseId}.`,
      );
    }

    if (action.policyDecision !== 'ALLOW') {
      throw new NotFoundException(`Recovery action is not allowed by policy.`);
    }

    if (action.type === 'ESCALATE_HUMAN' || action.type === 'STOP_RECOVERY') {
      throw new NotFoundException(
        `${action.type} must be completed via the escalation endpoint, not /execute.`,
      );
    }

    const attemptsForAction = recoveryCase.actions.filter(
      (item) =>
        item.type === action.type &&
        ['EXECUTING', 'SUCCESS', 'FAILED'].includes(item.status),
    ).length;

    if (attemptsForAction >= this.MAX_RECOVERY_ATTEMPTS) {
      await this.prisma.recoveryCase.update({
        where: {
          id: recoveryCase.id,
        },
        data: {
          status: 'EXHAUSTED',
          closedAt: new Date(),
        },
      });

      await this.auditService.record({
        merchantId: recoveryCase.merchantId,
        recoveryCaseId: recoveryCase.id,
        action: 'RECOVERY_ACTION_BLOCKED',
        actorType: 'AGENT',
        details: {
          actionId: action.id,
          actionType: action.type,
          reason: `Attempt limit of ${this.MAX_RECOVERY_ATTEMPTS} reached.`,
        },
      });

      throw new NotFoundException(
        `Recovery attempt limit of ${this.MAX_RECOVERY_ATTEMPTS} reached for ${action.type}.`,
      );
    }

    if (
      !recoveryCase.payment &&
      !recoveryCase.orderId &&
      !recoveryCase.invoiceId
    ) {
      throw new NotFoundException(
        `Recovery case ${recoveryCaseId} has nothing to execute against.`,
      );
    }

    await this.prisma.recoveryAction.update({
      where: {
        id: action.id,
      },
      data: {
        status: 'EXECUTING',
        attemptedAt: new Date(),
      },
    });

    await this.prisma.recoveryCase.update({
      where: {
        id: recoveryCase.id,
      },
      data: {
        status: 'IN_PROGRESS',
      },
    });

    await this.auditService.record({
      merchantId: recoveryCase.merchantId,
      recoveryCaseId: recoveryCase.id,
      action: 'RECOVERY_ACTION_EXECUTION_STARTED',
      actorType: 'AGENT',
      details: {
        actionId: action.id,
        actionType: action.type,
      },
    });

    try {
      /*
       * SEND_EMAIL and SEND_PAYMENT_LINK are cross-cutting, real channels —
       * not tied to any one case shape, and not simulated. They're checked
       * first, ahead of the shape-based branches below. Everything else
       * stays simulated: three case shapes, one action loop — a payment
       * failure is retried on the Payment itself; checkout abandonment has
       * no Payment yet (recovery creates one); an overdue invoice is
       * resolved on the Invoice directly. See SyntheticPaymentService /
       * SyntheticInvoiceService.
       *
       * SEND_PAYMENT_LINK creates and sends a real Razorpay Payment Link
       * (RazorpayService.createPaymentLink) but deliberately does NOT touch
       * Payment/Order/Invoice status — a link being sent is not revenue
       * recovered. Only the payment_link.paid webhook
       * (RazorpayWebhookService) is allowed to do that, once the customer
       * has actually paid.
       */
      const result =
        action.type === 'SEND_EMAIL'
          ? await this.sendRecoveryEmail(recoveryCase, action)
          : action.type === 'SEND_PAYMENT_LINK'
            ? await this.sendPaymentLink(recoveryCase, action)
            : recoveryCase.payment
              ? await this.syntheticPaymentService.attemptRecovery(
                  recoveryCase.payment.id,
                  action.type,
                )
              : recoveryCase.orderId
                ? await this.syntheticPaymentService.attemptCheckoutRecovery(
                    recoveryCase.orderId,
                    action.type,
                  )
                : await this.syntheticInvoiceService.attemptRecovery(
                    recoveryCase.invoiceId as string,
                    action.type,
                  );

      const paymentLinkId = (result as { paymentLinkId?: string })
        .paymentLinkId;
      const paymentLinkShortUrl = (
        result as { paymentLinkShortUrl?: string }
      ).paymentLinkShortUrl;

      const completedAction = await this.prisma.recoveryAction.update({
        where: {
          id: action.id,
        },
        data: {
          status: result.successful ? 'SUCCESS' : 'FAILED',
          completedAt: new Date(),
          result: {
            ...result,
          },
          ...(paymentLinkId
            ? {
                externalReferenceId: paymentLinkId,
                externalReferenceUrl: paymentLinkShortUrl ?? null,
              }
            : {}),
        },
      });

      let caseStatus: string = 'IN_PROGRESS';

      if (!result.successful) {
        const totalAttempts = attemptsForAction + 1;

        if (totalAttempts >= this.MAX_RECOVERY_ATTEMPTS) {
          await this.prisma.recoveryCase.update({
            where: {
              id: recoveryCase.id,
            },
            data: {
              status: 'EXHAUSTED',
              closedAt: new Date(),
            },
          });

          caseStatus = 'EXHAUSTED';
        }
      }

      await this.auditService.record({
        merchantId: recoveryCase.merchantId,
        recoveryCaseId: recoveryCase.id,
        action: 'RECOVERY_ACTION_EXECUTED',
        actorType: 'AGENT',
        details: {
          actionId: action.id,
          actionType: action.type,
          successful: result.successful,
          recoveredAmount: result.recoveredAmount,
          reason: result.reason,
          caseStatus,
        },
      });

      return completedAction;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Execution failed.';

      await this.prisma.recoveryAction.update({
        where: {
          id: action.id,
        },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          result: {
            successful: false,
            error: errorMessage,
          },
        },
      });

      await this.auditService.record({
        merchantId: recoveryCase.merchantId,
        recoveryCaseId: recoveryCase.id,
        action: 'RECOVERY_ACTION_EXECUTION_FAILED',
        actorType: 'AGENT',
        details: {
          actionId: action.id,
          actionType: action.type,
          error: errorMessage,
        },
      });

      throw error;
    }
  }

  /**
   * The one real (non-simulated) recovery channel: sends an actual email
   * via NotificationService/Resend. recoveredAmount is always 0 here —
   * sending an email doesn't itself capture money; observeRecovery still
   * independently decides "recovered" from the underlying payment/order/
   * invoice state, so this can't perturb that state machine.
   */
  private async sendRecoveryEmail(
    recoveryCase: {
      rootCause: string | null;
      revenueAtRisk: unknown;
      customer: { email: string | null } | null;
    },
    action: { type: string },
  ) {
    const email = recoveryCase.customer?.email;

    if (!email) {
      return {
        successful: false,
        recoveredAmount: 0,
        reason: 'Customer has no email on file.',
        message: 'Customer has no email on file.',
        channel: action.type,
      };
    }

    const subject = 'Action needed to complete your payment';
    const message =
      `We noticed an issue with a recent transaction` +
      `${recoveryCase.rootCause ? ` (${recoveryCase.rootCause.toLowerCase().replaceAll('_', ' ')})` : ''}. ` +
      `Please review and complete your payment at your earliest convenience.`;

    await this.notificationService.sendRecoveryNotification(
      email,
      subject,
      message,
    );

    return {
      successful: true,
      recoveredAmount: 0,
      reason: 'Recovery email sent via Resend.',
      message: 'Recovery email sent via Resend.',
      channel: action.type,
    };
  }

  /**
   * The other real (non-simulated) recovery channel: creates and sends an
   * actual Razorpay Test/Live Mode Payment Link. Like sendRecoveryEmail,
   * recoveredAmount is always 0 here — creating/sending a link isn't
   * revenue recovered. Only RazorpayWebhookService, on a genuine
   * payment_link.paid event, is allowed to capture the underlying
   * Payment/Order/Invoice.
   */
  private async sendPaymentLink(
    recoveryCase: {
      id: string;
      merchantId: string;
      customer: { name: string; email: string | null; phone: string | null } | null;
      payment: { amount: unknown } | null;
      order: { amount: unknown } | null;
      invoice: { amount: unknown } | null;
    },
    action: { type: string },
  ) {
    const customer = recoveryCase.customer;

    if (!customer?.email && !customer?.phone) {
      return {
        successful: false,
        recoveredAmount: 0,
        reason: 'Customer has no email or phone on file; cannot send a payment link.',
        message: 'Customer has no email or phone on file; cannot send a payment link.',
        channel: action.type,
      };
    }

    const amount = Number(
      recoveryCase.payment?.amount ??
        recoveryCase.order?.amount ??
        recoveryCase.invoice?.amount ??
        0,
    );

    if (!(amount > 0)) {
      return {
        successful: false,
        recoveredAmount: 0,
        reason: 'No positive amount available to create a payment link for.',
        message: 'No positive amount available to create a payment link for.',
        channel: action.type,
      };
    }

    const link = await this.razorpayService.createPaymentLink({
      amount,
      description: 'Complete your payment — Vidur AI recovery',
      customerName: customer.name,
      customerEmail: customer.email ?? undefined,
      customerPhone: customer.phone ?? undefined,
      recoveryCaseId: recoveryCase.id,
      merchantId: recoveryCase.merchantId,
    });

    return {
      successful: true,
      recoveredAmount: 0,
      reason: `Payment link created and sent (${link.short_url}).`,
      message: `Payment link created and sent (${link.short_url}).`,
      channel: action.type,
      paymentLinkId: link.id,
      paymentLinkShortUrl: link.short_url,
    };
  }

  async observeRecovery(recoveryCaseId: string) {
    const recoveryCase = await this.prisma.recoveryCase.findUnique({
      where: {
        id: recoveryCaseId,
      },
      include: {
        payment: true,
        invoice: true,
        actions: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        outcome: true,
      },
    });

    if (!recoveryCase) {
      throw new NotFoundException(`Recovery case ${recoveryCaseId} not found.`);
    }

    if (recoveryCase.outcome) {
      return recoveryCase.outcome;
    }

    if (
      !recoveryCase.payment &&
      !recoveryCase.orderId &&
      !recoveryCase.invoiceId
    ) {
      throw new NotFoundException(
        `Recovery case ${recoveryCaseId} has nothing to observe.`,
      );
    }

    /*
     * Same three case shapes as executeRecoveryAction: a payment case is
     * recovered once its Payment is CAPTURED; a checkout-abandonment case
     * is recovered once a Payment now exists (created for the first time
     * on success) and is CAPTURED; an invoice case is recovered once the
     * Invoice itself is PAID.
     */
    const orderPayment = recoveryCase.orderId
      ? await this.prisma.payment.findFirst({
          where: { orderId: recoveryCase.orderId, status: 'CAPTURED' },
        })
      : null;

    const recoveredPayment =
      recoveryCase.payment?.status === 'CAPTURED'
        ? recoveryCase.payment
        : orderPayment;

    const invoiceRecovered = recoveryCase.invoice?.status === 'PAID';

    const currentStatus = recoveredPayment
      ? recoveredPayment.status
      : (recoveryCase.invoice?.status ??
        recoveryCase.payment?.status ??
        'PENDING');

    if (recoveredPayment || invoiceRecovered) {
      const successfulAction = recoveryCase.actions.find(
        (action) => action.status === 'SUCCESS',
      );

      if (!successfulAction) {
        throw new NotFoundException(
          `Case is recovered but no successful recovery action exists for case ${recoveryCaseId}.`,
        );
      }

      const recoveredAmount = recoveredPayment
        ? Number(recoveredPayment.amount)
        : Number(recoveryCase.invoice?.amount ?? 0);

      const outcome = await this.prisma.recoveryOutcome.create({
        data: {
          recoveryCaseId: recoveryCase.id,
          recoveredAmount,
          successful: true,
          recoveryMethod: successfulAction.type,
          recoveredAt: new Date(),
        },
      });

      await this.prisma.recoveryCase.update({
        where: {
          id: recoveryCase.id,
        },
        data: {
          status: 'RECOVERED',
          closedAt: new Date(),
        },
      });

      await this.auditService.record({
        merchantId: recoveryCase.merchantId,
        recoveryCaseId: recoveryCase.id,
        action: 'RECOVERY_SUCCEEDED',
        actorType: 'AGENT',
        details: {
          recoveredAmount,
          recoveryMethod: successfulAction.type,
        },
      });

      return outcome;
    }

    /*
     * Payment is still not recovered.
     * Do not throw here — the agent needs this observation
     * to decide whether another bounded attempt is possible.
     */
    /*
     * Bound attempts per action type, not just RETRY_PAYMENT — once
     * other channels can genuinely fail (see SyntheticPaymentService),
     * a strategy that keeps failing must still converge to a stop.
     */
    const lastAttemptedAction = recoveryCase.actions.find((action) =>
      ['EXECUTING', 'SUCCESS', 'FAILED'].includes(action.status),
    );

    const attemptsUsed = lastAttemptedAction
      ? recoveryCase.actions.filter(
          (action) =>
            action.type === lastAttemptedAction.type &&
            ['EXECUTING', 'SUCCESS', 'FAILED'].includes(action.status),
        ).length
      : 0;

    const attemptsRemaining = Math.max(
      this.MAX_RECOVERY_ATTEMPTS - attemptsUsed,
      0,
    );

    if (attemptsRemaining === 0 && recoveryCase.status !== 'EXHAUSTED') {
      await this.prisma.recoveryCase.update({
        where: {
          id: recoveryCase.id,
        },
        data: {
          status: 'EXHAUSTED',
          closedAt: new Date(),
        },
      });

      await this.auditService.record({
        merchantId: recoveryCase.merchantId,
        recoveryCaseId: recoveryCase.id,
        action: 'RECOVERY_EXHAUSTED',
        actorType: 'AGENT',
        details: {
          attemptsUsed,
          maxAttempts: this.MAX_RECOVERY_ATTEMPTS,
          paymentStatus: currentStatus,
        },
      });
    } else {
      await this.auditService.record({
        merchantId: recoveryCase.merchantId,
        recoveryCaseId: recoveryCase.id,
        action: 'RECOVERY_ATTEMPT_OBSERVED',
        actorType: 'AGENT',
        details: {
          attemptsUsed,
          attemptsRemaining,
          paymentStatus: currentStatus,
        },
      });
    }

    return {
      recoveryCaseId: recoveryCase.id,
      successful: false,
      paymentStatus: currentStatus,
      attemptsUsed,
      maxAttempts: this.MAX_RECOVERY_ATTEMPTS,
      attemptsRemaining,
      shouldRetry: attemptsRemaining > 0,
      shouldStop: attemptsRemaining === 0,
    };
  }

  /**
   * Browser-facing entry point for "Run Full Agent Recovery". The agent
   * service itself has no auth of its own and isn't publicly reachable in
   * production (see deployment plan) — this is the one door a merchant's
   * JWT can walk through to trigger it, mirroring what
   * RecoveryQueueProcessor already does for the batch path.
   */
  async runAgent(recoveryCaseId: string) {
    const agentServiceUrl =
      process.env.AGENT_SERVICE_URL ?? 'http://localhost:8001';

    const response = await fetch(`${agentServiceUrl}/run-recovery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recovery_case_id: recoveryCaseId }),
    });

    if (!response.ok) {
      const errorBody = await response.text();

      throw new InternalServerErrorException(
        `Agent recovery request failed: ${response.status} ${errorBody}`,
      );
    }

    return response.json();
  }
}
