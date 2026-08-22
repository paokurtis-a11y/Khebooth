ALTER TABLE "MediaShareLink"
  ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 1;

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "organizationId", "eventId", "mediaAssetId"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS rn
  FROM "MediaShareLink"
  WHERE "revokedAt" IS NULL
)
UPDATE "MediaShareLink" AS share
SET "revokedAt" = CURRENT_TIMESTAMP
FROM ranked
WHERE share."id" = ranked."id"
  AND ranked.rn > 1;

CREATE UNIQUE INDEX "MediaShareLink_active_media_key"
  ON "MediaShareLink"("organizationId", "eventId", "mediaAssetId")
  WHERE "revokedAt" IS NULL;
