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
          mandate: true,
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

        mandate: true,

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
   * promises, audit log entries). For a real merchant's real transactional
   * data (isDemoData = false) the Order/Payment/Invoice/Subscription/
   * Mandate it was attached to is never touched — this is clearing
   * recovery-workflow clutter, not deleting a real payment record.
   *
   * For demo-tagged data (FashionKart's storefront checkout, Recovery Lab,
   * the live demo trigger) the linked entity is deleted too. Without this,
   * an order/payment that's still sitting there with no other recovery case
   * gets picked back up by the next checkout/invoice sweep and a
   * near-identical case reappears seconds after the merchant deleted it —
   * indistinguishable from "delete doesn't work" from the UI.
   */
  async delete(id: string, merchantId: string) {
    const recoveryCase = await this.prisma.recoveryCase.findUnique({
      where: { id },
      select: {
        id: true,
        merchantId: true,
        order: { select: { id: true, isDemoData: true } },
        payment: {
          select: {
            id: true,
            isDemoData: true,
            order: { select: { id: true, isDemoData: true } },
          },
        },
        subscription: { select: { id: true, isDemoData: true } },
        invoice: { select: { id: true, isDemoData: true } },
        mandate: { select: { id: true, isDemoData: true } },
      },
    });

    if (!recoveryCase || recoveryCase.merchantId !== merchantId) {
      throw new NotFoundException(`Recovery case ${id} not found.`);
    }

    const paymentId = recoveryCase.payment?.isDemoData
      ? recoveryCase.payment.id
      : null;

    const orderId = recoveryCase.order?.isDemoData
      ? recoveryCase.order.id
      : recoveryCase.payment?.order?.isDemoData
        ? recoveryCase.payment.order.id
        : null;

    const subscriptionId = recoveryCase.subscription?.isDemoData
      ? recoveryCase.subscription.id
      : null;

    const invoiceId = recoveryCase.invoice?.isDemoData
      ? recoveryCase.invoice.id
      : null;

    const mandateId = recoveryCase.mandate?.isDemoData
      ? recoveryCase.mandate.id
      : null;

    await this.prisma.$transaction(async (tx) => {
      await deleteRecoveryCasesCascade(tx, [id]);

      // Payment before Order: Payment.order is onDelete: SetNull, so
      // deleting the order first would only orphan the payment rather than
      // remove it.
      if (paymentId) {
        await tx.payment.deleteMany({ where: { id: paymentId } });
      }
      if (orderId) {
        await tx.order.deleteMany({ where: { id: orderId } });
      }
      if (subscriptionId) {
        await tx.subscription.deleteMany({ where: { id: subscriptionId } });
      }
      if (invoiceId) {
        await tx.invoice.deleteMany({ where: { id: invoiceId } });
      }
      if (mandateId) {
        await tx.mandate.deleteMany({ where: { id: mandateId } });
      }
    });

    return { deleted: true, id };
  }
}
