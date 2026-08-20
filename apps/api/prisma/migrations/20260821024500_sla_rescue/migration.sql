-- KHE SLA Rescue Mode: manager-supervised SLA protection near shift end.
-- Detection and recommendations are automatic; assignment changes remain explicit manager actions.

CREATE TABLE IF NOT EXISTS "SlaRescuePolicy" (
  "organizationId" UUID PRIMARY KEY REFERENCES "Organization"("id") ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  "activationBeforeShiftEndMinutes" INTEGER NOT NULL DEFAULT 30,
  "notifyManagers" BOOLEAN NOT NULL DEFAULT TRUE,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SlaRescuePolicy_activation_check" CHECK ("activationBeforeShiftEndMinutes" BETWEEN 5 AND 120)
);

CREATE TABLE IF NOT EXISTS "SlaRescueCase" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "conversationId" UUID NOT NULL REFERENCES "SupportConversation"("id") ON DELETE CASCADE,
  "shiftId" UUID NOT NULL REFERENCES "AgentWorkShift"("id") ON DELETE CASCADE,
  "fromUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "briefItemId" UUID REFERENCES "ShiftBriefItem"(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  "riskLevel" TEXT NOT NULL,
  "nextSlaDueAt" TIMESTAMP(3),
  "recommendedAction" TEXT NOT NULL,
  "suggestedUserId" UUID REFERENCES "User"(id) ON DELETE SET NULL,
  "selectedUserId" UUID REFERENCES "User"(id) ON DELETE SET NULL,
  reason TEXT,
  "decisionNote" TEXT,
  "decidedByUserId" UUID REFERENCES "User"(id) ON DELETE SET NULL,
  "decidedAt" TIMESTAMP(3),
  "managerNotifiedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SlaRescueCase_status_check" CHECK (status IN ('OPEN','PREPARED','HOLD','ESCALATED','APPLIED','CLOSED','STALE')),
  CONSTRAINT "SlaRescueCase_risk_check" CHECK ("riskLevel" IN ('OVERDUE','URGENT')),
  CONSTRAINT "SlaRescueCase_action_check" CHECK ("recommendedAction" IN ('HOLD','PREPARE_RELAY','ESCALATE')),
  UNIQUE("shiftId","conversationId")
);
CREATE INDEX IF NOT EXISTS "SlaRescueCase_org_status_idx" ON "SlaRescueCase"("organizationId",status,"createdAt" DESC);
CREATE INDEX IF NOT EXISTS "SlaRescueCase_from_user_idx" ON "SlaRescueCase"("fromUserId",status,"createdAt" DESC);
CREATE INDEX IF NOT EXISTS "SlaRescueCase_conversation_idx" ON "SlaRescueCase"("conversationId","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "SlaRescueCase_due_idx" ON "SlaRescueCase"("organizationId","nextSlaDueAt") WHERE status IN ('OPEN','PREPARED','HOLD','ESCALATED');

-- If a normal manager-approved Shift Handover later applies the conversation,
-- close any still-open SLA rescue case for the same shift/conversation.
CREATE OR REPLACE FUNCTION khe_close_sla_rescue_on_handover() RETURNS trigger AS $$
DECLARE handover_shift_id UUID;
BEGIN
  IF NEW.status='APPLIED' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT "shiftId" INTO handover_shift_id FROM "ShiftHandoverBatch" WHERE id=NEW."batchId";
    UPDATE "SlaRescueCase"
    SET status='CLOSED',"closedAt"=COALESCE("closedAt",CURRENT_TIMESTAMP),"updatedAt"=CURRENT_TIMESTAMP
    WHERE "shiftId"=handover_shift_id AND "conversationId"=NEW."conversationId"
      AND status NOT IN ('APPLIED','CLOSED','STALE');
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "ShiftHandoverItem_close_sla_rescue" ON "ShiftHandoverItem";
CREATE TRIGGER "ShiftHandoverItem_close_sla_rescue"
AFTER UPDATE OF status ON "ShiftHandoverItem"
FOR EACH ROW EXECUTE FUNCTION khe_close_sla_rescue_on_handover();
