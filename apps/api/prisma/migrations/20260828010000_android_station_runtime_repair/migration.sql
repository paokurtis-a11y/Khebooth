-- Idempotent production repair for the Android CAPTURE / SHARING runtime.
-- These objects may be absent on databases that were bootstrapped before the
-- per-event design, remote preferences and client profile migrations existed.

CREATE TABLE IF NOT EXISTS "StationControlPreference" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "eventId" UUID NOT NULL REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "captureKind" TEXT NOT NULL DEFAULT 'VIDEO',
  "aspectRatio" TEXT NOT NULL DEFAULT '9:16',
  "countdownSeconds" INTEGER NOT NULL DEFAULT 5,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StationControlPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StationControlPreference_captureKind_check" CHECK ("captureKind" IN ('PHOTO','VIDEO')),
  CONSTRAINT "StationControlPreference_aspectRatio_check" CHECK ("aspectRatio" IN ('9:16','1:1')),
  CONSTRAINT "StationControlPreference_countdownSeconds_check" CHECK ("countdownSeconds" IN (0,3,5,10))
);
CREATE UNIQUE INDEX IF NOT EXISTS "StationControlPreference_eventId_key" ON "StationControlPreference"("eventId");
CREATE INDEX IF NOT EXISTS "StationControlPreference_org_event_idx" ON "StationControlPreference"("organizationId", "eventId");

CREATE TABLE IF NOT EXISTS "EventDesignConfiguration" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "clientId" UUID NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "eventId" UUID NOT NULL REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "designConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "designReadyAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventDesignConfiguration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EventDesignConfiguration_eventId_key" ON "EventDesignConfiguration"("eventId");
CREATE INDEX IF NOT EXISTS "EventDesignConfiguration_client_idx" ON "EventDesignConfiguration"("organizationId", "clientId", "eventId");

INSERT INTO "EventDesignConfiguration" ("organizationId","clientId","eventId","designConfig","designReadyAt","updatedAt")
SELECT cws."organizationId",cws."clientId",cws."selectedEventId",COALESCE(cws."designConfig",'{}'::jsonb),cws."designReadyAt",CURRENT_TIMESTAMP
FROM "ClientWorkspaceState" cws
WHERE cws."selectedEventId" IS NOT NULL
ON CONFLICT ("eventId") DO NOTHING;

CREATE TABLE IF NOT EXISTS "ClientProfileSnapshot" (
  "clientId" UUID PRIMARY KEY REFERENCES "Client"("id") ON DELETE CASCADE,
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "sourceOrganizationId" UUID REFERENCES "Organization"("id") ON DELETE SET NULL,
  "source" TEXT NOT NULL DEFAULT 'KHE_CLIENT',
  "firstName" TEXT NOT NULL DEFAULT '',
  "lastName" TEXT NOT NULL DEFAULT '',
  "displayName" TEXT NOT NULL DEFAULT '',
  "company" TEXT NOT NULL DEFAULT '',
  "role" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "address" TEXT NOT NULL DEFAULT '',
  "buildingNumber" TEXT NOT NULL DEFAULT '',
  "postalCode" TEXT NOT NULL DEFAULT '',
  "city" TEXT NOT NULL DEFAULT '',
  "country" TEXT NOT NULL DEFAULT '',
  "countryCode" TEXT NOT NULL DEFAULT '',
  "birthDate" DATE,
  "bio" TEXT NOT NULL DEFAULT '',
  "avatarPath" TEXT,
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientProfileSnapshot_source_check" CHECK ("source" IN ('CAPTURE','SHARING','ENTERPRISE_PORTAL','KHE_CLIENT','IMPORT'))
);
CREATE INDEX IF NOT EXISTS "ClientProfileSnapshot_organizationId_idx" ON "ClientProfileSnapshot"("organizationId","updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "ClientProfileSnapshot_sourceOrganizationId_idx" ON "ClientProfileSnapshot"("sourceOrganizationId");
