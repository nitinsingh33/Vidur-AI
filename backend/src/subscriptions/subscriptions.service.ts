import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RazorpayService } from '../razorpay/razorpay.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

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
}
