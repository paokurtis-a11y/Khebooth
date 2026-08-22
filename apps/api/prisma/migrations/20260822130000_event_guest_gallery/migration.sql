CREATE TABLE "EventShareLink" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "tokenVersion" INTEGER NOT NULL DEFAULT 1,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventShareLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventShareLink_tokenHash_key" ON "EventShareLink"("tokenHash");
CREATE INDEX "EventShareLink_event_active_idx" ON "EventShareLink"("organizationId","eventId","revokedAt","createdAt");
ALTER TABLE "EventShareLink" ADD CONSTRAINT "EventShareLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventShareLink" ADD CONSTRAINT "EventShareLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
