ALTER TABLE "StationRemoteControl"
ADD COLUMN "maxDurationSeconds" INTEGER NOT NULL DEFAULT 15;

ALTER TABLE "StationRemoteControl"
ADD CONSTRAINT "StationRemoteControl_maxDurationSeconds_check"
CHECK ("maxDurationSeconds" IN (10, 15, 20, 25, 30));
