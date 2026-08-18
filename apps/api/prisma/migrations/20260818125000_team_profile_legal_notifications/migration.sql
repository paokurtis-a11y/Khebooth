ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "avatarPath" TEXT,
  ADD COLUMN IF NOT EXISTS "permissions" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "termsAcceptedRevision" TEXT,
  ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "notificationPreferences" JSONB NOT NULL DEFAULT '{"enabled":true,"soundEnabled":true,"sound":"khe_chime","vibrationEnabled":true,"vibrationMode":"double","vibrationIntensity":"medium"}'::jsonb;

ALTER TABLE "OrganizationProfile"
  ADD COLUMN IF NOT EXISTS "avatarPath" TEXT,
  ADD COLUMN IF NOT EXISTS "notificationPreferences" JSONB NOT NULL DEFAULT '{"enabled":true,"soundEnabled":true,"sound":"khe_chime","vibrationEnabled":true,"vibrationMode":"double","vibrationIntensity":"medium"}'::jsonb;

ALTER TABLE "MarketingSiteConfig"
  ADD COLUMN IF NOT EXISTS "regionalSettings" JSONB NOT NULL DEFAULT '{"SWITZERLAND":{"enabled":true,"showPrices":true,"showDownload":true,"showReviews":true,"showPromoVideo":true,"forceCurrency":"CHF"},"EUROZONE":{"enabled":true,"showPrices":true,"showDownload":true,"showReviews":true,"showPromoVideo":true,"forceCurrency":"EUR"},"AFRICA":{"enabled":true,"showPrices":true,"showDownload":true,"showReviews":true,"showPromoVideo":true},"ASIA":{"enabled":true,"showPrices":true,"showDownload":true,"showReviews":true,"showPromoVideo":true},"AMERICAS":{"enabled":true,"showPrices":true,"showDownload":true,"showReviews":true,"showPromoVideo":true},"OTHER":{"enabled":true,"showPrices":true,"showDownload":true,"showReviews":true,"showPromoVideo":true}}'::jsonb;

CREATE TABLE IF NOT EXISTS "TeamInvitation" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "email" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "permissions" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "invitedByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "TeamInvitation_organizationId_email_idx"
  ON "TeamInvitation"("organizationId", "email");
CREATE INDEX IF NOT EXISTS "TeamInvitation_expiresAt_idx"
  ON "TeamInvitation"("expiresAt");
