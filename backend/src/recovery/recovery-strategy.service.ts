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
    const normalizedRootCause =
      rootCause?.trim().toLowerCase() ?? '';

    switch (normalizedRootCause) {
      case 'insufficient_funds':
        return {
          actionType: RecoveryActionType.RETRY_PAYMENT,
          reason:
            'Payment failed because of insufficient funds. Retry the payment later.',
        };

      case 'expired_card':
        return {
          actionType:
            RecoveryActionType.UPDATE_PAYMENT_METHOD,
          reason:
            'The payment method appears to be expired. Request a payment method update.',
        };

      case 'checkout_abandoned':
        return {
          actionType:
            RecoveryActionType.SEND_PAYMENT_LINK,
          reason:
            'Checkout was abandoned. Send the customer a payment link.',
        };

      case 'invoice_overdue':
        return {
          actionType:
            RecoveryActionType.FOLLOW_UP_RECEIVABLE,
          reason:
            'Invoice is overdue. Follow up on the outstanding receivable.',
        };

      case 'repeated_failure':
        return {
          actionType:
            RecoveryActionType.ESCALATE_HUMAN,
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