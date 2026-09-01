import { Injectable, NotFoundException } from '@nestjs/common';
import { RecoveryCaseStatus, RiskLevel } from '../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { deleteRecoveryCasesCascade } from '../recovery/recovery-case-cleanup.util';

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
          subscription: true,
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

  async findOne(id: string, merchantId?: string) {
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

        subscription: true,

        actions: {
          orderBy: {
            createdAt: 'desc',
          },
        },

        outcome: true,
      },
    });

    if (
      !recoveryCase ||
      (merchantId && recoveryCase.merchantId !== merchantId)
    ) {
      throw new NotFoundException(`Recovery case ${id} not found.`);
    }

    return recoveryCase;
  }

  /**
   * Deletes exactly this one case and its dependents (actions, outcome,
   * promises, audit log entries) — never the Order/Payment/Invoice/
   * Subscription/Mandate it was attached to, which is real transactional
   * data independent of whether a recovery case exists for it.
   */
  async delete(id: string, merchantId: string) {
    const recoveryCase = await this.prisma.recoveryCase.findUnique({
      where: { id },
      select: { id: true, merchantId: true },
    });

    if (!recoveryCase || recoveryCase.merchantId !== merchantId) {
      throw new NotFoundException(`Recovery case ${id} not found.`);
    }

    await this.prisma.$transaction((tx) =>
      deleteRecoveryCasesCascade(tx, [id]),
    );

    return { deleted: true, id };
  }
}
