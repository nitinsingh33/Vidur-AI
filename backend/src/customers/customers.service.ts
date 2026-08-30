import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  findAllForMerchant(merchantId: string) {
    return this.prisma.customer.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(merchantId: string, dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: {
        merchantId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
      },
    });
  }

  async findOne(id: string, merchantId?: string) {
    const customer = await this.prisma.customer.findUnique({
      where: {
        id,
      },
      include: {
        orders: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        payments: {
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            events: {
              orderBy: {
                occurredAt: 'desc',
              },
            },
          },
        },
        subscriptions: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        invoice: {
          orderBy: {
            createdAt: 'desc',
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

    if (!customer || (merchantId && customer.merchantId !== merchantId)) {
      throw new NotFoundException(`Customer ${id} not found.`);
    }

    return customer;
  }
}
