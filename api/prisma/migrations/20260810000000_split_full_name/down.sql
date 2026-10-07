-- Reverse of 20260810000000_split_full_name.
-- Prisma does not auto-run down migrations; apply manually to roll back:
--   psql "$DATABASE_URL" -f api/prisma/migrations/20260810000000_split_full_name/down.sql

-- Recompose full_name from the split columns so no display data is lost on rollback.
UPDATE "users"
SET "full_name" = btrim(concat_ws(' ', NULLIF(btrim("first_name"), ''), NULLIF(btrim("last_name"), '')))
WHERE (NULLIF(btrim("first_name"), '') IS NOT NULL OR NULLIF(btrim("last_name"), '') IS NOT NULL)
  AND btrim(concat_ws(' ', NULLIF(btrim("first_name"), ''), NULLIF(btrim("last_name"), ''))) <> '';

ALTER TABLE "users" DROP COLUMN IF EXISTS "first_name";
ALTER TABLE "users" DROP COLUMN IF EXISTS "last_name";
