import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string) {
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

    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found.`);
    }

    return customer;
  }
}