-- CreateEnum
CREATE TYPE "MandateStatus" AS ENUM ('CREATED', 'CONFIRMED', 'REJECTED', 'PAUSED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "razorpayCustomerId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "mandateId" TEXT;

-- AlterTable
ALTER TABLE "RecoveryCase" ADD COLUMN     "mandateId" TEXT;

-- CreateTable
CREATE TABLE "Mandate" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "externalId" TEXT,
    "registrationOrderId" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'upi',
    "maxAmount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "frequency" TEXT NOT NULL DEFAULT 'monthly',
    "status" "MandateStatus" NOT NULL DEFAULT 'CREATED',
    "expireAt" TIMESTAMP(3),
    "failedDebitCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mandate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Mandate_merchantId_idx" ON "Mandate"("merchantId");

-- CreateIndex
CREATE INDEX "Mandate_customerId_idx" ON "Mandate"("customerId");

-- CreateIndex
CREATE INDEX "Mandate_status_idx" ON "Mandate"("status");

-- CreateIndex
CREATE INDEX "Mandate_registrationOrderId_idx" ON "Mandate"("registrationOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Mandate_merchantId_externalId_key" ON "Mandate"("merchantId", "externalId");

-- CreateIndex
CREATE INDEX "Order_mandateId_idx" ON "Order"("mandateId");

-- CreateIndex
CREATE INDEX "RecoveryCase_mandateId_idx" ON "RecoveryCase"("mandateId");

-- AddForeignKey
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryCase" ADD CONSTRAINT "RecoveryCase_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
