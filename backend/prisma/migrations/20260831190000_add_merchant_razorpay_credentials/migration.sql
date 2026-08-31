-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN "slug" TEXT;
ALTER TABLE "Merchant" ADD COLUMN "razorpayKeyId" TEXT;
ALTER TABLE "Merchant" ADD COLUMN "razorpayKeySecretEncrypted" TEXT;
ALTER TABLE "Merchant" ADD COLUMN "razorpayWebhookSecretEncrypted" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_slug_key" ON "Merchant"("slug");
