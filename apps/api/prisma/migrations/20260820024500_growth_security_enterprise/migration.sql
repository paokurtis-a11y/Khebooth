-- KHE Booth Growth / Security / Enterprise foundation.
-- This migration is committed for CI and temporary-branch validation only until production approval.

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "tenantKind" TEXT NOT NULL DEFAULT 'KHE_ROOT',
  ADD COLUMN IF NOT EXISTS "managedByOrganizationId" UUID,
  ADD COLUMN IF NOT EXISTS "isPlatformManaged" BOOLEAN NOT NULL DEFAULT FALSE;

DO $$ BEGIN
  ALTER TABLE "Organization"
    ADD CONSTRAINT "Organization_tenantKind_check"
    CHECK ("tenantKind" IN ('KHE_ROOT','ENTERPRISE_CLIENT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Organization"
    ADD CONSTRAINT "Organization_managedByOrganizationId_fkey"
    FOREIGN KEY ("managedByOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Organization_managedByOrganizationId_idx" ON "Organization"("managedByOrganizationId");

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "passwordResetRequired" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "loginLockedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastFailedLoginAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "passwordChangeCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "managedClientId" UUID;

DO $$ BEGIN
  ALTER TABLE "User"
    ADD CONSTRAINT "User_managedClientId_fkey"
    FOREIGN KEY ("managedClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "User_managedClientId_idx" ON "User"("managedClientId");
CREATE INDEX IF NOT EXISTS "User_passwordResetRequired_idx" ON "User"("passwordResetRequired") WHERE "passwordResetRequired"=TRUE;

CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "requestedFromIp" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_createdAt_idx" ON "PasswordResetToken"("userId","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt") WHERE "usedAt" IS NULL;

CREATE TABLE IF NOT EXISTS "PasswordSecurityEvent" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "userId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "email" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PasswordSecurityEvent_userId_createdAt_idx" ON "PasswordSecurityEvent"("userId","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "PasswordSecurityEvent_eventType_createdAt_idx" ON "PasswordSecurityEvent"("eventType","createdAt" DESC);

CREATE TABLE IF NOT EXISTS "PaidMarketingCampaign" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "channel" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "objective" TEXT NOT NULL DEFAULT 'CONVERSIONS',
  "audience" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "creative" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "budgetCurrency" TEXT NOT NULL DEFAULT 'CHF',
  "proposedBudgetCents" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "analysis" TEXT,
  "projectedRevenueCents" INTEGER,
  "projectedRoas" DOUBLE PRECISION,
  "ownerApprovedAt" TIMESTAMP(3),
  "ownerApprovedByUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "providerCampaignId" TEXT,
  "providerStatus" TEXT,
  "spentCents" INTEGER NOT NULL DEFAULT 0,
  "attributedRevenueCents" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaidMarketingCampaign_channel_check" CHECK ("channel" IN ('GOOGLE','YOUTUBE','INSTAGRAM','FACEBOOK','TIKTOK','X','TELEGRAM','OTHER')),
  CONSTRAINT "PaidMarketingCampaign_status_check" CHECK ("status" IN ('DRAFT','READY_FOR_APPROVAL','APPROVED','PUBLISH_READY','ACTIVE','PAUSED','COMPLETED','REJECTED')),
  CONSTRAINT "PaidMarketingCampaign_budget_nonnegative" CHECK ("proposedBudgetCents">=0 AND "spentCents">=0)
);
CREATE INDEX IF NOT EXISTS "PaidMarketingCampaign_organizationId_status_idx" ON "PaidMarketingCampaign"("organizationId","status","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "PaidMarketingCampaign_channel_status_idx" ON "PaidMarketingCampaign"("channel","status");

CREATE TABLE IF NOT EXISTS "MarketingStrategyReport" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "periodType" TEXT NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "summary" TEXT NOT NULL,
  "analysis" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "recommendations" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "projections" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "urgent" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingStrategyReport_periodType_check" CHECK ("periodType" IN ('WEEKLY','MONTHLY','QUARTERLY','SEMIANNUAL','ANNUAL'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "MarketingStrategyReport_period_unique" ON "MarketingStrategyReport"("organizationId","periodType","periodStart","periodEnd");
CREATE INDEX IF NOT EXISTS "MarketingStrategyReport_urgent_createdAt_idx" ON "MarketingStrategyReport"("organizationId","urgent","createdAt" DESC);

CREATE TABLE IF NOT EXISTS "SecurityIncident" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "surface" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'INFO',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "detectedBy" TEXT NOT NULL DEFAULT 'KHE',
  "automaticAction" TEXT,
  "ownerActionRequired" BOOLEAN NOT NULL DEFAULT FALSE,
  "ownerReviewedAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityIncident_surface_check" CHECK ("surface" IN ('KHE_BOOTH','API','CAPTURE','SHARING','PROMOTIONAL_SITE','BILLING','AUTH')),
  CONSTRAINT "SecurityIncident_severity_check" CHECK ("severity" IN ('INFO','LOW','MEDIUM','HIGH','CRITICAL')),
  CONSTRAINT "SecurityIncident_status_check" CHECK ("status" IN ('OPEN','CONTAINED','MONITORING','RESOLVED','FALSE_POSITIVE'))
);
CREATE INDEX IF NOT EXISTS "SecurityIncident_organizationId_status_idx" ON "SecurityIncident"("organizationId","status","severity","createdAt" DESC);
