-- KHE Shift Handover: explicit manager-approved transfer of open support conversations after an agent shift ends.

CREATE TABLE IF NOT EXISTS "ShiftHandoverBatch" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "shiftId" UUID NOT NULL REFERENCES "AgentWorkShift"("id") ON DELETE CASCADE,
  "fromUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  trigger TEXT NOT NULL DEFAULT 'CATCH_UP',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  "openConversationCount" INTEGER NOT NULL DEFAULT 0,
  "preparedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShiftHandoverBatch_trigger_check" CHECK (trigger IN ('MANUAL_END','CATCH_UP')),
  CONSTRAINT "ShiftHandoverBatch_status_check" CHECK (status IN ('DRAFT','PARTIAL','COMPLETED','CANCELLED')),
  CONSTRAINT "ShiftHandoverBatch_open_count_check" CHECK ("openConversationCount">=0),
  UNIQUE("shiftId")
);
CREATE INDEX IF NOT EXISTS "ShiftHandoverBatch_org_status_idx" ON "ShiftHandoverBatch"("organizationId",status,"createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ShiftHandoverBatch_from_user_idx" ON "ShiftHandoverBatch"("fromUserId","createdAt" DESC);

CREATE TABLE IF NOT EXISTS "ShiftHandoverItem" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "batchId" UUID NOT NULL REFERENCES "ShiftHandoverBatch"("id") ON DELETE CASCADE,
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "conversationId" UUID NOT NULL REFERENCES "SupportConversation"("id") ON DELETE CASCADE,
  "fromUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "suggestedUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "selectedUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  score INTEGER,
  reason TEXT,
  "agentNote" TEXT,
  "managerNote" TEXT,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  "appliedByUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "appliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShiftHandoverItem_status_check" CHECK (status IN ('PENDING','APPLIED','SKIPPED','STALE')),
  UNIQUE("batchId","conversationId")
);
CREATE INDEX IF NOT EXISTS "ShiftHandoverItem_batch_status_idx" ON "ShiftHandoverItem"("batchId",status,"createdAt");
CREATE INDEX IF NOT EXISTS "ShiftHandoverItem_conversation_idx" ON "ShiftHandoverItem"("conversationId","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ShiftHandoverItem_suggested_idx" ON "ShiftHandoverItem"("suggestedUserId",status) WHERE status='PENDING';
