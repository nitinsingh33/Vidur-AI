-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "externalId" TEXT;

-- AlterTable
ALTER TABLE "RecoveryCase" ADD COLUMN     "subscriptionId" TEXT;

-- CreateIndex
CREATE INDEX "Subscription_externalId_idx" ON "Subscription"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_merchantId_externalId_key" ON "Subscription"("merchantId", "externalId");

-- CreateIndex
CREATE INDEX "RecoveryCase_subscriptionId_idx" ON "RecoveryCase"("subscriptionId");

-- AddForeignKey
ALTER TABLE "RecoveryCase" ADD CONSTRAINT "RecoveryCase_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
