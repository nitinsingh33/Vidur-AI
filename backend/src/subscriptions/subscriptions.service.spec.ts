import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RazorpayService } from '../razorpay/razorpay.service';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService.delete', () => {
  let service: SubscriptionsService;

  const tx = {
    recoveryCase: { findMany: jest.fn(), deleteMany: jest.fn() },
    auditLog: { deleteMany: jest.fn() },
    subscription: { delete: jest.fn() },
  };

  const prisma = {
    subscription: { findUnique: jest.fn() },
    $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService;

  const auditService = {} as unknown as AuditService;
  const razorpayService = {} as unknown as RazorpayService;

  beforeEach(() => {
    jest.clearAllMocks();
    tx.recoveryCase.findMany.mockResolvedValue([]);
    service = new SubscriptionsService(prisma, auditService, razorpayService);
  });

  it("refuses to delete another merchant's subscription", async () => {
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      merchantId: 'other-merchant',
    });

    await expect(
      service.delete('sub-1', 'my-merchant'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('deletes any linked recovery case(s) before deleting the subscription itself', async () => {
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      merchantId: 'my-merchant',
    });
    tx.recoveryCase.findMany.mockResolvedValue([
      { id: 'case-1' },
      { id: 'case-2' },
    ]);

    const result = await service.delete('sub-1', 'my-merchant');

    expect(tx.recoveryCase.findMany).toHaveBeenCalledWith({
      where: { subscriptionId: 'sub-1' },
      select: { id: true },
    });
    expect(tx.recoveryCase.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['case-1', 'case-2'] } },
    });
    expect(tx.subscription.delete).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
    });
    expect(result).toEqual({ deleted: true, id: 'sub-1' });
  });

  it('deletes cleanly when no recovery case was ever opened for it', async () => {
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      merchantId: 'my-merchant',
    });

    await service.delete('sub-1', 'my-merchant');

    expect(tx.recoveryCase.deleteMany).not.toHaveBeenCalled();
    expect(tx.subscription.delete).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
    });
  });
});
