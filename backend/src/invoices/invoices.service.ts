import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { ACTIVE_RECOVERY_CASE_STATUSES } from '../recovery/recovery-case-status.util';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAllForMerchant(merchantId: string) {
    return this.prisma.invoice.findMany({
      where: { merchantId },
      orderBy: { dueDate: 'asc' },
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

  async create(merchantId: string, dto: CreateInvoiceDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });

    if (!customer || customer.merchantId !== merchantId) {
      throw new NotFoundException(`Customer ${dto.customerId} not found.`);
    }

    const invoice = await this.prisma.invoice.create({
      data: {
        merchantId,
        customerId: dto.customerId,
        amount: dto.amount,
        currency: dto.currency ?? 'INR',
        dueDate: new Date(dto.dueDate),
        status: 'ISSUED',
      },
      include: { customer: true },
    });

    await this.auditService.record({
      merchantId,
      action: 'INVOICE_CREATED',
      actorType: 'HUMAN',
      details: {
        invoiceId: invoice.id,
        customerId: dto.customerId,
        amount: dto.amount,
        dueDate: dto.dueDate,
      },
    });

    return invoice;
  }

  async findOne(id: string, merchantId?: string) {
    const invoice = await this.prisma.invoice.findUnique({
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

    if (!invoice || (merchantId && invoice.merchantId !== merchantId)) {
      throw new NotFoundException(`Invoice ${id} not found.`);
    }

    return invoice;
  }

  /**
   * B2B invoices are very often settled outside Razorpay entirely (bank
   * transfer, cheque, cash) — Vidur has no way to verify those the way it
   * verifies a Razorpay payment. This records the merchant's own assertion
   * about their own bank account, clearly attributed to a human in the
   * audit trail and distinct from a Razorpay-webhook-verified recovery
   * (recoveryMethod stays null, same convention as a customer paying
   * directly outside any Vidur-sent link — see RazorpayWebhookService).
   */
  async markPaid(id: string, merchantId: string, actor: { id: string }) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });

    if (!invoice || invoice.merchantId !== merchantId) {
      throw new NotFoundException(`Invoice ${id} not found.`);
    }

    if (invoice.status === 'PAID') {
      return invoice;
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
    });

    const activeCase = await this.prisma.recoveryCase.findFirst({
      where: { invoiceId: id, status: { in: ACTIVE_RECOVERY_CASE_STATUSES } },
      include: { outcome: true },
    });

    if (activeCase && !activeCase.outcome) {
      await this.prisma.recoveryOutcome.create({
        data: {
          recoveryCaseId: activeCase.id,
          recoveredAmount: invoice.amount,
          successful: true,
          recoveryMethod: null,
          recoveredAt: new Date(),
        },
      });

      await this.prisma.recoveryCase.update({
        where: { id: activeCase.id },
        data: { status: 'RECOVERED', closedAt: new Date() },
      });
    }

    await this.auditService.record({
      merchantId,
      recoveryCaseId: activeCase?.id ?? null,
      action: 'INVOICE_MARKED_PAID_MANUALLY',
      actorType: 'HUMAN',
      actorId: actor.id,
      details: {
        invoiceId: id,
        amount: Number(invoice.amount),
        source: 'merchant_recorded_outside_razorpay',
      },
    });

    return updated;
  }
}
