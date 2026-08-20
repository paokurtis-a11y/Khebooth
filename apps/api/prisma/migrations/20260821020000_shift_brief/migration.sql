-- KHE Shift Brief: pre-handover preparation, SLA visibility and incoming coverage without automatic reassignment.

CREATE TABLE IF NOT EXISTS "ShiftBriefPolicy" (
  "organizationId" UUID PRIMARY KEY REFERENCES "Organization"("id") ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  "prepareBeforeMinutes" INTEGER NOT NULL DEFAULT 30,
  "slaUrgentMinutes" INTEGER NOT NULL DEFAULT 60,
  "coverageLookaheadMinutes" INTEGER NOT NULL DEFAULT 120,
  "notifyAgent" BOOLEAN NOT NULL DEFAULT TRUE,
  "notifyManagers" BOOLEAN NOT NULL DEFAULT TRUE,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShiftBriefPolicy_prepare_check" CHECK ("prepareBeforeMinutes" BETWEEN 5 AND 120),
  CONSTRAINT "ShiftBriefPolicy_sla_check" CHECK ("slaUrgentMinutes" BETWEEN 15 AND 240),
  CONSTRAINT "ShiftBriefPolicy_coverage_check" CHECK ("coverageLookaheadMinutes" BETWEEN 30 AND 360)
);

CREATE TABLE IF NOT EXISTS "ShiftBrief" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "shiftId" UUID NOT NULL REFERENCES "AgentWorkShift"("id") ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'OPEN',
  "openConversationCount" INTEGER NOT NULL DEFAULT 0,
  "urgentSlaCount" INTEGER NOT NULL DEFAULT 0,
  "missingNoteCount" INTEGER NOT NULL DEFAULT 0,
  "candidateCoverageCount" INTEGER NOT NULL DEFAULT 0,
  "incomingAgentCount" INTEGER NOT NULL DEFAULT 0,
  "preparedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastRefreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "agentNotifiedAt" TIMESTAMP(3),
  "managerNotifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShiftBrief_status_check" CHECK (status IN ('OPEN','READY','CLOSED','EXPIRED')),
  CONSTRAINT "ShiftBrief_counts_check" CHECK ("openConversationCount">=0 AND "urgentSlaCount">=0 AND "missingNoteCount">=0 AND "candidateCoverageCount">=0 AND "incomingAgentCount">=0),
  UNIQUE("shiftId")
);
CREATE INDEX IF NOT EXISTS "ShiftBrief_org_status_idx" ON "ShiftBrief"("organizationId",status,"createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ShiftBrief_user_idx" ON "ShiftBrief"("userId","createdAt" DESC);

CREATE TABLE IF NOT EXISTS "ShiftBriefItem" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "briefId" UUID NOT NULL REFERENCES "ShiftBrief"("id") ON DELETE CASCADE,
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "conversationId" UUID NOT NULL REFERENCES "SupportConversation"("id") ON DELETE CASCADE,
  "fromUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "suggestedUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "riskLevel" TEXT NOT NULL DEFAULT 'NORMAL',
  "nextSlaDueAt" TIMESTAMP(3),
  score INTEGER,
  reason TEXT,
  "agentNote" TEXT,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShiftBriefItem_risk_check" CHECK ("riskLevel" IN ('OVERDUE','URGENT','WATCH','NORMAL')),
  UNIQUE("briefId","conversationId")
);
CREATE INDEX IF NOT EXISTS "ShiftBriefItem_brief_risk_idx" ON "ShiftBriefItem"("briefId","riskLevel","createdAt");
CREATE INDEX IF NOT EXISTS "ShiftBriefItem_conversation_idx" ON "ShiftBriefItem"("conversationId","createdAt" DESC);

-- Carry the agent's pre-shift note into the final manager-approved handover item.
CREATE OR REPLACE FUNCTION khe_copy_shift_brief_note_to_handover() RETURNS trigger AS $$
DECLARE brief_note TEXT;
BEGIN
  IF NEW."agentNote" IS NULL THEN
    SELECT bi."agentNote" INTO brief_note
    FROM "ShiftBriefItem" bi
    JOIN "ShiftBrief" b ON b.id=bi."briefId"
    JOIN "ShiftHandoverBatch" hb ON hb.id=NEW."batchId" AND hb."shiftId"=b."shiftId"
    WHERE bi."conversationId"=NEW."conversationId"
    ORDER BY bi."updatedAt" DESC LIMIT 1;
    NEW."agentNote" := brief_note;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "ShiftHandoverItem_copy_brief_note" ON "ShiftHandoverItem";
CREATE TRIGGER "ShiftHandoverItem_copy_brief_note" BEFORE INSERT ON "ShiftHandoverItem" FOR EACH ROW EXECUTE FUNCTION khe_copy_shift_brief_note_to_handover();

-- Once the real handover batch exists, the pre-shift brief is historical/read-only.
CREATE OR REPLACE FUNCTION khe_close_shift_brief_on_handover() RETURNS trigger AS $$
BEGIN
  UPDATE "ShiftBrief" SET status='CLOSED',"updatedAt"=CURRENT_TIMESTAMP WHERE "shiftId"=NEW."shiftId" AND status<>'CLOSED';
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "ShiftHandoverBatch_close_brief" ON "ShiftHandoverBatch";
CREATE TRIGGER "ShiftHandoverBatch_close_brief" AFTER INSERT ON "ShiftHandoverBatch" FOR EACH ROW EXECUTE FUNCTION khe_close_shift_brief_on_handover();
