import { ModuleRef } from '@nestjs/core';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { RiskService } from '../risk/risk.service';
import { RecoveryAutoOrchestratorService } from '../recovery-auto/recovery-auto-orchestrator.service';
import { CheckoutSweepService } from './checkout-sweep.service';

describe('CheckoutSweepService', () => {
  let service: CheckoutSweepService;

  const queue = {
    upsertJobScheduler: jest.fn(),
  } as unknown as Queue;

  const prisma = {
    order: {
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const riskService = {
    assessOrderAbandonment: jest.fn(),
  } as unknown as RiskService;

  const autoOrchestrator = {
    runAutomaticRecovery: jest.fn().mockResolvedValue(undefined),
  } as unknown as RecoveryAutoOrchestratorService;

  const moduleRef = {
    get: jest.fn().mockReturnValue(autoOrchestrator),
  } as unknown as ModuleRef;

  beforeEach(async () => {
    jest.clearAllMocks();
    (moduleRef.get as jest.Mock).mockReturnValue(autoOrchestrator);
    service = new CheckoutSweepService(queue, prisma, riskService, moduleRef);
    await service.onModuleInit();
  });

  it('only flags orders older than the grace period, not brand-new ones', async () => {
    (prisma.order.findMany as jest.Mock).mockResolvedValue([
      { id: 'order-1' },
      { id: 'order-2' },
    ]);
    (riskService.assessOrderAbandonment as jest.Mock)
      .mockResolvedValueOnce({ id: 'case-1' })
      .mockResolvedValueOnce({ id: 'case-2' });

    const result = await service.sweepOnce();

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'CREATED',
          createdAt: expect.objectContaining({ lte: expect.any(Date) }),
          payments: { none: {} },
        }),
      }),
    );

    // The cutoff must be in the past, not "right now" — otherwise every
    // order ever created would be flagged instantly.
    const cutoff = (prisma.order.findMany as jest.Mock).mock.calls[0][0].where
      .createdAt.lte as Date;
    expect(cutoff.getTime()).toBeLessThan(Date.now());

    expect(riskService.assessOrderAbandonment).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      scanned: 2,
      opened: 2,
      caseIds: ['case-1', 'case-2'],
    });
  });

  it('scopes the scan to one merchant when a merchantId is passed', async () => {
    (prisma.order.findMany as jest.Mock).mockResolvedValue([]);

    await service.sweepOnce('merchant-1');

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ merchantId: 'merchant-1' }),
      }),
    );
  });

  it('does not call the risk engine at all when nothing is stale', async () => {
    (prisma.order.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.sweepOnce();

    expect(riskService.assessOrderAbandonment).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 0, opened: 0, caseIds: [] });
  });
});
