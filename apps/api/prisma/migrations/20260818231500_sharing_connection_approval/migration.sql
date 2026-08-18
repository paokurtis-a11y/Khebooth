ALTER TABLE "StationRemoteControl"
ADD COLUMN "sharingConnectionStatus" TEXT NOT NULL DEFAULT 'DISCONNECTED',
ADD COLUMN "sharingRequestedAt" TIMESTAMP(3),
ADD COLUMN "sharingRespondedAt" TIMESTAMP(3);

ALTER TABLE "StationRemoteControl"
ADD CONSTRAINT "StationRemoteControl_sharingConnectionStatus_check"
CHECK ("sharingConnectionStatus" IN ('DISCONNECTED', 'PENDING', 'ACCEPTED', 'REJECTED'));
