CREATE TABLE "MediaShareLink" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "mediaAssetId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaShareLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaShareLink_tokenHash_key" ON "MediaShareLink"("tokenHash");
CREATE INDEX "MediaShareLink_organizationId_eventId_idx" ON "MediaShareLink"("organizationId", "eventId");
CREATE INDEX "MediaShareLink_mediaAssetId_idx" ON "MediaShareLink"("mediaAssetId");
CREATE INDEX "MediaShareLink_revokedAt_idx" ON "MediaShareLink"("revokedAt");

ALTER TABLE "MediaShareLink"
  ADD CONSTRAINT "MediaShareLink_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MediaShareLink"
  ADD CONSTRAINT "MediaShareLink_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MediaShareLink"
  ADD CONSTRAINT "MediaShareLink_mediaAssetId_fkey"
  FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
