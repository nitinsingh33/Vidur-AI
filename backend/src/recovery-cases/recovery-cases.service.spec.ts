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
    payment: { deleteMany: jest.fn() },
    order: { deleteMany: jest.fn() },
    subscription: { deleteMany: jest.fn() },
    invoice: { deleteMany: jest.fn() },
    mandate: { deleteMany: jest.fn() },
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

  it('never deletes a real (non-demo) order/payment linked to the case', async () => {
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue({
      id: 'case-1',
      merchantId: 'my-merchant',
      order: { id: 'order-1', isDemoData: false },
      payment: null,
      subscription: null,
      invoice: null,
      mandate: null,
    });

    await service.delete('case-1', 'my-merchant');

    expect(tx.order.deleteMany).not.toHaveBeenCalled();
    expect(tx.payment.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes a demo checkout-abandonment case together with its now-orphaned Order, so the checkout sweep cannot resurrect it', async () => {
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue({
      id: 'case-1',
      merchantId: 'my-merchant',
      order: { id: 'order-1', isDemoData: true },
      payment: null,
      subscription: null,
      invoice: null,
      mandate: null,
    });

    await service.delete('case-1', 'my-merchant');

    expect(tx.order.deleteMany).toHaveBeenCalledWith({
      where: { id: 'order-1' },
    });
  });

  it('deletes a demo payment-failure case together with its Payment and the Order it belongs to', async () => {
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue({
      id: 'case-1',
      merchantId: 'my-merchant',
      order: null,
      payment: {
        id: 'payment-1',
        isDemoData: true,
        order: { id: 'order-1', isDemoData: true },
      },
      subscription: null,
      invoice: null,
      mandate: null,
    });

    await service.delete('case-1', 'my-merchant');

    expect(tx.payment.deleteMany).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
    });
    expect(tx.order.deleteMany).toHaveBeenCalledWith({
      where: { id: 'order-1' },
    });
  });

  it('deletes a demo subscription/invoice/mandate linked to the case', async () => {
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue({
      id: 'case-1',
      merchantId: 'my-merchant',
      order: null,
      payment: null,
      subscription: { id: 'sub-1', isDemoData: true },
      invoice: { id: 'invoice-1', isDemoData: true },
      mandate: { id: 'mandate-1', isDemoData: true },
    });

    await service.delete('case-1', 'my-merchant');

    expect(tx.subscription.deleteMany).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
    });
    expect(tx.invoice.deleteMany).toHaveBeenCalledWith({
      where: { id: 'invoice-1' },
    });
    expect(tx.mandate.deleteMany).toHaveBeenCalledWith({
      where: { id: 'mandate-1' },
    });
  });
});
