ALTER TABLE "Client" ALTER COLUMN "marketingEmailsEnabled" SET DEFAULT FALSE;
UPDATE "Client" SET "marketingEmailsEnabled" = FALSE WHERE "marketingEmailsEnabled" = TRUE AND "lastPaymentAt" IS NULL;

CREATE TABLE IF NOT EXISTS "MarketingAnalyticsEvent" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "clientId" UUID REFERENCES "Client"("id") ON DELETE SET NULL,
  "anonymousId" TEXT,
  "eventType" TEXT NOT NULL,
  "planCode" TEXT,
  "campaignId" UUID,
  "valueCents" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "MarketingAnalyticsEvent_org_created_idx" ON "MarketingAnalyticsEvent"("organizationId","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "MarketingAnalyticsEvent_org_type_created_idx" ON "MarketingAnalyticsEvent"("organizationId","eventType","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "MarketingAnalyticsEvent_client_created_idx" ON "MarketingAnalyticsEvent"("clientId","createdAt" DESC);

CREATE TABLE IF NOT EXISTS "MarketingCampaign" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "planCode" TEXT,
  "segment" TEXT NOT NULL DEFAULT 'ALL',
  "discountPercent" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "automatic" BOOLEAN NOT NULL DEFAULT FALSE,
  "reason" TEXT,
  "messageTitle" TEXT,
  "messageBody" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("discountPercent" >= 0 AND "discountPercent" <= 30)
);
CREATE INDEX IF NOT EXISTS "MarketingCampaign_org_active_period_idx" ON "MarketingCampaign"("organizationId","active","startsAt","endsAt");

CREATE TABLE IF NOT EXISTS "MarketingAutomationConfig" (
  "organizationId" UUID PRIMARY KEY REFERENCES "Organization"("id") ON DELETE CASCADE,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "maxDiscountPercent" INTEGER NOT NULL DEFAULT 15,
  "minCheckoutSample" INTEGER NOT NULL DEFAULT 20,
  "lowConversionThresholdPercent" INTEGER NOT NULL DEFAULT 10,
  "campaignDurationDays" INTEGER NOT NULL DEFAULT 7,
  "cooldownDays" INTEGER NOT NULL DEFAULT 21,
  "targetDiscovery" BOOLEAN NOT NULL DEFAULT TRUE,
  "targetPaymentPending" BOOLEAN NOT NULL DEFAULT TRUE,
  "ownerReportsEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("maxDiscountPercent" >= 0 AND "maxDiscountPercent" <= 30),
  CHECK ("lowConversionThresholdPercent" >= 1 AND "lowConversionThresholdPercent" <= 100)
);

INSERT INTO "MarketingAutomationConfig" ("organizationId")
SELECT id FROM "Organization"
ON CONFLICT ("organizationId") DO NOTHING;
