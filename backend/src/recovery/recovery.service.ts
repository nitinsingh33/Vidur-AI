// RecoveryService is Database Orchestration

import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { RecoveryStrategyService } from './recovery-strategy.service';
import { SyntheticPaymentService } from '../payments/sythetic-payment.service';

@Injectable()
export class RecoveryService {
  private readonly MAX_RECOVERY_ATTEMPTS = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly strategyService: RecoveryStrategyService,
    private readonly syntheticPaymentService: SyntheticPaymentService,
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
        actions: true,
        outcome: true,
      },
    });

    if (!recoveryCase) {
      throw new NotFoundException(`Recovery case ${recoveryCaseId} not found.`);
    }

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
        failure_reason: 'CHECKOUT_ABANDONED',
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

    return this.prisma.recoveryAction.create({
      data: {
        recoveryCaseId: recoveryCase.id,
        type: strategy.actionType,
        status: 'PENDING',
        reason: strategy.reason,
      },
    });
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

    const retryAttempts = recoveryCase.actions.filter(
      (item) =>
        item.type === 'RETRY_PAYMENT' &&
        ['EXECUTING', 'SUCCESS', 'FAILED'].includes(item.status),
    ).length;

    if (
      action.type === 'RETRY_PAYMENT' &&
      retryAttempts >= this.MAX_RECOVERY_ATTEMPTS
    ) {
      await this.prisma.recoveryCase.update({
        where: {
          id: recoveryCase.id,
        },
        data: {
          status: 'EXHAUSTED',
          closedAt: new Date(),
        },
      });

      throw new NotFoundException(
        `Recovery retry limit of ${this.MAX_RECOVERY_ATTEMPTS} attempts reached.`,
      );
    }

    if (!recoveryCase.payment) {
      throw new NotFoundException(
        `Recovery case ${recoveryCaseId} has no payment.`,
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
      const result = await this.syntheticPaymentService.retry(
        recoveryCase.payment.id,
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

      if (!result.successful) {
        const totalAttempts = retryAttempts + 1;

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
        }
      }

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

    if (!recoveryCase.payment) {
      throw new NotFoundException(
        `Recovery case ${recoveryCaseId} has no payment.`,
      );
    }

    /*
     * Recovery has succeeded only when the actual payment
     * is CAPTURED.
     */
    if (recoveryCase.payment.status === 'CAPTURED') {
      const successfulAction = recoveryCase.actions.find(
        (action) => action.status === 'SUCCESS',
      );

      if (!successfulAction) {
        throw new NotFoundException(
          `Payment is captured but no successful recovery action exists for case ${recoveryCaseId}.`,
        );
      }

      const recoveredAmount = Number(recoveryCase.payment.amount);

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

      return outcome;
    }

    /*
     * Payment is still not recovered.
     * Do not throw here — the agent needs this observation
     * to decide whether another bounded attempt is possible.
     */
    const retryAttempts = recoveryCase.actions.filter(
      (action) =>
        action.type === 'RETRY_PAYMENT' &&
        ['EXECUTING', 'SUCCESS', 'FAILED'].includes(action.status),
    ).length;

    const attemptsRemaining = Math.max(
      this.MAX_RECOVERY_ATTEMPTS - retryAttempts,
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
    }

    return {
      recoveryCaseId: recoveryCase.id,
      successful: false,
      paymentStatus: recoveryCase.payment.status,
      attemptsUsed: retryAttempts,
      maxAttempts: this.MAX_RECOVERY_ATTEMPTS,
      attemptsRemaining,
      shouldRetry: attemptsRemaining > 0,
      shouldStop: attemptsRemaining === 0,
    };
  }
}
