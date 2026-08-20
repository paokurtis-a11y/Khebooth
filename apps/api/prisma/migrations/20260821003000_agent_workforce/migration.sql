-- KHE Agent Workforce: agent shift confirmation, availability, private reminders and replacement workflow.

ALTER TABLE "AgentWorkShift" ADD COLUMN IF NOT EXISTS "confirmationStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "AgentWorkShift" ADD COLUMN IF NOT EXISTS "confirmationRequestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "AgentWorkShift" ADD COLUMN IF NOT EXISTS "respondedAt" TIMESTAMP(3);
ALTER TABLE "AgentWorkShift" ADD COLUMN IF NOT EXISTS "responseNote" TEXT;
DO $$ BEGIN
  ALTER TABLE "AgentWorkShift" ADD CONSTRAINT "AgentWorkShift_confirmation_check" CHECK ("confirmationStatus" IN ('PENDING','ACCEPTED','DECLINED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "AgentWorkShift_org_confirmation_idx" ON "AgentWorkShift"("organizationId","confirmationStatus","startsAt");

CREATE TABLE IF NOT EXISTS "AgentWorkShiftResponse" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "shiftId" UUID NOT NULL REFERENCES "AgentWorkShift"("id") ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  response TEXT NOT NULL,
  note TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentWorkShiftResponse_response_check" CHECK (response IN ('ACCEPTED','DECLINED'))
);
CREATE INDEX IF NOT EXISTS "AgentWorkShiftResponse_shift_idx" ON "AgentWorkShiftResponse"("shiftId","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AgentWorkShiftResponse_user_idx" ON "AgentWorkShiftResponse"("userId","createdAt" DESC);

CREATE TABLE IF NOT EXISTS "AgentAvailabilityBlock" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  note TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentAvailabilityBlock_dates_check" CHECK ("endsAt">"startsAt"),
  CONSTRAINT "AgentAvailabilityBlock_status_check" CHECK (status IN ('ACTIVE','CANCELLED'))
);
CREATE INDEX IF NOT EXISTS "AgentAvailabilityBlock_user_time_idx" ON "AgentAvailabilityBlock"("userId","startsAt","endsAt") WHERE status='ACTIVE';
CREATE INDEX IF NOT EXISTS "AgentAvailabilityBlock_org_time_idx" ON "AgentAvailabilityBlock"("organizationId","startsAt","endsAt") WHERE status='ACTIVE';

CREATE TABLE IF NOT EXISTS "AgentWorkShiftReminder" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "shiftId" UUID NOT NULL REFERENCES "AgentWorkShift"("id") ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  kind TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentWorkShiftReminder_kind_check" CHECK (kind IN ('ASSIGNMENT','REMINDER_24H','REMINDER_2H')),
  UNIQUE("shiftId","userId",kind)
);
CREATE INDEX IF NOT EXISTS "AgentWorkShiftReminder_user_time_idx" ON "AgentWorkShiftReminder"("userId","sentAt" DESC);

CREATE TABLE IF NOT EXISTS "AgentWorkforceNotice" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'SYSTEM',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  "actionUrl" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentWorkforceNotice_kind_check" CHECK (kind IN ('SYSTEM','ASSIGNMENT','REMINDER','MANAGER'))
);
CREATE INDEX IF NOT EXISTS "AgentWorkforceNotice_user_time_idx" ON "AgentWorkforceNotice"("userId","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AgentWorkforceNotice_unread_idx" ON "AgentWorkforceNotice"("userId","createdAt" DESC) WHERE "readAt" IS NULL;
