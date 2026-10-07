-- Platform-level subscription (Super Admin only). Workers/employers are always free.
CREATE TABLE IF NOT EXISTS "platform_subscription" (
  "id" TEXT NOT NULL DEFAULT 'platform',
  "status" TEXT NOT NULL DEFAULT 'active',
  "free_until" TIMESTAMP(3),
  "paid_until" TIMESTAMP(3),
  "last_payment_at" TIMESTAMP(3),
  "price_som" INTEGER NOT NULL DEFAULT 240000,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_subscription_pkey" PRIMARY KEY ("id")
);

-- One-time 6-digit payment confirmation OTP (hash only, short TTL, attempt-locked).
CREATE TABLE IF NOT EXISTS "payment_otps" (
  "id" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "requested_by" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "consumed" BOOLEAN NOT NULL DEFAULT false,
  "locked" BOOLEAN NOT NULL DEFAULT false,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payment_otps_expires_at_idx" ON "payment_otps" ("expires_at");
CREATE INDEX IF NOT EXISTS "payment_otps_requested_by_created_at_idx" ON "payment_otps" ("requested_by", "created_at");
