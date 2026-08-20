-- Drain queued support work when an agent explicitly becomes available.
CREATE OR REPLACE FUNCTION khe_dispatch_waiting_work()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE task_row RECORD; picked UUID; load_score INTEGER;
BEGIN
  IF NEW.availability <> 'AVAILABLE' OR NEW."acceptingAssignments" <> TRUE OR NEW."lastHeartbeatAt" <= CURRENT_TIMESTAMP-INTERVAL '90 seconds' THEN
    RETURN NEW;
  END IF;

  -- Touching status invokes the conversation auto-assignment trigger. Each row recalculates live workload.
  UPDATE "SupportConversation"
  SET status='HANDOFF_REQUESTED'
  WHERE "organizationId"=NEW."organizationId" AND status='HANDOFF_REQUESTED' AND "assignedToUserId" IS NULL;

  -- Assign a bounded batch of waiting tasks, re-evaluating load after each assignment.
  FOR task_row IN
    SELECT id,"conversationId",title FROM "SupportTask"
    WHERE "organizationId"=NEW."organizationId" AND "assignedToUserId" IS NULL AND status <> 'DONE'
    ORDER BY "createdAt" ASC LIMIT 25
  LOOP
    SELECT "userId",score INTO picked,load_score FROM khe_pick_available_agent(NEW."organizationId");
    EXIT WHEN picked IS NULL;
    UPDATE "SupportTask" SET "assignedToUserId"=picked,"assignedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP
    WHERE id=task_row.id AND "assignedToUserId" IS NULL;
    IF FOUND THEN
      INSERT INTO "SupportAssignmentAttempt" ("organizationId","conversationId","taskId","agentUserId","assignmentType",status,reason,score)
      VALUES (NEW."organizationId",task_row."conversationId",task_row.id,picked,'TASK','ASSIGNED','KHE_QUEUE_DISPATCH',load_score);
      INSERT INTO "AppNotification" (id,"organizationId",kind,title,body,"actionUrl","publishedAt","createdAt")
      VALUES (gen_random_uuid(),NEW."organizationId",'SUPPORT','KHE a distribué une tâche en attente',task_row.title,'/help?agentConversation='||task_row."conversationId"::text,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "AgentPresence_khe_dispatch_waiting" ON "AgentPresence";
CREATE TRIGGER "AgentPresence_khe_dispatch_waiting"
AFTER INSERT OR UPDATE OF availability,"acceptingAssignments" ON "AgentPresence"
FOR EACH ROW EXECUTE FUNCTION khe_dispatch_waiting_work();
