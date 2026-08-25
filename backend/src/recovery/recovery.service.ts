// RecoveryService is Database Orchestration

import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { RecoveryStrategyService } from './recovery-strategy.service';
import { SyntheticPaymentService } from '../payments/sythetic-payment.service';
import { SyntheticInvoiceService } from '../invoices/synthetic-invoice.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class RecoveryService {
  private readonly MAX_RECOVERY_ATTEMPTS = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly strategyService: RecoveryStrategyService,
    private readonly syntheticPaymentService: SyntheticPaymentService,
    private readonly syntheticInvoiceService: SyntheticInvoiceService,
    private readonly auditService: AuditService,
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

    try {
      /*
       * Three case shapes, one action loop: a payment failure is retried
       * on the Payment itself; checkout abandonment has no Payment yet
       * (recovery creates one); an overdue invoice is resolved on the
       * Invoice directly. See SyntheticPaymentService / SyntheticInvoiceService.
       */
      const result = recoveryCase.payment
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
      await this.prisma.recoveryAction.update({
        where: {
          id: action.id,
        },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          result: {
            successful: false,
            error: error instanceof Error ? error.message : 'Execution failed.',
          },
        },
      });

      throw error;
    }
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

    const recoveredPayment = recoveryCase.payment?.status === 'CAPTURED'
      ? recoveryCase.payment
      : orderPayment;

    const invoiceRecovered = recoveryCase.invoice?.status === 'PAID';

    const currentStatus = recoveredPayment
      ? recoveredPayment.status
      : recoveryCase.invoice?.status ?? recoveryCase.payment?.status ?? 'PENDING';

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
}
