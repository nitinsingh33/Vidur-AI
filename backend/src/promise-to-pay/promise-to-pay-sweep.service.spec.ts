import { ModuleRef } from '@nestjs/core';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RecoveryAutoOrchestratorService } from '../recovery-auto/recovery-auto-orchestrator.service';
import { PromiseToPaySweepService } from './promise-to-pay-sweep.service';

describe('PromiseToPaySweepService', () => {
  let service: PromiseToPaySweepService;

  const queue = {
    upsertJobScheduler: jest.fn(),
  } as unknown as Queue;

  const prisma = {
    promiseToPay: {
      findMany: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as PrismaService;

  const auditService = {
    record: jest.fn(),
  } as unknown as AuditService;

  const autoOrchestrator = {
    runAutomaticRecovery: jest.fn().mockResolvedValue(undefined),
  } as unknown as RecoveryAutoOrchestratorService;

  const moduleRef = {
    get: jest.fn().mockReturnValue(autoOrchestrator),
  } as unknown as ModuleRef;

  beforeEach(async () => {
    jest.clearAllMocks();
    (prisma.promiseToPay.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (moduleRef.get as jest.Mock).mockReturnValue(autoOrchestrator);
    service = new PromiseToPaySweepService(queue, prisma, auditService, moduleRef);
    await service.onModuleInit();
  });

  function duePromise(overrides: Record<string, unknown> = {}) {
    return {
      id: 'promise-1',
      merchantId: 'merchant-1',
      recoveryCaseId: 'case-1',
      promisedAmount: '5000',
      recoveryCase: {
        id: 'case-1',
        status: 'IN_PROGRESS',
        outcome: null,
      },
      ...overrides,
    };
  }

  it('marks a promise KEPT and copies the real recoveredAmount when the case is genuinely RECOVERED — never trusting the promise itself', async () => {
    (prisma.promiseToPay.findMany as jest.Mock).mockResolvedValue([
      duePromise({
        recoveryCase: {
          id: 'case-1',
          status: 'RECOVERED',
          outcome: { recoveredAmount: '5000' },
        },
      }),
    ]);

    const result = await service.sweepOnce();

    expect(prisma.promiseToPay.updateMany).toHaveBeenCalledWith({
      where: { id: 'promise-1', status: 'PENDING' },
      data: expect.objectContaining({ status: 'KEPT', recoveredAmount: '5000' }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROMISE_TO_PAY_KEPT' }),
    );
    expect(autoOrchestrator.runAutomaticRecovery).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 1, kept: 1, missed: 0 });
  });

  it('marks a promise MISSED and hands the case back to the real automatic pipeline when the case is still active', async () => {
    (prisma.promiseToPay.findMany as jest.Mock).mockResolvedValue([duePromise()]);

    const result = await service.sweepOnce();

    expect(prisma.promiseToPay.updateMany).toHaveBeenCalledWith({
      where: { id: 'promise-1', status: 'PENDING' },
      data: expect.objectContaining({ status: 'MISSED' }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROMISE_TO_PAY_MISSED' }),
    );
    expect(autoOrchestrator.runAutomaticRecovery).toHaveBeenCalledWith('case-1');
    expect(result).toEqual({ scanned: 1, kept: 0, missed: 1 });
  });

  it('does not resume automatic recovery for a MISSED promise on an ESCALATED case — that is paused for a human', async () => {
    (prisma.promiseToPay.findMany as jest.Mock).mockResolvedValue([
      duePromise({ recoveryCase: { id: 'case-1', status: 'ESCALATED', outcome: null } }),
    ]);

    await service.sweepOnce();

    expect(autoOrchestrator.runAutomaticRecovery).not.toHaveBeenCalled();
  });

  it('does not resume automatic recovery for a MISSED promise on a terminal (STOPPED) case', async () => {
    (prisma.promiseToPay.findMany as jest.Mock).mockResolvedValue([
      duePromise({ recoveryCase: { id: 'case-1', status: 'STOPPED', outcome: null } }),
    ]);

    await service.sweepOnce();

    expect(autoOrchestrator.runAutomaticRecovery).not.toHaveBeenCalled();
  });

  it('is idempotent: a promise already claimed by a concurrent run (updateMany count 0) is not double-audited or double-followed-up', async () => {
    (prisma.promiseToPay.findMany as jest.Mock).mockResolvedValue([duePromise()]);
    (prisma.promiseToPay.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    const result = await service.sweepOnce();

    expect(auditService.record).not.toHaveBeenCalled();
    expect(autoOrchestrator.runAutomaticRecovery).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 1, kept: 0, missed: 0 });
  });

  it('scopes the scan to one merchant when a merchantId is passed', async () => {
    (prisma.promiseToPay.findMany as jest.Mock).mockResolvedValue([]);

    await service.sweepOnce('merchant-1');

    expect(prisma.promiseToPay.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ merchantId: 'merchant-1', status: 'PENDING' }),
      }),
    );
  });

  it('does nothing when no promise is due', async () => {
    (prisma.promiseToPay.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.sweepOnce();

    expect(result).toEqual({ scanned: 0, kept: 0, missed: 0 });
  });
});
