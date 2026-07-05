-- AlterTable
ALTER TABLE "users" ADD COLUMN "telegram_verified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "otp_sessions" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'telegram';
ALTER TABLE "otp_sessions" ADD COLUMN "telegram_request_id" TEXT;

-- CreateIndex
CREATE INDEX "otp_sessions_phone_created_at_idx" ON "otp_sessions"("phone", "created_at");

-- CreateTable
CREATE TABLE "otp_phone_locks" (
    "phone" TEXT NOT NULL,
    "locked_until" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "otp_phone_locks_pkey" PRIMARY KEY ("phone")
);
