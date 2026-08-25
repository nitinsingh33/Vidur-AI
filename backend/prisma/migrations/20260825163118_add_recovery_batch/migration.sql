-- CreateEnum
CREATE TYPE "RecoveryBatchStatus" AS ENUM ('DETECTED', 'RUNNING', 'COMPLETED');

-- AlterTable
ALTER TABLE "RecoveryCase" ADD COLUMN     "batchId" TEXT;

-- CreateTable
CREATE TABLE "RecoveryBatch" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "status" "RecoveryBatchStatus" NOT NULL DEFAULT 'DETECTED',
    "totalCases" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RecoveryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecoveryBatch_merchantId_idx" ON "RecoveryBatch"("merchantId");

-- CreateIndex
CREATE INDEX "RecoveryBatch_status_idx" ON "RecoveryBatch"("status");

-- CreateIndex
CREATE INDEX "RecoveryCase_batchId_idx" ON "RecoveryCase"("batchId");

-- AddForeignKey
ALTER TABLE "RecoveryCase" ADD CONSTRAINT "RecoveryCase_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "RecoveryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryBatch" ADD CONSTRAINT "RecoveryBatch_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
