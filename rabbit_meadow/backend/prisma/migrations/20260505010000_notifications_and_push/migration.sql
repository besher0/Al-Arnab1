-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('GENERAL', 'ORDER_CREATED', 'ORDER_STATUS', 'ORDER_DELIVERED');

-- CreateTable
CREATE TABLE "public"."AppNotification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL DEFAULT 'GENERAL',
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserDeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "deviceName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppNotification_recipientId_createdAt_idx" ON "public"."AppNotification"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "AppNotification_recipientId_isRead_idx" ON "public"."AppNotification"("recipientId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "UserDeviceToken_token_key" ON "public"."UserDeviceToken"("token");

-- CreateIndex
CREATE INDEX "UserDeviceToken_userId_isActive_idx" ON "public"."UserDeviceToken"("userId", "isActive");

-- AddForeignKey
ALTER TABLE "public"."AppNotification" ADD CONSTRAINT "AppNotification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserDeviceToken" ADD CONSTRAINT "UserDeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
