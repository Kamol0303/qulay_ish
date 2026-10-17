-- Existing rows stay NULL, so tokens that are already issued keep working.
ALTER TABLE "users" ADD COLUMN "session_valid_after" TIMESTAMP(3);
