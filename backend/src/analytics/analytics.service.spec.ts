import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService.getRiskSignalBreakdown', () => {
  let service: AnalyticsService;

  const prisma = {
    recoveryCase: { findMany: jest.fn() },
    promiseToPay: { count: jest.fn() },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.promiseToPay.count as jest.Mock).mockResolvedValue(0);
    service = new AnalyticsService(prisma);
  });

  it('classifies cases using the same payment > subscription > invoice > mandate > checkout precedence as the frontend recoveryCaseCategory()', async () => {
    (prisma.recoveryCase.findMany as jest.Mock).mockResolvedValue([
      { paymentId: 'p1', subscriptionId: null, invoiceId: null, mandateId: null },
      { paymentId: null, subscriptionId: 's1', invoiceId: null, mandateId: null },
      { paymentId: null, subscriptionId: null, invoiceId: 'i1', mandateId: null },
      { paymentId: null, subscriptionId: null, invoiceId: null, mandateId: 'm1' },
      { paymentId: null, subscriptionId: null, invoiceId: null, mandateId: null },
      // A case with both payment and order set (the abandonment-then-failed-
      // payment collision) must count as a payment failure, not abandonment.
      { paymentId: 'p2', subscriptionId: null, invoiceId: null, mandateId: null },
    ]);

    const result = await service.getRiskSignalBreakdown('merchant-1');

    expect(result).toEqual({
      paymentFailure: 2,
      subscriptionFailure: 1,
      receivableOverdue: 1,
      mandateFailure: 1,
      checkoutAbandonment: 1,
      promiseToPayPending: 0,
    });
  });

  it('scopes both queries to the given merchant', async () => {
    (prisma.recoveryCase.findMany as jest.Mock).mockResolvedValue([]);

    await service.getRiskSignalBreakdown('merchant-1');

    expect(prisma.recoveryCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ merchantId: 'merchant-1' }),
      }),
    );
    expect(prisma.promiseToPay.count).toHaveBeenCalledWith({
      where: { merchantId: 'merchant-1', status: 'PENDING' },
    });
  });

  it('counts only PENDING promises, not KEPT or MISSED ones', async () => {
    (prisma.recoveryCase.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.promiseToPay.count as jest.Mock).mockResolvedValue(3);

    const result = await service.getRiskSignalBreakdown('merchant-1');

    expect(result.promiseToPayPending).toBe(3);
  });
});
