import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RazorpayService } from '../razorpay/razorpay.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { deleteRecoveryCasesCascade } from '../recovery/recovery-case-cleanup.util';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly razorpayService: RazorpayService,
  ) {}

  findAllForMerchant(merchantId: string) {
    return this.prisma.subscription.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        recoveryCases: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            actions: { orderBy: { createdAt: 'desc' } },
            outcome: true,
          },
        },
      },
    });
  }

  /**
   * Creates a real Razorpay Test/Live Mode recurring subscription. The
   * `shortUrl` in the result is where the customer completes the one-time
   * mandate authorization — Razorpay only begins auto-charging (and only
   * then can it ever fail) once that's done.
   */
  async create(merchantId: string, dto: CreateSubscriptionDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });

    if (!customer || customer.merchantId !== merchantId) {
      throw new NotFoundException(`Customer ${dto.customerId} not found.`);
    }

    const result = await this.razorpayService.createSubscription({
      merchantId,
      customerId: customer.id,
      amount: dto.amount,
      currency: dto.currency,
      period: dto.period,
      totalCount: dto.totalCount,
      customerName: customer.name,
      customerEmail: customer.email ?? undefined,
      customerPhone: customer.phone ?? undefined,
    });

    await this.auditService.record({
      merchantId,
      action: 'SUBSCRIPTION_CREATED',
      actorType: 'HUMAN',
      details: {
        subscriptionId: result.id,
        razorpaySubscriptionId: result.externalId,
        customerId: customer.id,
        amount: dto.amount,
      },
    });

    return result;
  }

  async findOne(id: string, merchantId?: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: {
        customer: true,
        recoveryCases: {
          orderBy: { createdAt: 'desc' },
          include: {
            actions: { orderBy: { createdAt: 'desc' } },
            outcome: true,
          },
        },
      },
    });

    if (
      !subscription ||
      (merchantId && subscription.merchantId !== merchantId)
    ) {
      throw new NotFoundException(`Subscription ${id} not found.`);
    }

    return subscription;
  }

  /**
   * Deletes this subscription plus any recovery case(s) opened against it —
   * a case left pointing at a deleted subscription would just be orphaned
   * clutter, not a meaningful case. Never touches Razorpay's own copy of
   * the subscription (there is no cancel/delete call to it here) — this
   * only clears Vidur's local record and its recovery history.
   */
  async delete(id: string, merchantId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      select: { id: true, merchantId: true },
    });

    if (!subscription || subscription.merchantId !== merchantId) {
      throw new NotFoundException(`Subscription ${id} not found.`);
    }

    await this.prisma.$transaction(async (tx) => {
      const cases = await tx.recoveryCase.findMany({
        where: { subscriptionId: id },
        select: { id: true },
      });

      await deleteRecoveryCasesCascade(
        tx,
        cases.map((item) => item.id),
      );

      await tx.subscription.delete({ where: { id } });
    });

    return { deleted: true, id };
  }
}
