-- OTP sessions extended for login/register flow
ALTER TABLE "otp_sessions" ADD COLUMN IF NOT EXISTS "purpose" TEXT;
ALTER TABLE "otp_sessions" ADD COLUMN IF NOT EXISTS "full_name" TEXT;
ALTER TABLE "otp_sessions" ADD COLUMN IF NOT EXISTS "role" "UserRole";
ALTER TABLE "otp_sessions" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "otp_sessions" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
