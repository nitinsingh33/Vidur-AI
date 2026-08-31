import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ACTIVE_RECOVERY_CASE_STATUSES } from '../recovery/recovery-case-status.util';
import { CreatePromiseDto } from './dto/create-promise.dto';

const CASE_INCLUDE = {
  customer: true,
  invoice: true,
} as const;

/**
 * Promise-to-Pay as a first-class domain concept: a real commitment a real
 * B2B customer made, captured by a merchant only after a genuine
 * conversation about an overdue invoice (see `create` below) — never
 * predefined, never seeded. Verification of whether the promise was kept is
 * handled entirely by PromiseToPaySweepService, which never trusts this
 * record itself — only the linked RecoveryCase's real webhook/markPaid-
 * derived status.
 */
@Injectable()
export class PromiseToPayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAllForMerchant(merchantId: string) {
    return this.prisma.promiseToPay.findMany({
      where: { merchantId },
      orderBy: { promisedDate: 'asc' },
      include: {
        customer: true,
        invoice: true,
        recoveryCase: {
          include: {
            actions: { orderBy: { createdAt: 'desc' }, take: 1 },
            outcome: true,
          },
        },
      },
    });
  }

  async findOne(id: string, merchantId?: string) {
    const promise = await this.prisma.promiseToPay.findUnique({
      where: { id },
      include: {
        customer: true,
        invoice: true,
        recoveryCase: {
          include: {
            actions: { orderBy: { createdAt: 'desc' } },
            outcome: true,
          },
        },
      },
    });

    if (!promise || (merchantId && promise.merchantId !== merchantId)) {
      throw new NotFoundException(`Promise ${id} not found.`);
    }

    return promise;
  }

  /**
   * Records a genuine promise a merchant captured from a real conversation
   * with a customer about a specific overdue receivable. Deliberately scoped
   * to invoice-linked recovery cases — B2B receivables is the real-world
   * context this workflow exists for (see the Phase 9 spec: "overdue
   * invoice/receivable ... customer makes a genuine promise to pay").
   */
  async create(merchantId: string, dto: CreatePromiseDto, actor: { id: string }) {
    const recoveryCase = await this.prisma.recoveryCase.findUnique({
      where: { id: dto.recoveryCaseId },
      include: CASE_INCLUDE,
    });

    if (!recoveryCase || recoveryCase.merchantId !== merchantId) {
      throw new NotFoundException(
        `Recovery case ${dto.recoveryCaseId} not found.`,
      );
    }

    if (!recoveryCase.invoiceId || !recoveryCase.invoice) {
      throw new BadRequestException(
        'A promise to pay can only be recorded against an invoice-linked recovery case.',
      );
    }

    if (!recoveryCase.customerId) {
      throw new BadRequestException(
        'This recovery case has no customer to record a promise for.',
      );
    }

    if (recoveryCase.invoice.status === 'PAID') {
      throw new BadRequestException(
        'This invoice is already paid — there is nothing left to promise.',
      );
    }

    if (!ACTIVE_RECOVERY_CASE_STATUSES.includes(recoveryCase.status)) {
      throw new BadRequestException(
        `Recovery case is ${recoveryCase.status}; no further promise can be recorded.`,
      );
    }

    /*
     * One live promise per case at a time — a merchant must resolve (or wait
     * out) the existing pending promise before recording another, so the
     * sweep never has two competing commitments to reconcile for the same
     * receivable.
     */
    const existingPending = await this.prisma.promiseToPay.findFirst({
      where: { recoveryCaseId: recoveryCase.id, status: 'PENDING' },
    });

    if (existingPending) {
      throw new BadRequestException(
        'This case already has a pending promise — resolve it before recording another.',
      );
    }

    const promisedDate = new Date(dto.promisedDate);

    const promise = await this.prisma.promiseToPay.create({
      data: {
        merchantId,
        recoveryCaseId: recoveryCase.id,
        invoiceId: recoveryCase.invoiceId,
        customerId: recoveryCase.customerId,
        promisedAmount: dto.promisedAmount,
        promisedDate,
        notes: dto.notes ?? null,
      },
      include: { customer: true, invoice: true },
    });

    await this.auditService.record({
      merchantId,
      recoveryCaseId: recoveryCase.id,
      action: 'PROMISE_TO_PAY_RECORDED',
      actorType: 'HUMAN',
      actorId: actor.id,
      details: {
        promiseId: promise.id,
        promisedAmount: dto.promisedAmount,
        promisedDate: promisedDate.toISOString(),
        source: 'MERCHANT_RECORDED',
      },
    });

    return promise;
  }
}
