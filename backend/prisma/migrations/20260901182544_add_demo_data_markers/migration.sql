-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "isDemoData" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Mandate" ADD COLUMN     "isDemoData" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "isDemoMerchant" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "isDemoData" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "isDemoData" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "isDemoData" BOOLEAN NOT NULL DEFAULT false;
