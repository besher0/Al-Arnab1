-- AlterEnum
ALTER TYPE "public"."UserRole" ADD VALUE IF NOT EXISTS 'DELIVERY';

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN IF NOT EXISTS "assignedDeliveryId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_assignedDeliveryId_status_createdAt_idx"
ON "public"."Order"("assignedDeliveryId", "status", "createdAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Order_assignedDeliveryId_fkey'
  ) THEN
    ALTER TABLE "public"."Order"
    ADD CONSTRAINT "Order_assignedDeliveryId_fkey"
    FOREIGN KEY ("assignedDeliveryId")
    REFERENCES "public"."User"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;
