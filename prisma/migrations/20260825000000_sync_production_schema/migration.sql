-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN');
CREATE TYPE "OtpPurpose" AS ENUM ('REGISTRATION', 'LOGIN', 'CHANGE_MOBILE', 'ACCOUNT_RECOVERY');

-- AlterTable Customer
ALTER TABLE "Customer" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "Customer" ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- AlterTable Review
ALTER TABLE "Review" ADD COLUMN "orderItemId" TEXT;
ALTER TABLE "Review" ADD COLUMN "customerName" TEXT;
ALTER TABLE "Review" ADD COLUMN "customerMobile" TEXT;
ALTER TABLE "Review" ADD COLUMN "customerEmail" TEXT;
ALTER TABLE "Review" ADD COLUMN "headline" TEXT;
ALTER TABLE "Review" ALTER COLUMN "comment" TYPE VARCHAR(1000);
ALTER TABLE "Review" ADD COLUMN "adminResponse" VARCHAR(1000);
ALTER TABLE "Review" ADD COLUMN "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Review" ADD COLUMN "isVerifiedPurchase" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable ReviewImage
CREATE TABLE "ReviewImage" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "cloudinaryPublicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewImage_pkey" PRIMARY KEY ("id")
);

-- AlterTable PaymentWebhookLog
ALTER TABLE "PaymentWebhookLog" ADD COLUMN "eventId" TEXT;

-- AlterTable OrderItem
ALTER TABLE "OrderItem" ADD COLUMN "warehouseId" TEXT;

-- AlterTable ShipmentItem
ALTER TABLE "ShipmentItem" ADD COLUMN "warehouseId" TEXT;

-- AlterTable StoreSetting
ALTER TABLE "StoreSetting" ADD COLUMN "siteDescription" TEXT;
ALTER TABLE "StoreSetting" ADD COLUMN "supportEmail" TEXT;
ALTER TABLE "StoreSetting" ADD COLUMN "supportPhone" TEXT;
ALTER TABLE "StoreSetting" ADD COLUMN "address" TEXT;
ALTER TABLE "StoreSetting" ADD COLUMN "city" TEXT;
ALTER TABLE "StoreSetting" ADD COLUMN "country" TEXT;
ALTER TABLE "StoreSetting" ADD COLUMN "location" TEXT;
ALTER TABLE "StoreSetting" ADD COLUMN "facebookUrl" TEXT;
ALTER TABLE "StoreSetting" ADD COLUMN "instagramUrl" TEXT;
ALTER TABLE "StoreSetting" ADD COLUMN "youtubeUrl" TEXT;
ALTER TABLE "StoreSetting" ADD COLUMN "tiktokUrl" TEXT;
ALTER TABLE "StoreSetting" ADD COLUMN "linkedinUrl" TEXT;

-- AlterTable SEOSetting
ALTER TABLE "SEOSetting" ADD COLUMN "canonicalUrl" TEXT;

-- AlterTable AnalyticsSetting
ALTER TABLE "AnalyticsSetting" ADD COLUMN "googleAdsConversionId" TEXT;
ALTER TABLE "AnalyticsSetting" ADD COLUMN "googleAdsConversionLabel" TEXT;
ALTER TABLE "AnalyticsSetting" ADD COLUMN "ga4ApiSecret" TEXT;
ALTER TABLE "AnalyticsSetting" ADD COLUMN "hotjarId" TEXT;

-- AlterTable ShippingSetting
ALTER TABLE "ShippingSetting" ADD COLUMN "insideDhakaCharge" DOUBLE PRECISION NOT NULL DEFAULT 60;
ALTER TABLE "ShippingSetting" ADD COLUMN "outsideDhakaCharge" DOUBLE PRECISION NOT NULL DEFAULT 120;
ALTER TABLE "ShippingSetting" ALTER COLUMN "defaultShippingCost" SET DEFAULT 60;
ALTER TABLE "ShippingSetting" ALTER COLUMN "freeShippingThreshold" SET DEFAULT 2000;
ALTER TABLE "ShippingSetting" ADD COLUMN "freeShippingEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ShippingSetting" ALTER COLUMN "enableFreeShipping" SET DEFAULT true;

-- AlterTable TaxSetting
ALTER TABLE "TaxSetting" ADD COLUMN "taxEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TaxSetting" ADD COLUMN "enableTax" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable UploadTracker
CREATE TABLE "UploadTracker" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadTracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable CustomerOtp
CREATE TABLE "CustomerOtp" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resendAvailableAt" TIMESTAMP(3),
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Review_orderItemId_key" ON "Review"("orderItemId");
CREATE INDEX "Review_productId_status_idx" ON "Review"("productId", "status");
CREATE INDEX "Review_customerMobile_idx" ON "Review"("customerMobile");
CREATE INDEX "PaymentWebhookLog_provider_eventId_idx" ON "PaymentWebhookLog"("provider", "eventId");
CREATE UNIQUE INDEX "PaymentWebhookLog_provider_eventId_key" ON "PaymentWebhookLog"("provider", "eventId");
CREATE INDEX "OrderItem_warehouseId_idx" ON "OrderItem"("warehouseId");
CREATE INDEX "ShipmentItem_warehouseId_idx" ON "ShipmentItem"("warehouseId");
CREATE UNIQUE INDEX "UploadTracker_publicId_key" ON "UploadTracker"("publicId");
CREATE INDEX "CustomerOtp_identifier_purpose_isUsed_idx" ON "CustomerOtp"("identifier", "purpose", "isUsed");
CREATE INDEX "CustomerOtp_expiresAt_idx" ON "CustomerOtp"("expiresAt");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReviewImage" ADD CONSTRAINT "ReviewImage_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
