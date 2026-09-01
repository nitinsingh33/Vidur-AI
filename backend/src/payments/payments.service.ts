import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus } from '../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `options.isDemoData` is intentionally not part of CreatePaymentDto — it
   * must never be settable from a client request body (POST /payments is a
   * plain authenticated merchant endpoint). Only internal callers that
   * construct a Payment themselves (RecoveryLabService, DemoService) may
   * pass it; the public controller always calls create(dto) with no
   * options, so it defaults to false.
   */
  async create(
    dto: CreatePaymentDto,
    options?: { isDemoData?: boolean },
  ) {
    try {
      return await this.prisma.payment.create({
        data: {
          merchantId: dto.merchantId,
          customerId: dto.customerId,
          orderId: dto.orderId,
          amount: dto.amount,
          currency: dto.currency ?? 'INR',
          method: dto.method,
          status: dto.status,
          failureReason: dto.failureReason,
          attemptNumber: dto.attemptNumber ?? 1,
          externalId: dto.externalId,
          isDemoData: options?.isDemoData ?? false,
          events: {
            create: {
              type: dto.status === 'FAILED' ? 'FAILED' : 'CREATED',
              reason: dto.failureReason,
            },
          },
        },
        include: {
          customer: true,
          order: true,
          events: {
            orderBy: {
              occurredAt: 'desc',
            },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Unique constraint')
      ) {
        throw new ConflictException(
          'A payment with this externalId already exists for this merchant.',
        );
      }

      throw error;
    }
  }

  async findAll(filters: {
    merchantId?: string;
    customerId?: string;
    orderId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);

    const where = {
      ...(filters.merchantId && {
        merchantId: filters.merchantId,
      }),
      ...(filters.customerId && {
        customerId: filters.customerId,
      }),
      ...(filters.orderId && {
        orderId: filters.orderId,
      }),
      ...(filters.status && {
        status: filters.status as PaymentStatus,
      }),
    };

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          customer: true,
          order: true,
        },
      }),
      this.prisma.payment.count({
        where,
      }),
    ]);

    return {
      data: payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByExternalId(merchantId: string, externalId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: {
        merchantId_externalId: {
          merchantId,
          externalId,
        },
      },
      include: {
        customer: true,
        events: {
          orderBy: {
            occurredAt: 'desc',
          },
        },
        recoveryCases: {
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            actions: true,
            outcome: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(
        `Payment with externalId ${externalId} not found.`,
      );
    }

    return payment;
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: {
        id,
      },
      include: {
        customer: true,
        order: true,
        events: {
          orderBy: {
            occurredAt: 'desc',
          },
        },
        recoveryCases: {
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            actions: {
              orderBy: {
                createdAt: 'desc',
              },
            },
            outcome: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${id} not found.`);
    }

    return payment;
  }
}
