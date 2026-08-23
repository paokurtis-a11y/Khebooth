ALTER TABLE "OrganizationProfile"
  ADD COLUMN IF NOT EXISTS "buildingNumber" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "postalCode" TEXT NOT NULL DEFAULT '';

ALTER TABLE "ClientProfileSnapshot"
  ADD COLUMN IF NOT EXISTS "buildingNumber" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "postalCode" TEXT NOT NULL DEFAULT '';

UPDATE "Client"
SET "kheCode" = 'KHE-' || upper(substr(replace(id::text, '-', ''), 1, 16)),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "kheCode" IS NULL OR btrim("kheCode") = '';

CREATE OR REPLACE FUNCTION khe_ensure_client_code()
RETURNS trigger AS $$
BEGIN
  IF NEW."kheCode" IS NULL OR btrim(NEW."kheCode") = '' THEN
    NEW."kheCode" := 'KHE-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 16));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Client_ensure_khe_code" ON "Client";
CREATE TRIGGER "Client_ensure_khe_code"
BEFORE INSERT OR UPDATE OF "kheCode" ON "Client"
FOR EACH ROW EXECUTE FUNCTION khe_ensure_client_code();

CREATE TABLE IF NOT EXISTS "StationLockRecoveryToken" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "eventId" UUID NOT NULL REFERENCES "Event"("id") ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "codeHash" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "StationLockRecoveryToken_org_event_idx"
  ON "StationLockRecoveryToken"("organizationId", "eventId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "StationLockRecoveryToken_expires_idx"
  ON "StationLockRecoveryToken"("expiresAt");
