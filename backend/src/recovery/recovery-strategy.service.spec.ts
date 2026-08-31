import { RecoveryActionType } from '../generated/prisma/enums';
import { RecoveryStrategyService } from './recovery-strategy.service';

describe('RecoveryStrategyService', () => {
  let service: RecoveryStrategyService;

  beforeEach(() => {
    service = new RecoveryStrategyService();
  });

  it('should retry payment for insufficient funds', () => {
    const result = service.determine('insufficient_funds');

    expect(result.actionType).toBe(RecoveryActionType.RETRY_PAYMENT);
  });

  it('should request payment method update for an expired card', () => {
    const result = service.determine('card_expired');

    expect(result.actionType).toBe(RecoveryActionType.UPDATE_PAYMENT_METHOD);
  });

  it('should request payment method update for a bank decline', () => {
    const result = service.determine('bank_declined');

    expect(result.actionType).toBe(RecoveryActionType.UPDATE_PAYMENT_METHOD);
  });

  it('should retry payment for a transient network error', () => {
    const result = service.determine('network_error');

    expect(result.actionType).toBe(RecoveryActionType.RETRY_PAYMENT);
  });

  it('should send payment link when the payment limit was exceeded', () => {
    const result = service.determine('limit_exceeded');

    expect(result.actionType).toBe(RecoveryActionType.SEND_PAYMENT_LINK);
  });

  it('should send payment link for checkout abandonment', () => {
    const result = service.determine('checkout_abandoned');

    expect(result.actionType).toBe(RecoveryActionType.SEND_PAYMENT_LINK);
  });

  it('should follow up on overdue invoices', () => {
    const result = service.determine('invoice_overdue');

    expect(result.actionType).toBe(RecoveryActionType.FOLLOW_UP_RECEIVABLE);
  });

  it('should retry payment for a failed subscription charge', () => {
    const result = service.determine('subscription_payment_failed');

    expect(result.actionType).toBe(RecoveryActionType.RETRY_PAYMENT);
  });

  it('should request payment method update for a halted subscription', () => {
    const result = service.determine('subscription_halted');

    expect(result.actionType).toBe(RecoveryActionType.UPDATE_PAYMENT_METHOD);
  });

  it('should escalate repeated failures', () => {
    const result = service.determine('repeated_failure');

    expect(result.actionType).toBe(RecoveryActionType.ESCALATE_HUMAN);
  });

  it('should normalize root cause casing', () => {
    const result = service.determine('INSUFFICIENT_FUNDS');

    expect(result.actionType).toBe(RecoveryActionType.RETRY_PAYMENT);
  });

  it('should use a safe fallback for unknown root causes', () => {
    const result = service.determine('unknown_reason');

    expect(result.actionType).toBe(RecoveryActionType.SEND_PAYMENT_LINK);
  });
});
