CREATE TABLE "platform_gate" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'live',
    "billing" TEXT NOT NULL DEFAULT 'paid',
    "sections" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_gate_pkey" PRIMARY KEY ("id")
);
