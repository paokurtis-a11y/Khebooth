CREATE TABLE IF NOT EXISTS "StationNotificationMailbox" (
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "notificationId" UUID NOT NULL REFERENCES "AppNotification"("id") ON DELETE CASCADE,
  "state" TEXT NOT NULL DEFAULT 'ACTIVE',
  "readAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "trashedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("organizationId", "notificationId"),
  CONSTRAINT "StationNotificationMailbox_state_check" CHECK ("state" IN ('ACTIVE', 'ARCHIVED', 'TRASHED'))
);

CREATE INDEX IF NOT EXISTS "StationNotificationMailbox_org_state_idx"
  ON "StationNotificationMailbox"("organizationId", "state", "updatedAt" DESC);

CREATE INDEX IF NOT EXISTS "StationNotificationMailbox_trashedAt_idx"
  ON "StationNotificationMailbox"("trashedAt")
  WHERE "state" = 'TRASHED';
