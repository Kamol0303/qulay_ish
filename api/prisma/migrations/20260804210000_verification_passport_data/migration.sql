-- Passport / ID credential fields for verification requests (Super Admin + owner only)
ALTER TABLE "verification_requests" ADD COLUMN IF NOT EXISTS "passport_data" JSONB;
ALTER TABLE "verification_requests" ADD COLUMN IF NOT EXISTS "document_checks" JSONB;
