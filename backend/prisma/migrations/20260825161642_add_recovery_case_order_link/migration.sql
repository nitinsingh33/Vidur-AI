-- AlterTable
ALTER TABLE "RecoveryCase" ADD COLUMN     "orderId" TEXT;

-- CreateIndex
CREATE INDEX "RecoveryCase_orderId_idx" ON "RecoveryCase"("orderId");

-- AddForeignKey
ALTER TABLE "RecoveryCase" ADD CONSTRAINT "RecoveryCase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
