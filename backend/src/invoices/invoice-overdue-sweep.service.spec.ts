import { ModuleRef } from '@nestjs/core';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { RiskService } from '../risk/risk.service';
import { RecoveryAutoOrchestratorService } from '../recovery-auto/recovery-auto-orchestrator.service';
import { InvoiceOverdueSweepService } from './invoice-overdue-sweep.service';

describe('InvoiceOverdueSweepService', () => {
  let service: InvoiceOverdueSweepService;

  const queue = {
    upsertJobScheduler: jest.fn(),
  } as unknown as Queue;

  const prisma = {
    invoice: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const riskService = {
    assessInvoiceOverdue: jest.fn(),
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
    service = new InvoiceOverdueSweepService(
      queue,
      prisma,
      riskService,
      moduleRef,
    );
    await service.onModuleInit();
  });

  it('flips stale ISSUED invoices to OVERDUE and opens a case for each', async () => {
    (prisma.invoice.findMany as jest.Mock).mockResolvedValue([
      { id: 'invoice-1' },
      { id: 'invoice-2' },
    ]);
    (riskService.assessInvoiceOverdue as jest.Mock)
      .mockResolvedValueOnce({ id: 'case-1' })
      .mockResolvedValueOnce({ id: 'case-2' });

    const result = await service.sweepOnce();

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ISSUED',
          dueDate: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      }),
    );
    expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['invoice-1', 'invoice-2'] } },
      data: { status: 'OVERDUE' },
    });
    expect(riskService.assessInvoiceOverdue).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      scanned: 2,
      opened: 2,
      caseIds: ['case-1', 'case-2'],
    });
  });

  it('scopes the scan to one merchant when a merchantId is passed', async () => {
    (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);

    await service.sweepOnce('merchant-1');

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ merchantId: 'merchant-1' }),
      }),
    );
    expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
  });

  it('does nothing when no invoice is overdue', async () => {
    (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.sweepOnce();

    expect(riskService.assessInvoiceOverdue).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 0, opened: 0, caseIds: [] });
  });
});
