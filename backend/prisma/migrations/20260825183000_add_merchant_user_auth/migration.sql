-- DropIndex
DROP INDEX "MerchantUser_merchantId_email_key";

-- AlterTable
ALTER TABLE "MerchantUser" ADD COLUMN     "passwordHash" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "MerchantUser_email_key" ON "MerchantUser"("email");
