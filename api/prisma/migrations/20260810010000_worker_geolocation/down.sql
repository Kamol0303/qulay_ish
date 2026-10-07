-- Reverse of 20260810010000_worker_geolocation (apply manually to roll back).
DROP INDEX IF EXISTS "users_location_sharing_idx";
DROP INDEX IF EXISTS "users_lat_lng_idx";
ALTER TABLE "users" DROP COLUMN IF EXISTS "location_sharing_enabled";
ALTER TABLE "users" DROP COLUMN IF EXISTS "location_updated_at";
ALTER TABLE "users" DROP COLUMN IF EXISTS "longitude";
ALTER TABLE "users" DROP COLUMN IF EXISTS "latitude";
