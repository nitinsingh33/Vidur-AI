import { PolicyAction, RecoveryActionType } from '../generated/prisma/enums';

export interface DefaultPolicy {
  name: string;
  description: string;
  actionType: RecoveryActionType;
  decision: PolicyAction;
  maxRetries?: number;
  maxContacts?: number;
  maxAmount?: number;
  /** Minimum minutes between retries of this action type. Merchant-editable. */
  retryIntervalMinutes?: number;
}

/**
 * Seeded for every merchant at signup (see AuthService.signup) so
 * PolicyService.check() never falls into its "no policy configured;
 * blocking by default" branch for a brand-new account. Mirrors the
 * synthetic-data seed's defaults in prisma/seed.ts.
 *
 * Every numeric limit here (retry count, retry interval, contact caps,
 * amount caps) is a starting default the merchant can edit or disable from
 * the Policies page at any time — none of it is a fixed provider or
 * regulatory requirement.
 */
export const DEFAULT_POLICIES: DefaultPolicy[] = [
  {
    name: 'Allow payment retry',
    description:
      'Retry failed payments up to 3 times, at least 24 hours apart. Both numbers are editable defaults, not a fixed rule.',
    actionType: RecoveryActionType.RETRY_PAYMENT,
    decision: PolicyAction.ALLOW,
    maxRetries: 3,
    retryIntervalMinutes: 1440,
  },
  {
    name: 'Allow payment link',
    description: 'Send a payment link up to 3 times.',
    actionType: RecoveryActionType.SEND_PAYMENT_LINK,
    decision: PolicyAction.ALLOW,
    maxContacts: 3,
  },
  {
    name: 'Allow recovery email',
    description: 'Send recovery emails up to 5 times.',
    actionType: RecoveryActionType.SEND_EMAIL,
    decision: PolicyAction.ALLOW,
    maxContacts: 5,
  },
  {
    name: 'Allow WhatsApp reminder',
    description: 'Send WhatsApp reminders up to 3 times.',
    actionType: RecoveryActionType.SEND_WHATSAPP,
    decision: PolicyAction.ALLOW,
    maxContacts: 3,
  },
  {
    name: 'Allow payment method update request',
    description: 'Ask for an updated payment method up to 2 times.',
    actionType: RecoveryActionType.UPDATE_PAYMENT_METHOD,
    decision: PolicyAction.ALLOW,
    maxContacts: 2,
  },
  {
    name: 'Allow receivable follow-up',
    description: 'Follow up on overdue invoices up to 5 times.',
    actionType: RecoveryActionType.FOLLOW_UP_RECEIVABLE,
    decision: PolicyAction.ALLOW,
    maxContacts: 5,
  },
  {
    name: 'Allow Hinglish voice message',
    description:
      'Send one AI-generated Hinglish voice message — a channel-escalation ' +
      'step used after repeated payment-link/retry attempts, before ' +
      'escalating to a human. Never a placed phone call.',
    actionType: RecoveryActionType.SEND_VOICE_MESSAGE,
    decision: PolicyAction.ALLOW,
    maxRetries: 1,
  },
  {
    name: 'Always allow escalation',
    description: 'Escalating to a human is never blocked.',
    actionType: RecoveryActionType.ESCALATE_HUMAN,
    decision: PolicyAction.ALLOW,
  },
  {
    name: 'Always allow stop',
    description: 'Stopping recovery is never blocked.',
    actionType: RecoveryActionType.STOP_RECOVERY,
    decision: PolicyAction.ALLOW,
  },
];
