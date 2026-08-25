import { RecoveryCaseStatus } from '../generated/prisma/enums';

/** A case in one of these statuses already has an agent working it — don't open a duplicate. */
export const ACTIVE_RECOVERY_CASE_STATUSES: RecoveryCaseStatus[] = [
  RecoveryCaseStatus.OPEN,
  RecoveryCaseStatus.ELIGIBLE,
  RecoveryCaseStatus.IN_PROGRESS,
  RecoveryCaseStatus.ESCALATED,
];

/** A case in one of these statuses is done — nothing more will happen to it automatically. */
export const TERMINAL_RECOVERY_CASE_STATUSES: RecoveryCaseStatus[] = [
  RecoveryCaseStatus.RECOVERED,
  RecoveryCaseStatus.EXHAUSTED,
  RecoveryCaseStatus.ESCALATED,
  RecoveryCaseStatus.STOPPED,
];
