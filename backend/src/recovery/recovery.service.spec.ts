import { RecoveryActionType } from '../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { RecoveryService } from './recovery.service';
import { RecoveryStrategyService } from './recovery-strategy.service';
import { SyntheticPaymentService } from '../payments/sythetic-payment.service';
import { SyntheticInvoiceService } from '../invoices/synthetic-invoice.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';

describe('RecoveryService', () => {
  let service: RecoveryService;

  const prisma = {
    recoveryCase: {
      findUnique: jest.fn(),
    },
    recoveryAction: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  } as unknown as PrismaService;

  const syntheticPaymentService = {
    attemptRecovery: jest.fn(),
  } as unknown as SyntheticPaymentService;

  const syntheticInvoiceService = {
    attemptRecovery: jest.fn(),
  } as unknown as SyntheticInvoiceService;

  const auditService = {
    record: jest.fn(),
  } as unknown as AuditService;

  const notificationService = {
    sendRecoveryNotification: jest.fn(),
  } as unknown as NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new RecoveryService(
      prisma,
      new RecoveryStrategyService(),
      syntheticPaymentService,
      syntheticInvoiceService,
      notificationService,
      auditService,
    );
  });

  const testCases = [
    {
      rootCause: 'INSUFFICIENT_FUNDS',
      expectedAction: RecoveryActionType.RETRY_PAYMENT,
    },
    {
      rootCause: 'CARD_EXPIRED',
      expectedAction: RecoveryActionType.UPDATE_PAYMENT_METHOD,
    },
    {
      rootCause: 'CHECKOUT_ABANDONED',
      expectedAction: RecoveryActionType.SEND_PAYMENT_LINK,
    },
    {
      rootCause: 'INVOICE_OVERDUE',
      expectedAction: RecoveryActionType.FOLLOW_UP_RECEIVABLE,
    },
    {
      rootCause: 'REPEATED_FAILURE',
      expectedAction: RecoveryActionType.ESCALATE_HUMAN,
    },
  ];

  it.each(testCases)(
    'should create the correct action for $rootCause',
    async ({ rootCause, expectedAction }) => {
      prisma.recoveryCase.findUnique = jest.fn().mockResolvedValue({
        id: 'recovery-case-id',
        rootCause,
      });

      prisma.recoveryAction.findFirst = jest.fn().mockResolvedValue(null);

      prisma.recoveryAction.create = jest.fn().mockResolvedValue({
        id: 'action-id',
        recoveryCaseId: 'recovery-case-id',
        type: expectedAction,
        status: 'PENDING',
      });

      const result = await service.createStrategyForCase('recovery-case-id');

      expect(result.type).toBe(expectedAction);

      expect(prisma.recoveryAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recoveryCaseId: 'recovery-case-id',
            type: expectedAction,
            status: 'PENDING',
          }),
        }),
      );
    },
  );

  it('should return the existing active action instead of creating a duplicate', async () => {
    const existingAction = {
      id: 'existing-action-id',
      recoveryCaseId: 'recovery-case-id',
      type: RecoveryActionType.RETRY_PAYMENT,
      status: 'PENDING',
    };

    prisma.recoveryCase.findUnique = jest.fn().mockResolvedValue({
      id: 'recovery-case-id',
      rootCause: 'INSUFFICIENT_FUNDS',
    });

    prisma.recoveryAction.findFirst = jest
      .fn()
      .mockResolvedValue(existingAction);

    const result = await service.createStrategyForCase('recovery-case-id');

    expect(result).toEqual(existingAction);

    expect(prisma.recoveryAction.create).not.toHaveBeenCalled();
  });
});
