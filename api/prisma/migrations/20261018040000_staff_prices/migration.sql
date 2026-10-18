ALTER TABLE "platform_gate" ADD COLUMN "staff_price_som" INTEGER NOT NULL DEFAULT 250000;
ALTER TABLE "platform_gate" ADD COLUMN "otp_price_som" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "platform_gate" ADD COLUMN "otp_credit_som" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "platform_gate" ADD COLUMN "ai_price_som" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "platform_gate" ADD COLUMN "ai_credit_som" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "platform_gate" ADD COLUMN "sms_balance" INTEGER;

CREATE TABLE "owner_feed" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "detail" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "owner_feed_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "owner_feed_created_at_idx" ON "owner_feed"("created_at");
