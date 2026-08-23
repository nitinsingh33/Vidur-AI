import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PaymentStatus,
  RecoveryCaseStatus,
} from '../generated/prisma/enums';

import { PrismaService } from '../../prisma/prisma.service';
import { RiskEngineService } from './risk-engine.service';

@Injectable()
export class RiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly riskEngine: RiskEngineService,
  ) {}

  async assessPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
    });

    if (!payment) {
      throw new NotFoundException(
        `Payment ${paymentId} not found.`,
      );
    }

    if (payment.status !== PaymentStatus.FAILED) {
      throw new BadRequestException(
        `Payment ${paymentId} is not eligible for recovery risk assessment.`,
      );
    }

    const existingCase =
      await this.prisma.recoveryCase.findFirst({
        where: {
          paymentId: payment.id,
          status: {
            in: [
              RecoveryCaseStatus.OPEN,
              RecoveryCaseStatus.ELIGIBLE,
              RecoveryCaseStatus.IN_PROGRESS,
              RecoveryCaseStatus.ESCALATED,
            ],
          },
        },
      });

    if (existingCase) {
      return existingCase;
    }

    const [
      successfulPaymentCount,
      failedPaymentCount,
    ] = await Promise.all([
      this.prisma.payment.count({
        where: {
          customerId: payment.customerId,
          status: PaymentStatus.CAPTURED,
          id: {
            not: payment.id,
          },
        },
      }),

      this.prisma.payment.count({
        where: {
          customerId: payment.customerId,
          status: PaymentStatus.FAILED,
          id: {
            not: payment.id,
          },
        },
      }),
    ]);

    const assessment = this.riskEngine.assess({
      amount: Number(payment.amount),
      attemptNumber: payment.attemptNumber,
      successfulPaymentCount,
      failedPaymentCount,
    });

    const recoveryCase =
      await this.prisma.recoveryCase.create({
        data: {
          merchantId: payment.merchantId,
          customerId: payment.customerId,
          paymentId: payment.id,
          status: RecoveryCaseStatus.ELIGIBLE,
          riskLevel: assessment.riskLevel,
          revenueAtRisk: assessment.revenueAtRisk,
          recoveryProbability:
            assessment.recoveryProbability,
          rootCause:
            payment.failureReason ?? 'PAYMENT_FAILED',
        },
        include: {
          customer: true,
          payment: true,
          actions: true,
          outcome: true,
        },
      });

    return recoveryCase;
  }
}
