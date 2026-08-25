import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface RecordAuditLogInput {
  merchantId: string;
  recoveryCaseId?: string | null;
  action: string;
  actorType: 'AGENT' | 'SYSTEM';
  actorId?: string | null;
  details?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: RecordAuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        merchantId: input.merchantId,
        recoveryCaseId: input.recoveryCaseId ?? null,
        action: input.action,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        details: (input.details as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }

  findByCase(recoveryCaseId: string) {
    return this.prisma.auditLog.findMany({
      where: { recoveryCaseId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
