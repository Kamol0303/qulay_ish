-- Explicit Super Admin price override. When NULL the subscription price
-- auto-varies each month (deterministic monthly value in 250000..450000).
ALTER TABLE "platform_subscription" ADD COLUMN IF NOT EXISTS "price_override" INTEGER;
