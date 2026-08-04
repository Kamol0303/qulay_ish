-- Confidential worker personal information (RBAC: worker self + super_admin)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "personal_info" JSONB;
