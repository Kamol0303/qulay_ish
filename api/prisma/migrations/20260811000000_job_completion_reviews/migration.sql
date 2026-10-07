-- Worker specialty + education level captured at registration.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profession" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "education_level" TEXT;

-- Application completion lifecycle: accept marks the worker busy, complete frees them.
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'completed';

ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "accepted_at" TIMESTAMP(3);
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3);
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "reviewed" BOOLEAN NOT NULL DEFAULT false;

-- Link a review to the completed application it rates (one review per completed job).
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "application_id" TEXT;
CREATE INDEX IF NOT EXISTS "reviews_application_id_idx" ON "reviews" ("application_id");
