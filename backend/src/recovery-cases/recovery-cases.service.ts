import { Injectable, NotFoundException } from '@nestjs/common';
import { RecoveryCaseStatus, RiskLevel } from '../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RecoveryCasesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: {
    merchantId?: string;
    status?: RecoveryCaseStatus;
    riskLevel?: RiskLevel;
    rootCause?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);

    const where = {
      ...(filters.merchantId && {
        merchantId: filters.merchantId,
      }),
      ...(filters.status && {
        status: filters.status,
      }),
      ...(filters.riskLevel && {
        riskLevel: filters.riskLevel,
      }),
      ...(filters.rootCause && {
        rootCause: filters.rootCause,
      }),
    };

    const [recoveryCases, total] = await Promise.all([
      this.prisma.recoveryCase.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          customer: true,
          payment: true,
          invoice: true,
          order: true,
          actions: {
            orderBy: {
              createdAt: 'desc',
            },
          },
          outcome: true,
        },
      }),

      this.prisma.recoveryCase.count({
        where,
      }),
    ]);

    return {
      data: recoveryCases,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const recoveryCase = await this.prisma.recoveryCase.findUnique({
      where: {
        id,
      },
      include: {
        customer: true,

        payment: {
          include: {
            events: {
              orderBy: {
                occurredAt: 'desc',
              },
            },
          },
        },

        invoice: true,

        order: true,

        actions: {
          orderBy: {
            createdAt: 'desc',
          },
        },

        outcome: true,
      },
    });

    if (!recoveryCase) {
      throw new NotFoundException(`Recovery case ${id} not found.`);
    }

    return recoveryCase;
  }
}
