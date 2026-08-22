CREATE TABLE "StationControlPreference" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "eventId" UUID NOT NULL,
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
CREATE UNIQUE INDEX "StationControlPreference_eventId_key" ON "StationControlPreference"("eventId");
CREATE INDEX "StationControlPreference_org_event_idx" ON "StationControlPreference"("organizationId", "eventId");
ALTER TABLE "StationControlPreference" ADD CONSTRAINT "StationControlPreference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StationControlPreference" ADD CONSTRAINT "StationControlPreference_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EventDesignConfiguration" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "designConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "designReadyAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventDesignConfiguration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventDesignConfiguration_eventId_key" ON "EventDesignConfiguration"("eventId");
CREATE INDEX "EventDesignConfiguration_client_idx" ON "EventDesignConfiguration"("organizationId", "clientId", "eventId");
ALTER TABLE "EventDesignConfiguration" ADD CONSTRAINT "EventDesignConfiguration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventDesignConfiguration" ADD CONSTRAINT "EventDesignConfiguration_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventDesignConfiguration" ADD CONSTRAINT "EventDesignConfiguration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve the currently selected legacy design, when present, as the first per-event snapshot.
INSERT INTO "EventDesignConfiguration" ("organizationId","clientId","eventId","designConfig","designReadyAt","updatedAt")
SELECT cws."organizationId",cws."clientId",cws."selectedEventId",COALESCE(cws."designConfig",'{}'::jsonb),cws."designReadyAt",CURRENT_TIMESTAMP
FROM "ClientWorkspaceState" cws
WHERE cws."selectedEventId" IS NOT NULL
ON CONFLICT ("eventId") DO NOTHING;
