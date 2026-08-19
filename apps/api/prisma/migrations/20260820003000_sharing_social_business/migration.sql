ALTER TABLE "MediaAsset"
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "trashedAt" TIMESTAMP(3),
  ADD COLUMN "trashExpiresAt" TIMESTAMP(3);

WITH ranked AS (
  SELECT
    m.id,
    e.name AS event_name,
    CASE WHEN m."mimeType" LIKE 'image/%' THEN 'PHOTO' ELSE 'VIDEO' END AS media_kind,
    ROW_NUMBER() OVER (PARTITION BY m."eventId" ORDER BY m."createdAt", m.id) AS seq
  FROM "MediaAsset" m
  INNER JOIN "Event" e ON e.id = m."eventId"
)
UPDATE "MediaAsset" m
SET "displayName" = CONCAT(
  'KHE ',
  NULLIF(TRIM(REGEXP_REPLACE(r.event_name, '[^[:alnum:]À-ÿ _-]+', '', 'g')), ''),
  CASE WHEN NULLIF(TRIM(REGEXP_REPLACE(r.event_name, '[^[:alnum:]À-ÿ _-]+', '', 'g')), '') IS NULL THEN '' ELSE ' ' END,
  r.media_kind,
  ' ',
  LPAD(r.seq::text, 3, '0')
)
FROM ranked r
WHERE r.id = m.id AND m."displayName" IS NULL;

CREATE INDEX "MediaAsset_eventId_trashedAt_idx" ON "MediaAsset"("eventId", "trashedAt");
CREATE INDEX "MediaAsset_trashExpiresAt_idx" ON "MediaAsset"("trashExpiresAt") WHERE "trashedAt" IS NOT NULL;

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

CREATE TABLE "StationNotificationRead" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "notificationId" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StationNotificationRead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StationNotificationRead_notificationId_deviceId_key" ON "StationNotificationRead"("notificationId", "deviceId");
CREATE INDEX "StationNotificationRead_deviceId_readAt_idx" ON "StationNotificationRead"("deviceId", "readAt");

ALTER TABLE "StationNotificationRead"
  ADD CONSTRAINT "StationNotificationRead_notificationId_fkey"
  FOREIGN KEY ("notificationId") REFERENCES "AppNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StationNotificationRead"
  ADD CONSTRAINT "StationNotificationRead_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MobileCommunicationSettings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "updateReminderHours" INTEGER NOT NULL DEFAULT 48,
  "reportCadenceHours" INTEGER NOT NULL DEFAULT 24,
  "updateNotificationsEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "automatedReportsEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "updateTitle" TEXT NOT NULL DEFAULT 'KHE Booth évolue ✨',
  "updateBody" TEXT NOT NULL DEFAULT 'Une nouvelle version plus attractive et plus performante est disponible. Téléchargez-la pour profiter des nouvelles fonctionnalités, tout en continuant à utiliser votre version actuelle si vous le souhaitez.',
  "lastUpdateReminderAt" TIMESTAMP(3),
  "lastReportAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MobileCommunicationSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MobileCommunicationSettings_updateReminderHours_check" CHECK ("updateReminderHours" BETWEEN 24 AND 336),
  CONSTRAINT "MobileCommunicationSettings_reportCadenceHours_check" CHECK ("reportCadenceHours" BETWEEN 24 AND 720)
);

CREATE UNIQUE INDEX "MobileCommunicationSettings_organizationId_key" ON "MobileCommunicationSettings"("organizationId");

ALTER TABLE "MobileCommunicationSettings"
  ADD CONSTRAINT "MobileCommunicationSettings_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;