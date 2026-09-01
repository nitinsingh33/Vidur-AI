import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RecoveryCasesService } from './recovery-cases.service';

describe('RecoveryCasesService.delete', () => {
  let service: RecoveryCasesService;

  const tx = {
    auditLog: { deleteMany: jest.fn() },
    recoveryCase: { deleteMany: jest.fn() },
  };

  const prisma = {
    recoveryCase: { findUnique: jest.fn() },
    $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RecoveryCasesService(prisma);
  });

  it('refuses to delete a case belonging to a different merchant', async () => {
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue({
      id: 'case-1',
      merchantId: 'other-merchant',
    });

    await expect(
      service.delete('case-1', 'my-merchant'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses to delete a case that does not exist', async () => {
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      service.delete('missing', 'my-merchant'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes the audit trail before the case itself, and returns the deleted id', async () => {
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue({
      id: 'case-1',
      merchantId: 'my-merchant',
    });

    const result = await service.delete('case-1', 'my-merchant');

    expect(tx.auditLog.deleteMany).toHaveBeenCalledWith({
      where: { recoveryCaseId: { in: ['case-1'] } },
    });
    expect(tx.recoveryCase.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['case-1'] } },
    });
    expect(result).toEqual({ deleted: true, id: 'case-1' });
  });
});
