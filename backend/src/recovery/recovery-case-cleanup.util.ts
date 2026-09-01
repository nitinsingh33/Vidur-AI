import type { Prisma } from '../generated/prisma/client';

type PrismaOrTx = Prisma.TransactionClient;

/**
 * Deletes a set of RecoveryCase rows and everything that only exists because
 * of them — RecoveryAction/RecoveryOutcome/PromiseToPay cascade at the DB
 * level, but AuditLog is a SetNull relation (by design, so an audit trail
 * outlives the case it was about), so it's deleted explicitly here to avoid
 * leaving orphaned rows behind. Never touches the root Order/Payment/
 * Invoice/Subscription/Mandate the case(s) pointed to — a merchant deleting
 * a case (or the entity it's attached to) is clearing recovery-workflow
 * clutter, not silently deleting unrelated transactional records.
 */
export async function deleteRecoveryCasesCascade(
  tx: PrismaOrTx,
  recoveryCaseIds: string[],
): Promise<void> {
  if (recoveryCaseIds.length === 0) return;

  await tx.auditLog.deleteMany({
    where: { recoveryCaseId: { in: recoveryCaseIds } },
  });

  await tx.recoveryCase.deleteMany({
    where: { id: { in: recoveryCaseIds } },
  });
}
