ALTER TABLE "owner_feed" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT '';
ALTER TABLE "owner_feed" ADD COLUMN "status" TEXT NOT NULL DEFAULT '';

CREATE TABLE "credit_ledger" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'owner',
    "amount_som" INTEGER NOT NULL,
    "balance_som" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "credit_ledger_created_at_idx" ON "credit_ledger"("created_at");
