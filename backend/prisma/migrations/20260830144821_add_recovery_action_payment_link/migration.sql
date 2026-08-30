-- AlterTable
ALTER TABLE "MerchantUser" ALTER COLUMN "passwordHash" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RecoveryAction" ADD COLUMN     "externalReferenceId" TEXT,
ADD COLUMN     "externalReferenceUrl" TEXT;

-- CreateIndex
CREATE INDEX "RecoveryAction_externalReferenceId_idx" ON "RecoveryAction"("externalReferenceId");
