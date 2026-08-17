ALTER TABLE "Client"
  ADD COLUMN "subscriptionPlan" TEXT NOT NULL DEFAULT 'DISCOVERY',
  ADD COLUMN "subscriptionStatus" TEXT NOT NULL DEFAULT 'PROSPECT',
  ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN "subscriptionStartedAt" TIMESTAMP(3),
  ADD COLUMN "subscriptionEndsAt" TIMESTAMP(3);

ALTER TABLE "Client"
  ADD CONSTRAINT "Client_subscriptionPlan_check"
    CHECK ("subscriptionPlan" IN ('DISCOVERY', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE')),
  ADD CONSTRAINT "Client_subscriptionStatus_check"
    CHECK ("subscriptionStatus" IN ('PROSPECT', 'PLAN_SELECTED', 'PAYMENT_PENDING', 'ACTIVE', 'SUSPENDED', 'CANCELLED')),
  ADD CONSTRAINT "Client_paymentStatus_check"
    CHECK ("paymentStatus" IN ('UNPAID', 'PENDING', 'PAID', 'OVERDUE', 'REFUNDED'));

CREATE INDEX "Client_organizationId_subscriptionStatus_idx"
  ON "Client"("organizationId", "subscriptionStatus");

CREATE INDEX "Client_organizationId_subscriptionPlan_idx"
  ON "Client"("organizationId", "subscriptionPlan");
