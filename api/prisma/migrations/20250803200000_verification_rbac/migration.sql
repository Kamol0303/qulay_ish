-- Extend verification status enum
DO $$ BEGIN
  ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'under_review';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'need_reupload';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "verification_requests" ADD COLUMN IF NOT EXISTS "account_type" TEXT;
ALTER TABLE "verification_requests" ADD COLUMN IF NOT EXISTS "address_proof_url" TEXT;
ALTER TABLE "verification_requests" ADD COLUMN IF NOT EXISTS "additional_files" JSONB;
ALTER TABLE "verification_requests" ADD COLUMN IF NOT EXISTS "admin_notes" TEXT;
ALTER TABLE "verification_requests" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;
ALTER TABLE "verification_requests" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "verification_requests_account_type_idx" ON "verification_requests"("account_type");
