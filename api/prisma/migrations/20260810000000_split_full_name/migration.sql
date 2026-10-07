-- Split "full_name" into "first_name" / "last_name".
-- Keeps "full_name" as the canonical/compat column (recomposed by the API).

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_name" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_name" TEXT;

-- Backfill: first whitespace-delimited token = first name, the remainder = last name.
-- Single-word names leave "last_name" NULL (down migration reconstructs from first_name only).
UPDATE "users"
SET
  "first_name" = NULLIF(split_part(btrim("full_name"), ' ', 1), ''),
  "last_name" = CASE
    WHEN position(' ' in btrim("full_name")) > 0
      THEN NULLIF(btrim(substring(btrim("full_name") from position(' ' in btrim("full_name")) + 1)), '')
    ELSE NULL
  END
WHERE "full_name" IS NOT NULL AND btrim("full_name") <> '';
