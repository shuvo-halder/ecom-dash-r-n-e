-- AlterEnum
ALTER TYPE "ShipmentStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN "provider" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "merchantOrderId" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "consignmentId" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "providerStatus" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "providerStoreId" INTEGER;
ALTER TABLE "Shipment" ADD COLUMN "trackingUrl" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "codAmount" DECIMAL(65,30);
ALTER TABLE "Shipment" ADD COLUMN "deliveryFee" DECIMAL(65,30);
ALTER TABLE "Shipment" ADD COLUMN "providerMetadata" JSONB;
ALTER TABLE "Shipment" ADD COLUMN "providerError" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "syncMetadata" JSONB;
ALTER TABLE "Shipment" ADD COLUMN "lastSyncAt" TIMESTAMP(3);
ALTER TABLE "Shipment" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_idempotencyKey_key" ON "Shipment"("idempotencyKey");
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");
CREATE INDEX "Shipment_provider_idx" ON "Shipment"("provider");
CREATE INDEX "Shipment_consignmentId_idx" ON "Shipment"("consignmentId");
CREATE INDEX "Shipment_merchantOrderId_idx" ON "Shipment"("merchantOrderId");
