import { BadRequestException, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PromiseToPayService } from './promise-to-pay.service';

describe('PromiseToPayService', () => {
  let service: PromiseToPayService;

  const prisma = {
    recoveryCase: {
      findUnique: jest.fn(),
    },
    promiseToPay: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const auditService = {
    record: jest.fn(),
  } as unknown as AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PromiseToPayService(prisma, auditService);
  });

  function activeInvoiceCase(overrides: Record<string, unknown> = {}) {
    return {
      id: 'case-1',
      merchantId: 'merchant-1',
      customerId: 'customer-1',
      invoiceId: 'invoice-1',
      status: 'IN_PROGRESS',
      invoice: { id: 'invoice-1', status: 'OVERDUE', amount: '5000' },
      customer: { id: 'customer-1', name: 'Acme Co' },
      ...overrides,
    };
  }

  describe('create', () => {
    it('rejects a recovery case that belongs to a different merchant', async () => {
      (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(
        activeInvoiceCase({ merchantId: 'other-merchant' }),
      );

      await expect(
        service.create(
          'merchant-1',
          {
            recoveryCaseId: 'case-1',
            promisedAmount: 5000,
            promisedDate: new Date().toISOString(),
          },
          { id: 'user-1' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a case that has no invoice — Promise-to-Pay is a B2B receivables concept', async () => {
      (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(
        activeInvoiceCase({ invoiceId: null, invoice: null }),
      );

      await expect(
        service.create(
          'merchant-1',
          {
            recoveryCaseId: 'case-1',
            promisedAmount: 5000,
            promisedDate: new Date().toISOString(),
          },
          { id: 'user-1' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when the invoice is already paid', async () => {
      (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(
        activeInvoiceCase({ invoice: { id: 'invoice-1', status: 'PAID', amount: '5000' } }),
      );

      await expect(
        service.create(
          'merchant-1',
          {
            recoveryCaseId: 'case-1',
            promisedAmount: 5000,
            promisedDate: new Date().toISOString(),
          },
          { id: 'user-1' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when the case is terminal (e.g. EXHAUSTED)', async () => {
      (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(
        activeInvoiceCase({ status: 'EXHAUSTED' }),
      );

      await expect(
        service.create(
          'merchant-1',
          {
            recoveryCaseId: 'case-1',
            promisedAmount: 5000,
            promisedDate: new Date().toISOString(),
          },
          { id: 'user-1' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a second pending promise on the same case', async () => {
      (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(
        activeInvoiceCase(),
      );
      (prisma.promiseToPay.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-promise',
        status: 'PENDING',
      });

      await expect(
        service.create(
          'merchant-1',
          {
            recoveryCaseId: 'case-1',
            promisedAmount: 5000,
            promisedDate: new Date().toISOString(),
          },
          { id: 'user-1' },
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.promiseToPay.create).not.toHaveBeenCalled();
    });

    it('records a genuine promise and audits it as a HUMAN-captured event', async () => {
      (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(
        activeInvoiceCase(),
      );
      (prisma.promiseToPay.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.promiseToPay.create as jest.Mock).mockResolvedValue({
        id: 'promise-1',
        recoveryCaseId: 'case-1',
        invoiceId: 'invoice-1',
        customerId: 'customer-1',
        promisedAmount: 5000,
        status: 'PENDING',
      });

      const promisedDate = new Date(Date.now() + 60_000).toISOString();

      const result = await service.create(
        'merchant-1',
        { recoveryCaseId: 'case-1', promisedAmount: 5000, promisedDate },
        { id: 'user-1' },
      );

      expect(prisma.promiseToPay.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            merchantId: 'merchant-1',
            recoveryCaseId: 'case-1',
            invoiceId: 'invoice-1',
            customerId: 'customer-1',
            promisedAmount: 5000,
          }),
        }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PROMISE_TO_PAY_RECORDED',
          actorType: 'HUMAN',
          actorId: 'user-1',
        }),
      );
      expect(result.id).toBe('promise-1');
    });
  });
});
