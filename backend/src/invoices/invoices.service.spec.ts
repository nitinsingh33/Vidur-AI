import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InvoicesService } from './invoices.service';

describe('InvoicesService.delete', () => {
  let service: InvoicesService;

  const tx = {
    recoveryCase: { findMany: jest.fn(), deleteMany: jest.fn() },
    auditLog: { deleteMany: jest.fn() },
    invoice: { delete: jest.fn() },
  };

  const prisma = {
    invoice: { findUnique: jest.fn() },
    $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService;

  const auditService = {} as unknown as AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    tx.recoveryCase.findMany.mockResolvedValue([]);
    service = new InvoicesService(prisma, auditService);
  });

  it("refuses to delete another merchant's invoice", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      id: 'invoice-1',
      merchantId: 'other-merchant',
    });

    await expect(
      service.delete('invoice-1', 'my-merchant'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('deletes any linked recovery case(s) — and their promises-to-pay via cascade — before deleting the invoice itself', async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      id: 'invoice-1',
      merchantId: 'my-merchant',
    });
    tx.recoveryCase.findMany.mockResolvedValue([{ id: 'case-1' }]);

    const result = await service.delete('invoice-1', 'my-merchant');

    expect(tx.recoveryCase.findMany).toHaveBeenCalledWith({
      where: { invoiceId: 'invoice-1' },
      select: { id: true },
    });
    expect(tx.recoveryCase.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['case-1'] } },
    });
    expect(tx.invoice.delete).toHaveBeenCalledWith({
      where: { id: 'invoice-1' },
    });
    expect(result).toEqual({ deleted: true, id: 'invoice-1' });
  });
});
