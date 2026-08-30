-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "externalId" TEXT;

-- CreateIndex
CREATE INDEX "Order_externalId_idx" ON "Order"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_merchantId_externalId_key" ON "Order"("merchantId", "externalId");
