import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RazorpayService } from '../razorpay/razorpay.service';
import { MandatesService } from './mandates.service';

describe('MandatesService.delete', () => {
  let service: MandatesService;

  const tx = {
    recoveryCase: { findMany: jest.fn(), deleteMany: jest.fn() },
    auditLog: { deleteMany: jest.fn() },
    mandate: { delete: jest.fn() },
  };

  const prisma = {
    mandate: { findUnique: jest.fn() },
    $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService;

  const razorpayService = {} as unknown as RazorpayService;

  beforeEach(() => {
    jest.clearAllMocks();
    tx.recoveryCase.findMany.mockResolvedValue([]);
    service = new MandatesService(prisma, razorpayService);
  });

  it("refuses to delete another merchant's mandate", async () => {
    (prisma.mandate.findUnique as jest.Mock).mockResolvedValue({
      id: 'mandate-1',
      merchantId: 'other-merchant',
    });

    await expect(
      service.delete('mandate-1', 'my-merchant'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('deletes any linked recovery case(s) before deleting the mandate itself', async () => {
    (prisma.mandate.findUnique as jest.Mock).mockResolvedValue({
      id: 'mandate-1',
      merchantId: 'my-merchant',
    });
    tx.recoveryCase.findMany.mockResolvedValue([{ id: 'case-1' }]);

    const result = await service.delete('mandate-1', 'my-merchant');

    expect(tx.recoveryCase.findMany).toHaveBeenCalledWith({
      where: { mandateId: 'mandate-1' },
      select: { id: true },
    });
    expect(tx.recoveryCase.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['case-1'] } },
    });
    expect(tx.mandate.delete).toHaveBeenCalledWith({
      where: { id: 'mandate-1' },
    });
    expect(result).toEqual({ deleted: true, id: 'mandate-1' });
  });
});
