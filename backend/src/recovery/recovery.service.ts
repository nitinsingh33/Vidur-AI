// RecoveryService is Database Orchestration

import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { RecoveryStrategyService } from './recovery-strategy.service';

@Injectable()
export class RecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly strategyService: RecoveryStrategyService,
  ) {}

  async getCaseById(recoveryCaseId: string) {
    const recoveryCase =
      await this.prisma.recoveryCase.findUnique({
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
      throw new NotFoundException(
        `Recovery case ${recoveryCaseId} not found.`,
      );
    }

    return recoveryCase;
  }

  async getMlFeatures(recoveryCaseId: string) {
    const recoveryCase =
      await this.prisma.recoveryCase.findUnique({
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
      throw new NotFoundException(
        `Recovery case ${recoveryCaseId} not found.`,
      );
    }

    const customerId = recoveryCase.customerId;

    if (!customerId) {
      throw new NotFoundException(
        `Recovery case ${recoveryCaseId} has no customer.`,
      );
    }

    const historicalPayments =
      await this.prisma.payment.findMany({
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

    const previousSuccesses =
      historicalPayments.filter(
        (payment) => payment.status === 'CAPTURED',
      ).length;

    const previousFailures =
      historicalPayments.filter(
        (payment) => payment.status === 'FAILED',
      ).length;

    const customerValue =
      historicalPayments
        .filter(
          (payment) => payment.status === 'CAPTURED',
        )
        .reduce(
          (total, payment) =>
            total + Number(payment.amount),
          0,
        );

    const payment = recoveryCase.payment;

    if (!payment) {
      return {
        amount: Number(recoveryCase.revenueAtRisk),
        failure_reason: 'CHECKOUT_ABANDONED',
        payment_method: 'NONE',
        customer_history: historicalPayments.length,
        previous_failures: previousFailures,
        previous_successes: previousSuccesses,
        customer_value: Number(
          customerValue.toFixed(2),
        ),
        retry_count: 0,
        retry_failed_events: 0,
      };
    }

    const retryFailedEvents =
      payment.events.filter(
        (event) => event.type === 'RETRY_FAILED',
      ).length;

    return {
      amount: Number(payment.amount),
      failure_reason:
        payment.failureReason ?? 'NONE',
      payment_method: payment.method,
      customer_history: historicalPayments.length,
      previous_failures: previousFailures,
      previous_successes: previousSuccesses,
      customer_value: Number(
        customerValue.toFixed(2),
      ),
      retry_count: payment.attemptNumber,
      retry_failed_events: retryFailedEvents,
    };
  }

  async createStrategyForCase(
    recoveryCaseId: string,
  ) {
    const recoveryCase =
      await this.prisma.recoveryCase.findUnique({
        where: {
          id: recoveryCaseId,
        },
      });

    if (!recoveryCase) {
      throw new NotFoundException(
        `Recovery case ${recoveryCaseId} not found.`,
      );
    }

    const strategy = this.strategyService.determine(
      recoveryCase.rootCause,
    );

    const existingAction =
      await this.prisma.recoveryAction.findFirst({
        where: {
          recoveryCaseId: recoveryCase.id,
          type: strategy.actionType,
          status: {
            in: [
              'PENDING',
              'APPROVED',
              'EXECUTING',
            ],
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

  async executeRecoveryAction(
    recoveryCaseId: string,
  ) {
    const recoveryCase =
      await this.prisma.recoveryCase.findUnique({
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
        },
      });

    if (!recoveryCase) {
      throw new NotFoundException(
        `Recovery case ${recoveryCaseId} not found.`,
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

    if (action.type !== 'RETRY_PAYMENT') {
      throw new NotFoundException(
        `Execution for ${action.type} is not implemented yet.`,
      );
    }

    if (action.policyDecision !== 'ALLOW') {
      throw new NotFoundException(
        `Recovery action is not allowed by policy.`,
      );
    }

    const now = new Date();

    await this.prisma.recoveryAction.update({
      where: {
        id: action.id,
      },
      data: {
        status: 'EXECUTING',
        attemptedAt: now,
      },
    });

    if (!recoveryCase.payment) {
      throw new NotFoundException(
        `Recovery case ${recoveryCaseId} has no payment.`,
      );
    }

    await this.prisma.paymentEvent.create({
      data: {
        paymentId: recoveryCase.payment.id,
        type: 'RETRY_STARTED',
        reason:
          'Recovery retry execution started.',
      },
    });

    const completedAt = new Date();

    const completedAction =
      await this.prisma.recoveryAction.update({
        where: {
          id: action.id,
        },
        data: {
          status: 'SUCCESS',
          completedAt,
          result: {
            successful: true,
            message:
              'Synthetic payment retry succeeded.',
          },
        },
      });

    await this.prisma.paymentEvent.create({
      data: {
        paymentId: recoveryCase.payment.id,
        type: 'RETRY_SUCCEEDED',
        reason:
          'Synthetic payment retry succeeded.',
      },
    });

    return completedAction;
  }

  async observeRecovery(recoveryCaseId: string) {
  const recoveryCase =
    await this.prisma.recoveryCase.findUnique({
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
    throw new NotFoundException(
      `Recovery case ${recoveryCaseId} not found.`,
    );
  }

  if (recoveryCase.outcome) {
    return recoveryCase.outcome;
  }

  const successfulAction =
    recoveryCase.actions.find(
      (action) => action.status === 'SUCCESS',
    );

  if (!successfulAction) {
    throw new NotFoundException(
      `No successful recovery action found for case ${recoveryCaseId}.`,
    );
  }

  if (!recoveryCase.payment) {
    throw new NotFoundException(
      `Recovery case ${recoveryCaseId} has no payment.`,
    );
  }

  const recoveredAmount =
    Number(recoveryCase.payment.amount);

  const outcome =
    await this.prisma.recoveryOutcome.create({
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
}