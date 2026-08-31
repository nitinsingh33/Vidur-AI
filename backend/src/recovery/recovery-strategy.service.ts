// RecoverStrategyService pure business logic rootCause -> strategy
// No database

import { Injectable } from '@nestjs/common';
import { RecoveryActionType } from '../generated/prisma/enums';

export interface RecoveryStrategy {
  actionType: RecoveryActionType;
  reason: string;
}

@Injectable()
export class RecoveryStrategyService {
  determine(rootCause: string | null): RecoveryStrategy {
    const normalizedRootCause = rootCause?.trim().toLowerCase() ?? '';

    switch (normalizedRootCause) {
      case 'insufficient_funds':
        return {
          actionType: RecoveryActionType.RETRY_PAYMENT,
          reason:
            'Payment failed because of insufficient funds. Retry the payment later.',
        };

      case 'network_error':
        return {
          actionType: RecoveryActionType.RETRY_PAYMENT,
          reason:
            'Payment failed because of a transient network error. Retry the payment.',
        };

      case 'card_expired':
        return {
          actionType: RecoveryActionType.UPDATE_PAYMENT_METHOD,
          reason:
            'The payment method appears to be expired. Request a payment method update.',
        };

      case 'bank_declined':
        return {
          actionType: RecoveryActionType.UPDATE_PAYMENT_METHOD,
          reason:
            'The issuing bank declined the payment. Request a different payment method.',
        };

      case 'limit_exceeded':
        return {
          actionType: RecoveryActionType.SEND_PAYMENT_LINK,
          reason:
            'The payment method limit was exceeded. Send a payment link so the customer can pay another way.',
        };

      case 'checkout_abandoned':
        return {
          actionType: RecoveryActionType.SEND_PAYMENT_LINK,
          reason: 'Checkout was abandoned. Send the customer a payment link.',
        };

      case 'invoice_overdue':
        return {
          actionType: RecoveryActionType.FOLLOW_UP_RECEIVABLE,
          reason:
            'Invoice is overdue. Follow up on the outstanding receivable.',
        };

      case 'subscription_payment_failed':
        return {
          actionType: RecoveryActionType.RETRY_PAYMENT,
          reason:
            'A subscription renewal charge failed. Send a fresh payment link so the customer can complete it before the next automatic retry.',
        };

      case 'subscription_halted':
        return {
          actionType: RecoveryActionType.UPDATE_PAYMENT_METHOD,
          reason:
            "Razorpay exhausted its own retry schedule and halted the subscription. The customer's payment method likely needs updating.",
        };

      case 'mandate_registration_rejected':
      case 'mandate_paused':
      case 'mandate_cancelled':
        return {
          actionType: RecoveryActionType.ESCALATE_HUMAN,
          reason:
            'The mandate itself needs re-authorization — Razorpay has no API to resurrect a rejected, paused, or cancelled mandate. The customer must set it up again.',
        };

      case 'repeated_failure':
        return {
          actionType: RecoveryActionType.ESCALATE_HUMAN,
          reason:
            'Repeated payment failures indicate that human intervention may be required.',
        };

      default:
        return {
          actionType: RecoveryActionType.SEND_PAYMENT_LINK,
          reason:
            'No specific recovery rule matched. Use a payment link as the default recovery strategy.',
        };
    }
  }
}
