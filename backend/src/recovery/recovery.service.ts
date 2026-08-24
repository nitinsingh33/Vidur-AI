// RecoveryService is Database Orchestration

import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RecoveryActionStatus } from '../generated/prisma/enums';
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
      customer_value: Number(customerValue.toFixed(2)),
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
    customer_value: Number(customerValue.toFixed(2)),
    retry_count: payment.attemptNumber,
    retry_failed_events: retryFailedEvents,
  };
} 

  async createStrategyForCase(recoveryCaseId: string) {
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
}