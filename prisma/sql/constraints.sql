-- Constraints Prisma can't express. Run after `prisma db push` / each migration.

-- At most ONE live attempt per member per cycle. A second "Payer" while one is pending
-- is rejected by the database itself, not just by the UI.
CREATE UNIQUE INDEX IF NOT EXISTS payment_one_active_per_share
  ON "Payment" ("membershipId", "cycleId")
  WHERE status IN ('INITIATED', 'PENDING');

-- Amounts are always positive whole FCFA.
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS payment_amount_positive;
ALTER TABLE "Payment" ADD CONSTRAINT payment_amount_positive CHECK (amount > 0);

ALTER TABLE "Circle" DROP CONSTRAINT IF EXISTS circle_size_range;
ALTER TABLE "Circle" ADD CONSTRAINT circle_size_range CHECK (size BETWEEN 3 AND 40);

-- Row Level Security: the app talks to Postgres through Prisma with the service role,
-- but lock tables down in case the anon key is ever used directly.
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contribution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookEvent" ENABLE ROW LEVEL SECURITY;
