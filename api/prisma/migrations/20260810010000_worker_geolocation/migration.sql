-- Opt-in worker geolocation for "nearby workers" search.
-- Exact coordinates are never returned to employers (API exposes approximate distance only).

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "location_updated_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "location_sharing_enabled" BOOLEAN NOT NULL DEFAULT false;

-- Bounding-box prefilter support for the Haversine nearby query (no PostGIS required).
CREATE INDEX IF NOT EXISTS "users_lat_lng_idx" ON "users" ("latitude", "longitude");
CREATE INDEX IF NOT EXISTS "users_location_sharing_idx" ON "users" ("location_sharing_enabled");
