CREATE TYPE "StationMode" AS ENUM ('CAPTURE', 'SHARING');
CREATE TYPE "MediaSyncState" AS ENUM ('QUEUED', 'UPLOADING', 'SYNCED', 'FAILED');
CREATE TYPE "UploadState" AS ENUM ('INITIALIZED', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

CREATE TABLE "Device" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "installationId" TEXT NOT NULL,
  "name" TEXT,
  "platform" TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StationSession" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "activationId" UUID,
  "mode" "StationMode" NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StationSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaAsset" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "createdBySessionId" UUID NOT NULL,
  "localId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL,
  "syncState" "MediaSyncState" NOT NULL DEFAULT 'QUEUED',
  "capturedAt" TIMESTAMP(3),
  "acknowledgedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UploadSession" (
  "id" UUID NOT NULL,
  "mediaAssetId" UUID NOT NULL,
  "state" "UploadState" NOT NULL DEFAULT 'INITIALIZED',
  "uploadedBytes" INTEGER NOT NULL DEFAULT 0,
  "totalBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UploadSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Device_organizationId_installationId_key" ON "Device"("organizationId", "installationId");
CREATE INDEX "Device_organizationId_idx" ON "Device"("organizationId");
CREATE INDEX "StationSession_organizationId_eventId_idx" ON "StationSession"("organizationId", "eventId");
CREATE INDEX "StationSession_deviceId_idx" ON "StationSession"("deviceId");
CREATE INDEX "StationSession_expiresAt_idx" ON "StationSession"("expiresAt");
CREATE UNIQUE INDEX "MediaAsset_organizationId_localId_key" ON "MediaAsset"("organizationId", "localId");
CREATE UNIQUE INDEX "MediaAsset_organizationId_idempotencyKey_key" ON "MediaAsset"("organizationId", "idempotencyKey");
CREATE INDEX "MediaAsset_organizationId_eventId_createdAt_idx" ON "MediaAsset"("organizationId", "eventId", "createdAt");
CREATE INDEX "MediaAsset_createdBySessionId_idx" ON "MediaAsset"("createdBySessionId");
CREATE UNIQUE INDEX "UploadSession_mediaAssetId_key" ON "UploadSession"("mediaAssetId");
CREATE INDEX "UploadSession_state_idx" ON "UploadSession"("state");

ALTER TABLE "Device" ADD CONSTRAINT "Device_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StationSession" ADD CONSTRAINT "StationSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StationSession" ADD CONSTRAINT "StationSession_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StationSession" ADD CONSTRAINT "StationSession_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StationSession" ADD CONSTRAINT "StationSession_activationId_fkey" FOREIGN KEY ("activationId") REFERENCES "EventActivation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_createdBySessionId_fkey" FOREIGN KEY ("createdBySessionId") REFERENCES "StationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UploadSession" ADD CONSTRAINT "UploadSession_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
