-- KHE Booth operations intelligence: agent presence, assignment telemetry,
-- support feedback, authenticated usage sessions and privacy-aware geo analytics.

CREATE TABLE IF NOT EXISTS "AgentPresence" (
  "userId" UUID PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "activeSessionKey" TEXT,
  "availability" TEXT NOT NULL DEFAULT 'UNAVAILABLE',
  "acceptingAssignments" BOOLEAN NOT NULL DEFAULT FALSE,
  "lastHeartbeatAt" TIMESTAMP(3),
  "availableSince" TIMESTAMP(3),
  "countryCode" TEXT,
  "regionCode" TEXT,
  "municipality" TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  timezone TEXT,
  "locationSharingEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "locationUpdatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentPresence_availability_check" CHECK ("availability" IN ('UNAVAILABLE','AVAILABLE','BUSY','AWAY')),
  CONSTRAINT "AgentPresence_latitude_check" CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT "AgentPresence_longitude_check" CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
CREATE INDEX IF NOT EXISTS "AgentPresence_org_status_idx" ON "AgentPresence"("organizationId","availability","acceptingAssignments","lastHeartbeatAt" DESC);

CREATE TABLE IF NOT EXISTS "AgentAvailabilityEvent" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "sessionKey" TEXT,
  availability TEXT NOT NULL,
  "acceptingAssignments" BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'WEB_PORTAL',
  "countryCode" TEXT,
  "regionCode" TEXT,
  municipality TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentAvailabilityEvent_availability_check" CHECK (availability IN ('UNAVAILABLE','AVAILABLE','BUSY','AWAY'))
);
CREATE INDEX IF NOT EXISTS "AgentAvailabilityEvent_user_created_idx" ON "AgentAvailabilityEvent"("userId","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AgentAvailabilityEvent_org_created_idx" ON "AgentAvailabilityEvent"("organizationId","createdAt" DESC);

CREATE TABLE IF NOT EXISTS "UserActivitySession" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "clientId" UUID REFERENCES "Client"("id") ON DELETE SET NULL,
  "sessionKey" TEXT NOT NULL,
  surface TEXT NOT NULL DEFAULT 'WEB_PORTAL',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "pageViews" INTEGER NOT NULL DEFAULT 0,
  actions INTEGER NOT NULL DEFAULT 0,
  "countryCode" TEXT,
  "regionCode" TEXT,
  municipality TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  timezone TEXT,
  "locationSharingEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "userAgent" TEXT,
  UNIQUE("userId","sessionKey")
);
CREATE INDEX IF NOT EXISTS "UserActivitySession_org_started_idx" ON "UserActivitySession"("organizationId","startedAt" DESC);
CREATE INDEX IF NOT EXISTS "UserActivitySession_client_started_idx" ON "UserActivitySession"("clientId","startedAt" DESC);
CREATE INDEX IF NOT EXISTS "UserActivitySession_user_started_idx" ON "UserActivitySession"("userId","startedAt" DESC);

CREATE TABLE IF NOT EXISTS "SupportAssignmentAttempt" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "conversationId" UUID REFERENCES "SupportConversation"("id") ON DELETE CASCADE,
  "taskId" UUID REFERENCES "SupportTask"("id") ON DELETE CASCADE,
  "agentUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "assignmentType" TEXT NOT NULL DEFAULT 'CONVERSATION',
  status TEXT NOT NULL DEFAULT 'ASSIGNED',
  reason TEXT,
  score INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "SupportAssignmentAttempt_type_check" CHECK ("assignmentType" IN ('CONVERSATION','TASK')),
  CONSTRAINT "SupportAssignmentAttempt_status_check" CHECK (status IN ('ASSIGNED','COMPLETED','FAILED','NO_AGENT'))
);
CREATE INDEX IF NOT EXISTS "SupportAssignmentAttempt_agent_created_idx" ON "SupportAssignmentAttempt"("agentUserId","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "SupportAssignmentAttempt_org_status_idx" ON "SupportAssignmentAttempt"("organizationId",status,"createdAt" DESC);

CREATE TABLE IF NOT EXISTS "SupportFeedback" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "conversationId" UUID NOT NULL UNIQUE REFERENCES "SupportConversation"("id") ON DELETE CASCADE,
  "agentUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "requesterUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  comment TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportFeedback_rating_check" CHECK (rating BETWEEN 1 AND 5)
);
CREATE INDEX IF NOT EXISTS "SupportFeedback_agent_created_idx" ON "SupportFeedback"("agentUserId","createdAt" DESC);

ALTER TABLE "SupportConversation"
  ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resolvedByUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL;
ALTER TABLE "SupportTask"
  ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "GrowthStrategyConfig" (
  "organizationId" UUID PRIMARY KEY REFERENCES "Organization"("id") ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  "analysisWindowDays" INTEGER NOT NULL DEFAULT 30,
  "highIntentScore" INTEGER NOT NULL DEFAULT 60,
  "regularClientMinSessions" INTEGER NOT NULL DEFAULT 5,
  "regularClientMinActiveDays" INTEGER NOT NULL DEFAULT 3,
  "regularClientMinMinutes" INTEGER NOT NULL DEFAULT 60,
  "geoSegmentationEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "anonymousAnalyticsEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "personalizedNurtureEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "autoPromotionEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "ownerApprovalForPaidCampaigns" BOOLEAN NOT NULL DEFAULT TRUE,
  "strategyNotes" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GrowthStrategyConfig_window_check" CHECK ("analysisWindowDays" BETWEEN 7 AND 365),
  CONSTRAINT "GrowthStrategyConfig_intent_check" CHECK ("highIntentScore" BETWEEN 1 AND 100)
);
INSERT INTO "GrowthStrategyConfig" ("organizationId") SELECT id FROM "Organization" ON CONFLICT ("organizationId") DO NOTHING;

ALTER TABLE "MarketingAnalyticsEvent"
  ADD COLUMN IF NOT EXISTS "sessionId" TEXT,
  ADD COLUMN IF NOT EXISTS consent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "countryCode" TEXT,
  ADD COLUMN IF NOT EXISTS "regionCode" TEXT,
  ADD COLUMN IF NOT EXISTS municipality TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS timezone TEXT;
CREATE INDEX IF NOT EXISTS "MarketingAnalyticsEvent_anonymous_created_idx" ON "MarketingAnalyticsEvent"("anonymousId","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "MarketingAnalyticsEvent_geo_created_idx" ON "MarketingAnalyticsEvent"("organizationId","countryCode","regionCode","createdAt" DESC);

-- Choose only agents who explicitly opted in to receive assignments during the active session.
CREATE OR REPLACE FUNCTION khe_pick_available_agent(org_id UUID)
RETURNS TABLE("userId" UUID, score INTEGER)
LANGUAGE SQL
AS $$
  SELECT u.id,
    (
      (SELECT count(*)::int * 10 FROM "SupportConversation" c WHERE c."assignedToUserId"=u.id AND c.status <> 'RESOLVED') +
      (SELECT count(*)::int FROM "SupportTask" t WHERE t."assignedToUserId"=u.id AND t.status <> 'DONE')
    ) AS score
  FROM "User" u
  JOIN "AgentPresence" p ON p."userId"=u.id
  WHERE u."organizationId"=org_id
    AND u."isActive"=TRUE
    AND u.role IN ('OWNER','ADMIN','OPERATOR')
    AND p.availability='AVAILABLE'
    AND p."acceptingAssignments"=TRUE
    AND p."lastHeartbeatAt">CURRENT_TIMESTAMP-INTERVAL '90 seconds'
  ORDER BY score ASC,p."availableSince" ASC NULLS LAST,u.id ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION khe_auto_assign_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE picked UUID; load_score INTEGER;
BEGIN
  IF NEW.status <> 'HANDOFF_REQUESTED' OR NEW."assignedToUserId" IS NOT NULL THEN RETURN NEW; END IF;
  SELECT "userId",score INTO picked,load_score FROM khe_pick_available_agent(NEW."organizationId");
  IF picked IS NULL THEN
    INSERT INTO "SupportAssignmentAttempt" ("organizationId","conversationId","assignmentType",status,reason)
    VALUES (NEW."organizationId",NEW.id,'CONVERSATION','NO_AGENT','Aucun agent disponible et connecté au moment du transfert');
    RETURN NEW;
  END IF;
  UPDATE "SupportConversation" SET "assignedToUserId"=picked,status='ASSIGNED',"updatedAt"=CURRENT_TIMESTAMP WHERE id=NEW.id AND "assignedToUserId" IS NULL;
  IF FOUND THEN
    INSERT INTO "SupportAssignmentAttempt" ("organizationId","conversationId","agentUserId","assignmentType",status,reason,score)
    VALUES (NEW."organizationId",NEW.id,picked,'CONVERSATION','ASSIGNED','KHE_AUTO_AVAILABILITY',load_score);
    INSERT INTO "SupportMessage" (id,"conversationId",author,body,"createdAt")
    VALUES (gen_random_uuid(),NEW.id,'SYSTEM','KHE a automatiquement assigné cette demande à un agent actuellement disponible.',CURRENT_TIMESTAMP);
    INSERT INTO "AppNotification" (id,"organizationId",kind,title,body,"actionUrl","publishedAt","createdAt")
    VALUES (gen_random_uuid(),NEW."organizationId",'SUPPORT','Nouvelle assignation KHE','KHE vous a assigné une nouvelle demande support.','/help?agentConversation='||NEW.id::text,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
    INSERT INTO "AppNotification" (id,"organizationId",kind,title,body,"actionUrl","publishedAt","createdAt")
    VALUES (gen_random_uuid(),NEW."organizationId",'SUPPORT','Votre demande est prise en charge','KHE a trouvé automatiquement un agent disponible pour votre demande.','/help?conversation='||NEW.id::text,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "SupportConversation_khe_auto_assign" ON "SupportConversation";
CREATE TRIGGER "SupportConversation_khe_auto_assign"
AFTER INSERT OR UPDATE OF status,"assignedToUserId" ON "SupportConversation"
FOR EACH ROW EXECUTE FUNCTION khe_auto_assign_conversation();

CREATE OR REPLACE FUNCTION khe_auto_assign_task()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE picked UUID; load_score INTEGER;
BEGIN
  IF NEW."assignedToUserId" IS NOT NULL THEN
    UPDATE "SupportTask" SET "assignedAt"=COALESCE("assignedAt",CURRENT_TIMESTAMP) WHERE id=NEW.id;
    INSERT INTO "SupportAssignmentAttempt" ("organizationId","conversationId","taskId","agentUserId","assignmentType",status,reason)
    VALUES (NEW."organizationId",NEW."conversationId",NEW.id,NEW."assignedToUserId",'TASK','ASSIGNED','MANUAL_ASSIGNMENT');
    RETURN NEW;
  END IF;
  SELECT "userId",score INTO picked,load_score FROM khe_pick_available_agent(NEW."organizationId");
  IF picked IS NULL THEN
    INSERT INTO "SupportAssignmentAttempt" ("organizationId","conversationId","taskId","assignmentType",status,reason)
    VALUES (NEW."organizationId",NEW."conversationId",NEW.id,'TASK','NO_AGENT','Aucun agent disponible et connecté lors de la création de la tâche');
    RETURN NEW;
  END IF;
  UPDATE "SupportTask" SET "assignedToUserId"=picked,"assignedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE id=NEW.id AND "assignedToUserId" IS NULL;
  INSERT INTO "SupportAssignmentAttempt" ("organizationId","conversationId","taskId","agentUserId","assignmentType",status,reason,score)
  VALUES (NEW."organizationId",NEW."conversationId",NEW.id,picked,'TASK','ASSIGNED','KHE_AUTO_AVAILABILITY',load_score);
  INSERT INTO "AppNotification" (id,"organizationId",kind,title,body,"actionUrl","publishedAt","createdAt")
  VALUES (gen_random_uuid(),NEW."organizationId",'SUPPORT','Nouvelle tâche assignée par KHE',NEW.title,'/help?agentConversation='||NEW."conversationId"::text,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "SupportTask_khe_auto_assign" ON "SupportTask";
CREATE TRIGGER "SupportTask_khe_auto_assign"
AFTER INSERT ON "SupportTask"
FOR EACH ROW EXECUTE FUNCTION khe_auto_assign_task();

CREATE OR REPLACE FUNCTION khe_track_task_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status='DONE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE "SupportTask" SET "completedAt"=COALESCE("completedAt",CURRENT_TIMESTAMP) WHERE id=NEW.id;
    UPDATE "SupportAssignmentAttempt" SET status='COMPLETED',"completedAt"=CURRENT_TIMESTAMP
    WHERE id=(SELECT id FROM "SupportAssignmentAttempt" WHERE "taskId"=NEW.id AND "agentUserId"=NEW."assignedToUserId" AND status='ASSIGNED' ORDER BY "createdAt" DESC LIMIT 1);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "SupportTask_khe_completion" ON "SupportTask";
CREATE TRIGGER "SupportTask_khe_completion"
AFTER UPDATE OF status ON "SupportTask"
FOR EACH ROW EXECUTE FUNCTION khe_track_task_completion();

CREATE OR REPLACE FUNCTION khe_prompt_support_feedback()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status='RESOLVED' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE "SupportConversation" SET "resolvedAt"=CURRENT_TIMESTAMP,"resolvedByUserId"=COALESCE(NEW."assignedToUserId","resolvedByUserId") WHERE id=NEW.id;
    UPDATE "SupportAssignmentAttempt" SET status='COMPLETED',"completedAt"=CURRENT_TIMESTAMP
    WHERE id=(SELECT id FROM "SupportAssignmentAttempt" WHERE "conversationId"=NEW.id AND "assignmentType"='CONVERSATION' AND "agentUserId"=NEW."assignedToUserId" AND status='ASSIGNED' ORDER BY "createdAt" DESC LIMIT 1);
    INSERT INTO "SupportMessage" (id,"conversationId",author,body,"createdAt")
    VALUES (gen_random_uuid(),NEW.id,'KHE','Votre demande est résolue. Votre avis nous aide à améliorer KHE BOOTH : notez l’agent de 1 à 5 étoiles et ajoutez un commentaire si vous le souhaitez.',CURRENT_TIMESTAMP);
    INSERT INTO "AppNotification" (id,"organizationId",kind,title,body,"actionUrl","publishedAt","createdAt")
    VALUES (gen_random_uuid(),NEW."organizationId",'SUPPORT','Comment s’est passée votre assistance ?','Votre demande est résolue. Notez l’agent KHE et partagez votre avis.','/help?conversation='||NEW.id::text||'&feedback=1',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "SupportConversation_khe_feedback" ON "SupportConversation";
CREATE TRIGGER "SupportConversation_khe_feedback"
AFTER UPDATE OF status ON "SupportConversation"
FOR EACH ROW EXECUTE FUNCTION khe_prompt_support_feedback();
