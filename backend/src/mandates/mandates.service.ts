import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RazorpayService } from '../razorpay/razorpay.service';
import { CreateMandateDto } from './dto/create-mandate.dto';

const DEFAULT_VALID_MONTHS = 36;

@Injectable()
export class MandatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayService: RazorpayService,
  ) {}

  findAllForMerchant(merchantId: string) {
    return this.prisma.mandate.findMany({
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
   * Registers a real Razorpay recurring mandate. Returns the registration
   * order id and key id — the frontend still has to complete the
   * authorization via Razorpay Checkout.js (recurring: true) before this
   * mandate can ever be charged.
   */
  async create(merchantId: string, dto: CreateMandateDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });

    if (!customer || customer.merchantId !== merchantId) {
      throw new NotFoundException(`Customer ${dto.customerId} not found.`);
    }

    const validForMonths = dto.validForMonths ?? DEFAULT_VALID_MONTHS;
    const expireAt = new Date();
    expireAt.setMonth(expireAt.getMonth() + validForMonths);

    return this.razorpayService.createMandateRegistrationOrder({
      merchantId,
      customer,
      maxAmount: dto.maxAmount,
      currency: dto.currency,
      method: dto.method ?? 'upi',
      frequency: dto.frequency,
      expireAt,
    });
  }

  async findOne(id: string, merchantId?: string) {
    const mandate = await this.prisma.mandate.findUnique({
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

    if (!mandate || (merchantId && mandate.merchantId !== merchantId)) {
      throw new NotFoundException(`Mandate ${id} not found.`);
    }

    return mandate;
  }
}
