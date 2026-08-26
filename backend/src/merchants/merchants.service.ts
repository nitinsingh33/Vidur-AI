import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateMerchantDto } from './dto/update-merchant.dto';

@Injectable()
export class MerchantsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.merchant.findMany({
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  findOne(id: string) {
    return this.prisma.merchant.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        currency: true,
        createdAt: true,
      },
    });
  }

  update(id: string, dto: UpdateMerchantDto) {
    return this.prisma.merchant.update({
      where: { id },
      data: { name: dto.name },
      select: { id: true, name: true, email: true },
    });
  }
}
