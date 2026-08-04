-- Core indicators / risk assessment for workers (Асосий индикаторлар)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "core_indicators" JSONB;
