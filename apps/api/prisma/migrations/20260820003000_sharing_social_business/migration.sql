CREATE TABLE "SharingBusinessSettings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "socialLinks" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "galleryLayout" TEXT NOT NULL DEFAULT 'MASONRY',
  "portraitColumns" INTEGER NOT NULL DEFAULT 2,
  "landscapeColumns" INTEGER NOT NULL DEFAULT 3,
  "videoAutoplay" BOOLEAN NOT NULL DEFAULT TRUE,
  "mediaFit" TEXT NOT NULL DEFAULT 'COVER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SharingBusinessSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SharingBusinessSettings_galleryLayout_check" CHECK ("galleryLayout" IN ('MASONRY', 'GRID', 'COMPACT')),
  CONSTRAINT "SharingBusinessSettings_portraitColumns_check" CHECK ("portraitColumns" BETWEEN 1 AND 4),
  CONSTRAINT "SharingBusinessSettings_landscapeColumns_check" CHECK ("landscapeColumns" BETWEEN 1 AND 6),
  CONSTRAINT "SharingBusinessSettings_mediaFit_check" CHECK ("mediaFit" IN ('COVER', 'CONTAIN'))
);

CREATE UNIQUE INDEX "SharingBusinessSettings_eventId_key" ON "SharingBusinessSettings"("eventId");
CREATE INDEX "SharingBusinessSettings_organizationId_eventId_idx" ON "SharingBusinessSettings"("organizationId", "eventId");

ALTER TABLE "SharingBusinessSettings"
  ADD CONSTRAINT "SharingBusinessSettings_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SharingBusinessSettings"
  ADD CONSTRAINT "SharingBusinessSettings_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SocialDeliverySession" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "mediaAssetId" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CREATED',
  "recipientExternalId" TEXT,
  "followVerificationStatus" TEXT NOT NULL DEFAULT 'UNAVAILABLE',
  "deliveryConsentAt" TIMESTAMP(3),
  "publishConsentAt" TIMESTAMP(3),
  "marketingConsentAt" TIMESTAMP(3),
  "followVerifiedAt" TIMESTAMP(3),
  "mediaDeliveredAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "likePromptDueAt" TIMESTAMP(3),
  "likePromptSentAt" TIMESTAMP(3),
  "commentPromptDueAt" TIMESTAMP(3),
  "commentPromptSentAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialDeliverySession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SocialDeliverySession_provider_check" CHECK ("provider" IN ('WHATSAPP', 'TIKTOK', 'FACEBOOK', 'INSTAGRAM', 'X', 'TELEGRAM', 'YOUTUBE')),
  CONSTRAINT "SocialDeliverySession_status_check" CHECK ("status" IN ('CREATED', 'OPENED', 'DELIVERY_REQUESTED', 'DELIVERED', 'PUBLISH_APPROVED', 'PUBLISHED', 'REVOKED', 'FAILED')),
  CONSTRAINT "SocialDeliverySession_followVerificationStatus_check" CHECK ("followVerificationStatus" IN ('UNAVAILABLE', 'PENDING', 'VERIFIED', 'NOT_VERIFIED'))
);

CREATE UNIQUE INDEX "SocialDeliverySession_tokenHash_key" ON "SocialDeliverySession"("tokenHash");
CREATE INDEX "SocialDeliverySession_organizationId_eventId_idx" ON "SocialDeliverySession"("organizationId", "eventId");
CREATE INDEX "SocialDeliverySession_mediaAssetId_idx" ON "SocialDeliverySession"("mediaAssetId");
CREATE INDEX "SocialDeliverySession_provider_status_idx" ON "SocialDeliverySession"("provider", "status");
CREATE INDEX "SocialDeliverySession_likePromptDueAt_idx" ON "SocialDeliverySession"("likePromptDueAt") WHERE "likePromptSentAt" IS NULL AND "revokedAt" IS NULL;
CREATE INDEX "SocialDeliverySession_commentPromptDueAt_idx" ON "SocialDeliverySession"("commentPromptDueAt") WHERE "commentPromptSentAt" IS NULL AND "revokedAt" IS NULL;

ALTER TABLE "SocialDeliverySession"
  ADD CONSTRAINT "SocialDeliverySession_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialDeliverySession"
  ADD CONSTRAINT "SocialDeliverySession_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialDeliverySession"
  ADD CONSTRAINT "SocialDeliverySession_mediaAssetId_fkey"
  FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
