import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RecoveryCasesService } from './recovery-cases.service';

describe('RecoveryCasesService — mandate relation included in reads', () => {
  // Regression test: findAll/findOne previously omitted `mandate` from their
  // Prisma `include`, so a real mandate-failure case silently rendered with
  // no mandate data on the case detail page even though the frontend already
  // has code to display it (RecoveryCaseDetails.tsx) and the category
  // classifier (recoveryCaseCategory()) depends on `mandate` being present
  // to correctly label the case as MANDATE_FAILURE instead of falling
  // through to CHECKOUT_ABANDONMENT.
  let service: RecoveryCasesService;

  const prisma = {
    recoveryCase: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue({ id: 'case-1', merchantId: 'm1' }),
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.recoveryCase.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.recoveryCase.count as jest.Mock).mockResolvedValue(0);
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue({
      id: 'case-1',
      merchantId: 'm1',
    });
    service = new RecoveryCasesService(prisma);
  });

  it('findAll includes the mandate relation', async () => {
    await service.findAll({});

    const call = (prisma.recoveryCase.findMany as jest.Mock).mock.calls[0][0];
    expect(call.include.mandate).toBe(true);
  });

  it('findOne includes the mandate relation', async () => {
    await service.findOne('case-1');

    const call = (prisma.recoveryCase.findUnique as jest.Mock).mock.calls[0][0];
    expect(call.include.mandate).toBe(true);
  });
});

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
