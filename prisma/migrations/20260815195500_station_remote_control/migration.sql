CREATE TYPE "RemoteCaptureCommand" AS ENUM ('NONE', 'START', 'PAUSE', 'RESUME', 'STOP');
CREATE TYPE "RemoteCaptureState" AS ENUM ('IDLE', 'COUNTDOWN', 'RECORDING', 'PAUSED', 'SAVING', 'ERROR');
CREATE TYPE "VisualEffect" AS ENUM ('NONE', 'WARM', 'COOL', 'GOLD', 'PARTY');

CREATE TABLE "StationRemoteControl" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "command" "RemoteCaptureCommand" NOT NULL DEFAULT 'NONE',
    "commandVersion" INTEGER NOT NULL DEFAULT 0,
    "acknowledgedVersion" INTEGER NOT NULL DEFAULT 0,
    "runtimeState" "RemoteCaptureState" NOT NULL DEFAULT 'IDLE',
    "selectedEffect" "VisualEffect" NOT NULL DEFAULT 'NONE',
    "elapsedSeconds" INTEGER NOT NULL DEFAULT 0,
    "captureSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StationRemoteControl_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StationRemoteControl_eventId_key" ON "StationRemoteControl"("eventId");
CREATE INDEX "StationRemoteControl_organizationId_eventId_idx" ON "StationRemoteControl"("organizationId", "eventId");

ALTER TABLE "StationRemoteControl"
ADD CONSTRAINT "StationRemoteControl_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StationRemoteControl"
ADD CONSTRAINT "StationRemoteControl_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
