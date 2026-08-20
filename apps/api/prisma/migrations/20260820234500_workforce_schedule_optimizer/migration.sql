-- KHE Workforce Schedule Optimizer: draft proposals, explicit approval and controlled application.

CREATE TABLE IF NOT EXISTS "WorkforceScheduleProposal" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  "horizonDays" INTEGER NOT NULL,
  "forecastTimezone" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "sampleSize" INTEGER NOT NULL DEFAULT 0,
  "requiredAgentSlots" INTEGER NOT NULL DEFAULT 0,
  "proposedAgentSlots" INTEGER NOT NULL DEFAULT 0,
  "uncoveredAgentSlots" INTEGER NOT NULL DEFAULT 0,
  "coveragePct" NUMERIC(5,2) NOT NULL DEFAULT 0,
  note TEXT,
  "optimizerVersion" TEXT NOT NULL DEFAULT 'workforce-scheduler-v1',
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdByUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "approvedByUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "approvedAt" TIMESTAMP(3),
  "appliedByUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "appliedAt" TIMESTAMP(3),
  "rejectedByUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkforceScheduleProposal_status_check" CHECK (status IN ('DRAFT','APPROVED','APPLIED','REJECTED','EXPIRED')),
  CONSTRAINT "WorkforceScheduleProposal_horizon_check" CHECK ("horizonDays" BETWEEN 1 AND 14),
  CONSTRAINT "WorkforceScheduleProposal_dates_check" CHECK ("endsAt">"startsAt"),
  CONSTRAINT "WorkforceScheduleProposal_slots_check" CHECK ("requiredAgentSlots">=0 AND "proposedAgentSlots">=0 AND "uncoveredAgentSlots">=0),
  CONSTRAINT "WorkforceScheduleProposal_coverage_check" CHECK ("coveragePct" BETWEEN 0 AND 100)
);
CREATE INDEX IF NOT EXISTS "WorkforceScheduleProposal_org_status_idx" ON "WorkforceScheduleProposal"("organizationId",status,"createdAt" DESC);

CREATE TABLE IF NOT EXISTS "WorkforceScheduleProposalShift" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "proposalId" UUID NOT NULL REFERENCES "WorkforceScheduleProposal"("id") ON DELETE CASCADE,
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  score INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT 'KHE_OPTIMIZER',
  languages TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  skills TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "slotCount" INTEGER NOT NULL DEFAULT 1,
  "plannedMinutes" INTEGER NOT NULL,
  "editedByUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "editedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkforceScheduleProposalShift_dates_check" CHECK ("endsAt">"startsAt"),
  CONSTRAINT "WorkforceScheduleProposalShift_minutes_check" CHECK ("plannedMinutes">0 AND "plannedMinutes"<=960),
  CONSTRAINT "WorkforceScheduleProposalShift_slots_check" CHECK ("slotCount">0 AND "slotCount"<=48)
);
CREATE INDEX IF NOT EXISTS "WorkforceScheduleProposalShift_proposal_idx" ON "WorkforceScheduleProposalShift"("proposalId","startsAt");
CREATE INDEX IF NOT EXISTS "WorkforceScheduleProposalShift_agent_idx" ON "WorkforceScheduleProposalShift"("userId","startsAt","endsAt");

ALTER TABLE "AgentWorkShift" ADD COLUMN IF NOT EXISTS "proposalShiftId" UUID;
DO $$ BEGIN
  ALTER TABLE "AgentWorkShift" ADD CONSTRAINT "AgentWorkShift_proposalShift_fk" FOREIGN KEY ("proposalShiftId") REFERENCES "WorkforceScheduleProposalShift"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "AgentWorkShift_proposalShift_unique" ON "AgentWorkShift"("proposalShiftId") WHERE "proposalShiftId" IS NOT NULL;
