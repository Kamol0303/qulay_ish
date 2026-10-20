ALTER TABLE "platform_gate" ADD COLUMN IF NOT EXISTS "holds" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "platform_gate" ADD COLUMN IF NOT EXISTS "sms_synced_at" TIMESTAMP(3);
ALTER TABLE "platform_gate" ADD COLUMN IF NOT EXISTS "sms_sync_error" TEXT NOT NULL DEFAULT '';
ALTER TABLE "platform_gate" ADD COLUMN IF NOT EXISTS "sessions_cut" TIMESTAMP(3);
ALTER TABLE "platform_gate" ADD COLUMN IF NOT EXISTS "config_history" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "owner_feed" ADD COLUMN IF NOT EXISTS "provider_sms_id" INTEGER;
ALTER TABLE "owner_feed" ADD COLUMN IF NOT EXISTS "provider_request_id" TEXT NOT NULL DEFAULT '';
ALTER TABLE "owner_feed" ADD COLUMN IF NOT EXISTS "provider_status" TEXT NOT NULL DEFAULT '';
ALTER TABLE "owner_feed" ADD COLUMN IF NOT EXISTS "error_code" TEXT NOT NULL DEFAULT '';
ALTER TABLE "owner_feed" ADD COLUMN IF NOT EXISTS "synced_at" TIMESTAMP(3);
ALTER TABLE "owner_feed" ADD COLUMN IF NOT EXISTS "refunded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "owner_feed" ADD COLUMN IF NOT EXISTS "events" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS "owner_feed_provider_sms_id_idx" ON "owner_feed"("provider_sms_id");
