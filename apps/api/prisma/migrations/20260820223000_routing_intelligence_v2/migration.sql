-- KHE Routing Intelligence v2: skills, languages, working hours, SLA and escalation.

CREATE TABLE IF NOT EXISTS "AgentRoutingProfile" (
  "userId" UUID PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  skills TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  languages TEXT[] NOT NULL DEFAULT ARRAY['fr']::TEXT[],
  timezone TEXT,
  "workingDays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "workStartLocal" TIME,
  "workEndLocal" TIME,
  "maxActiveConversations" INTEGER NOT NULL DEFAULT 5,
  "maxActiveTasks" INTEGER NOT NULL DEFAULT 15,
  "priorityBias" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentRoutingProfile_conversation_cap" CHECK ("maxActiveConversations" BETWEEN 1 AND 50),
  CONSTRAINT "AgentRoutingProfile_task_cap" CHECK ("maxActiveTasks" BETWEEN 1 AND 100),
  CONSTRAINT "AgentRoutingProfile_priority_bias" CHECK ("priorityBias" BETWEEN -50 AND 50)
);
CREATE INDEX IF NOT EXISTS "AgentRoutingProfile_org_idx" ON "AgentRoutingProfile"("organizationId",enabled);
CREATE INDEX IF NOT EXISTS "AgentRoutingProfile_skills_gin" ON "AgentRoutingProfile" USING GIN(skills);
CREATE INDEX IF NOT EXISTS "AgentRoutingProfile_languages_gin" ON "AgentRoutingProfile" USING GIN(languages);

INSERT INTO "AgentRoutingProfile" ("userId","organizationId")
SELECT id,"organizationId" FROM "User" WHERE role IN ('OWNER','ADMIN','OPERATOR') AND "isActive"=TRUE
ON CONFLICT ("userId") DO NOTHING;

CREATE TABLE IF NOT EXISTS "SupportRoutingPolicy" (
  "organizationId" UUID PRIMARY KEY REFERENCES "Organization"("id") ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  "defaultLanguage" TEXT NOT NULL DEFAULT 'fr',
  "respectAgentWorkingHours" BOOLEAN NOT NULL DEFAULT TRUE,
  "autoReassignOnFirstResponseBreach" BOOLEAN NOT NULL DEFAULT TRUE,
  "criticalFirstResponseMinutes" INTEGER NOT NULL DEFAULT 5,
  "highFirstResponseMinutes" INTEGER NOT NULL DEFAULT 15,
  "normalFirstResponseMinutes" INTEGER NOT NULL DEFAULT 60,
  "lowFirstResponseMinutes" INTEGER NOT NULL DEFAULT 240,
  "criticalResolutionMinutes" INTEGER NOT NULL DEFAULT 60,
  "highResolutionMinutes" INTEGER NOT NULL DEFAULT 240,
  "normalResolutionMinutes" INTEGER NOT NULL DEFAULT 1440,
  "lowResolutionMinutes" INTEGER NOT NULL DEFAULT 2880,
  "escalationGraceMinutes" INTEGER NOT NULL DEFAULT 10,
  "maxEscalationLevel" INTEGER NOT NULL DEFAULT 3,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportRoutingPolicy_response_bounds" CHECK (
    "criticalFirstResponseMinutes" BETWEEN 1 AND 1440 AND "highFirstResponseMinutes" BETWEEN 1 AND 2880 AND
    "normalFirstResponseMinutes" BETWEEN 1 AND 10080 AND "lowFirstResponseMinutes" BETWEEN 1 AND 20160
  ),
  CONSTRAINT "SupportRoutingPolicy_resolution_bounds" CHECK (
    "criticalResolutionMinutes" BETWEEN 5 AND 10080 AND "highResolutionMinutes" BETWEEN 5 AND 20160 AND
    "normalResolutionMinutes" BETWEEN 5 AND 43200 AND "lowResolutionMinutes" BETWEEN 5 AND 86400
  ),
  CONSTRAINT "SupportRoutingPolicy_escalation_bounds" CHECK ("escalationGraceMinutes" BETWEEN 1 AND 1440 AND "maxEscalationLevel" BETWEEN 1 AND 10)
);
INSERT INTO "SupportRoutingPolicy" ("organizationId") SELECT id FROM "Organization" ON CONFLICT ("organizationId") DO NOTHING;

ALTER TABLE "SupportConversation"
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS "routingTopic" TEXT NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN IF NOT EXISTS "requestedLanguage" TEXT NOT NULL DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS "customerTier" TEXT NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN IF NOT EXISTS "slaFirstResponseDueAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "slaResolutionDueAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "firstAgentResponseAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "escalationLevel" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastEscalationReason" TEXT;

DO $$ BEGIN
  ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_priority_check" CHECK (priority IN ('CRITICAL','HIGH','NORMAL','LOW'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_escalation_level_check" CHECK ("escalationLevel" BETWEEN 0 AND 10);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "SupportConversation_sla_first_idx" ON "SupportConversation"("organizationId","slaFirstResponseDueAt") WHERE status <> 'RESOLVED' AND "firstAgentResponseAt" IS NULL;
CREATE INDEX IF NOT EXISTS "SupportConversation_sla_resolution_idx" ON "SupportConversation"("organizationId","slaResolutionDueAt") WHERE status <> 'RESOLVED';
CREATE INDEX IF NOT EXISTS "SupportConversation_routing_idx" ON "SupportConversation"("organizationId",priority,"routingTopic","requestedLanguage",status);

CREATE OR REPLACE FUNCTION khe_detect_support_topic(input_text TEXT)
RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE
    WHEN lower(COALESCE(input_text,'')) ~ '(urgent|evenement en cours|événement en cours|prestation en cours|panne|bloque maintenant)' THEN 'EVENT_LIVE'
    WHEN lower(COALESCE(input_text,'')) ~ '(enterprise|kyc|onboarding|reverification|revérification|identite|identité|justificatif)' THEN 'ENTERPRISE'
    WHEN lower(COALESCE(input_text,'')) ~ '(paiement|facture|billing|stripe|abonnement|subscription|twint)' THEN 'BILLING'
    WHEN lower(COALESCE(input_text,'')) ~ '(camera|caméra|photo|video|vidéo|capture|microphone)' THEN 'CAPTURE'
    WHEN lower(COALESCE(input_text,'')) ~ '(sharing|partage|deuxieme tablette|deuxième tablette)' THEN 'SHARING'
    WHEN lower(COALESCE(input_text,'')) ~ '(synchron|sync|upload|transfert|media manquant|média manquant)' THEN 'SYNC'
    WHEN lower(COALESCE(input_text,'')) ~ '(imprim|printer|print)' THEN 'PRINTING'
    WHEN lower(COALESCE(input_text,'')) ~ '(mot de passe|login|connexion|identifiant|username|compte)' THEN 'ACCOUNT'
    WHEN lower(COALESCE(input_text,'')) ~ '(crm|marketing|newsletter|consentement|désabonn|desabonn)' THEN 'CRM'
    WHEN lower(COALESCE(input_text,'')) ~ '(securite|sécurité|privacy|confidentialite|confidentialité|donnees|données)' THEN 'SECURITY'
    ELSE 'GENERAL' END;
$$;

CREATE OR REPLACE FUNCTION khe_detect_support_language(input_text TEXT, fallback TEXT DEFAULT 'fr')
RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE
    WHEN lower(COALESCE(input_text,'')) ~ '(hallo|hilfe|rechnung|passwort|anmeldung|bitte)' THEN 'de'
    WHEN lower(COALESCE(input_text,'')) ~ '(hola|ayuda|factura|contraseña|cuenta|por favor)' THEN 'es'
    WHEN lower(COALESCE(input_text,'')) ~ '(ciao|aiuto|fattura|password|account|per favore)' THEN 'it'
    WHEN lower(COALESCE(input_text,'')) ~ '(olá|ola |ajuda|fatura|senha|conta|por favor)' THEN 'pt'
    WHEN lower(COALESCE(input_text,'')) ~ '(hello|help|invoice|password|account|please)' THEN 'en'
    WHEN lower(COALESCE(input_text,'')) ~ '(bonjour|aide|facture|mot de passe|compte|s.il vous plait|s’il vous plaît)' THEN 'fr'
    ELSE COALESCE(NULLIF(fallback,''),'fr') END;
$$;

CREATE OR REPLACE FUNCTION khe_classify_support_conversation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE default_lang TEXT; requester_tenant TEXT;
BEGIN
  SELECT COALESCE("defaultLanguage",'fr') INTO default_lang FROM "SupportRoutingPolicy" WHERE "organizationId"=NEW."organizationId";
  SELECT COALESCE("tenantKind",'KHE_ROOT') INTO requester_tenant FROM "User" WHERE id=NEW."requesterUserId";
  IF TG_OP='INSERT' OR NEW."routingTopic" IS NULL OR NEW."routingTopic"='GENERAL' THEN NEW."routingTopic":=khe_detect_support_topic(NEW.subject); END IF;
  IF TG_OP='INSERT' OR NEW."requestedLanguage" IS NULL THEN NEW."requestedLanguage":=khe_detect_support_language(NEW.subject,default_lang); END IF;
  IF requester_tenant='ENTERPRISE_CLIENT' THEN NEW."customerTier":='ENTERPRISE'; ELSE NEW."customerTier":=COALESCE(NEW."customerTier",'STANDARD'); END IF;
  IF lower(COALESCE(NEW.subject,'')) ~ '(urgent|evenement en cours|événement en cours|prestation en cours|panne|bloque maintenant)' THEN NEW.priority:='CRITICAL';
  ELSIF NEW."customerTier"='ENTERPRISE' OR NEW."routingTopic" IN ('ENTERPRISE','BILLING','SECURITY') THEN NEW.priority:=CASE WHEN NEW.priority='CRITICAL' THEN 'CRITICAL' ELSE 'HIGH' END;
  ELSE NEW.priority:=COALESCE(NEW.priority,'NORMAL'); END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "SupportConversation_khe_classify" ON "SupportConversation";
CREATE TRIGGER "SupportConversation_khe_classify" BEFORE INSERT OR UPDATE OF subject ON "SupportConversation" FOR EACH ROW EXECUTE FUNCTION khe_classify_support_conversation();

CREATE OR REPLACE FUNCTION khe_set_support_sla()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE p "SupportRoutingPolicy"%ROWTYPE; base_time TIMESTAMP(3); first_minutes INTEGER; resolution_minutes INTEGER;
BEGIN
  SELECT * INTO p FROM "SupportRoutingPolicy" WHERE "organizationId"=NEW."organizationId";
  base_time:=COALESCE(NEW."createdAt",CURRENT_TIMESTAMP);
  first_minutes:=CASE NEW.priority WHEN 'CRITICAL' THEN COALESCE(p."criticalFirstResponseMinutes",5) WHEN 'HIGH' THEN COALESCE(p."highFirstResponseMinutes",15) WHEN 'LOW' THEN COALESCE(p."lowFirstResponseMinutes",240) ELSE COALESCE(p."normalFirstResponseMinutes",60) END;
  resolution_minutes:=CASE NEW.priority WHEN 'CRITICAL' THEN COALESCE(p."criticalResolutionMinutes",60) WHEN 'HIGH' THEN COALESCE(p."highResolutionMinutes",240) WHEN 'LOW' THEN COALESCE(p."lowResolutionMinutes",2880) ELSE COALESCE(p."normalResolutionMinutes",1440) END;
  IF TG_OP='INSERT' OR OLD.priority IS DISTINCT FROM NEW.priority OR NEW."slaFirstResponseDueAt" IS NULL THEN NEW."slaFirstResponseDueAt":=base_time+first_minutes*INTERVAL '1 minute'; END IF;
  IF TG_OP='INSERT' OR OLD.priority IS DISTINCT FROM NEW.priority OR NEW."slaResolutionDueAt" IS NULL THEN NEW."slaResolutionDueAt":=base_time+resolution_minutes*INTERVAL '1 minute'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "SupportConversation_khe_sla" ON "SupportConversation";
CREATE TRIGGER "SupportConversation_khe_sla" BEFORE INSERT OR UPDATE OF priority ON "SupportConversation" FOR EACH ROW EXECUTE FUNCTION khe_set_support_sla();

CREATE OR REPLACE FUNCTION khe_pick_available_agent_v2(org_id UUID, topic TEXT DEFAULT 'GENERAL', language_code TEXT DEFAULT 'fr', priority_code TEXT DEFAULT 'NORMAL', exclude_user_id UUID DEFAULT NULL)
RETURNS TABLE("userId" UUID, score INTEGER)
LANGUAGE SQL AS $$
  WITH candidates AS (
    SELECT u.id,p."availableSince",p.timezone presence_timezone,rp.skills,rp.languages,rp.timezone profile_timezone,rp."workingDays",rp."workStartLocal",rp."workEndLocal",
      COALESCE(rp."maxActiveConversations",5) max_conv,COALESCE(rp."maxActiveTasks",15) max_tasks,COALESCE(rp."priorityBias",0) priority_bias,
      (SELECT count(*)::int FROM "SupportConversation" c WHERE c."assignedToUserId"=u.id AND c.status <> 'RESOLVED') active_conv,
      (SELECT count(*)::int FROM "SupportTask" t WHERE t."assignedToUserId"=u.id AND t.status <> 'DONE') active_tasks,
      COALESCE((SELECT avg(f.rating)::float8 FROM "SupportFeedback" f WHERE f."agentUserId"=u.id),4.0) avg_rating,
      COALESCE((SELECT count(*)::int FROM "SupportConversation" rc WHERE rc."assignedToUserId"=u.id AND rc.status='RESOLVED'),0) resolved_count,
      COALESCE(policy."respectAgentWorkingHours",TRUE) respect_hours
    FROM "User" u
    JOIN "AgentPresence" p ON p."userId"=u.id
    LEFT JOIN "AgentRoutingProfile" rp ON rp."userId"=u.id
    LEFT JOIN "SupportRoutingPolicy" policy ON policy."organizationId"=u."organizationId"
    WHERE u."organizationId"=org_id AND u."isActive"=TRUE AND u.role IN ('OWNER','ADMIN','OPERATOR')
      AND COALESCE(rp.enabled,TRUE)=TRUE AND p.availability='AVAILABLE' AND p."acceptingAssignments"=TRUE
      AND p."lastHeartbeatAt">CURRENT_TIMESTAMP-INTERVAL '90 seconds' AND (exclude_user_id IS NULL OR u.id<>exclude_user_id)
  ), eligible AS (
    SELECT *, (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(profile_timezone,presence_timezone,'UTC')) local_now
    FROM candidates WHERE active_conv<max_conv AND active_tasks<max_tasks
  )
  SELECT id AS "userId",
    (active_conv*100 + active_tasks*10
      + CASE WHEN COALESCE(array_length(skills,1),0)=0 OR upper(COALESCE(topic,'GENERAL'))=ANY(skills) THEN 0 ELSE 60 END
      + CASE WHEN lower(COALESCE(language_code,'fr'))=ANY(languages) THEN 0 ELSE 40 END
      + round((5.0-avg_rating)*8)::int
      - LEAST(20,resolved_count/5)
      - priority_bias
      - CASE WHEN priority_code='CRITICAL' AND upper(COALESCE(topic,'GENERAL'))=ANY(skills) THEN 20 ELSE 0 END
    )::int score
  FROM eligible
  WHERE respect_hours=FALSE OR COALESCE(array_length("workingDays",1),0)=0 OR (
    extract(isodow from local_now)::int=ANY("workingDays") AND (
      "workStartLocal" IS NULL OR "workEndLocal" IS NULL OR
      CASE WHEN "workStartLocal"<="workEndLocal" THEN local_now::time BETWEEN "workStartLocal" AND "workEndLocal"
           ELSE local_now::time>="workStartLocal" OR local_now::time<="workEndLocal" END
    )
  )
  ORDER BY score ASC,"availableSince" ASC NULLS LAST,id ASC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION khe_auto_assign_conversation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE picked UUID; route_score INTEGER;
BEGIN
  IF NEW.status <> 'HANDOFF_REQUESTED' OR NEW."assignedToUserId" IS NOT NULL THEN RETURN NEW; END IF;
  SELECT "userId",score INTO picked,route_score FROM khe_pick_available_agent_v2(NEW."organizationId",NEW."routingTopic",NEW."requestedLanguage",NEW.priority,NULL);
  IF picked IS NULL THEN
    INSERT INTO "SupportAssignmentAttempt" ("organizationId","conversationId","assignmentType",status,reason)
    VALUES (NEW."organizationId",NEW.id,'CONVERSATION','NO_AGENT','Aucun agent compatible, disponible et connecté au moment du transfert');
    RETURN NEW;
  END IF;
  UPDATE "SupportConversation" SET "assignedToUserId"=picked,status='ASSIGNED',"updatedAt"=CURRENT_TIMESTAMP WHERE id=NEW.id AND "assignedToUserId" IS NULL;
  IF FOUND THEN
    INSERT INTO "SupportAssignmentAttempt" ("organizationId","conversationId","agentUserId","assignmentType",status,reason,score)
    VALUES (NEW."organizationId",NEW.id,picked,'CONVERSATION','ASSIGNED','KHE_ROUTING_V2',route_score);
    INSERT INTO "SupportMessage" (id,"conversationId",author,body,"createdAt") VALUES (gen_random_uuid(),NEW.id,'SYSTEM','KHE a sélectionné automatiquement l’agent disponible le plus adapté selon charge, compétence, langue et qualité.',CURRENT_TIMESTAMP);
    INSERT INTO "AppNotification" (id,"organizationId",kind,title,body,"actionUrl","publishedAt","createdAt") VALUES (gen_random_uuid(),NEW."organizationId",'SUPPORT','Nouvelle assignation intelligente KHE','Une demande compatible avec votre profil vous a été assignée.','/help?agentConversation='||NEW.id::text,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION khe_auto_assign_task()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE picked UUID; route_score INTEGER; c RECORD;
BEGIN
  IF NEW."assignedToUserId" IS NOT NULL THEN
    UPDATE "SupportTask" SET "assignedAt"=COALESCE("assignedAt",CURRENT_TIMESTAMP) WHERE id=NEW.id;
    INSERT INTO "SupportAssignmentAttempt" ("organizationId","conversationId","taskId","agentUserId","assignmentType",status,reason) VALUES (NEW."organizationId",NEW."conversationId",NEW.id,NEW."assignedToUserId",'TASK','ASSIGNED','MANUAL_ASSIGNMENT');
    RETURN NEW;
  END IF;
  SELECT "routingTopic","requestedLanguage",priority INTO c FROM "SupportConversation" WHERE id=NEW."conversationId";
  SELECT "userId",score INTO picked,route_score FROM khe_pick_available_agent_v2(NEW."organizationId",COALESCE(c."routingTopic",'GENERAL'),COALESCE(c."requestedLanguage",'fr'),COALESCE(c.priority,'NORMAL'),NULL);
  IF picked IS NULL THEN
    INSERT INTO "SupportAssignmentAttempt" ("organizationId","conversationId","taskId","assignmentType",status,reason) VALUES (NEW."organizationId",NEW."conversationId",NEW.id,'TASK','NO_AGENT','Aucun agent compatible, disponible et connecté lors de la création de la tâche');
    RETURN NEW;
  END IF;
  UPDATE "SupportTask" SET "assignedToUserId"=picked,"assignedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE id=NEW.id AND "assignedToUserId" IS NULL;
  INSERT INTO "SupportAssignmentAttempt" ("organizationId","conversationId","taskId","agentUserId","assignmentType",status,reason,score) VALUES (NEW."organizationId",NEW."conversationId",NEW.id,picked,'TASK','ASSIGNED','KHE_ROUTING_V2',route_score);
  INSERT INTO "AppNotification" (id,"organizationId",kind,title,body,"actionUrl","publishedAt","createdAt") VALUES (gen_random_uuid(),NEW."organizationId",'SUPPORT','Nouvelle tâche assignée par KHE',NEW.title,'/help?agentConversation='||NEW."conversationId"::text,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION khe_dispatch_waiting_work()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE task_row RECORD; picked UUID; route_score INTEGER; c RECORD;
BEGIN
  IF NEW.availability <> 'AVAILABLE' OR NEW."acceptingAssignments" <> TRUE OR NEW."lastHeartbeatAt" <= CURRENT_TIMESTAMP-INTERVAL '90 seconds' THEN RETURN NEW; END IF;
  UPDATE "SupportConversation" SET status='HANDOFF_REQUESTED' WHERE "organizationId"=NEW."organizationId" AND status='HANDOFF_REQUESTED' AND "assignedToUserId" IS NULL;
  FOR task_row IN SELECT id,"conversationId",title FROM "SupportTask" WHERE "organizationId"=NEW."organizationId" AND "assignedToUserId" IS NULL AND status <> 'DONE' ORDER BY "createdAt" ASC LIMIT 25 LOOP
    SELECT "routingTopic","requestedLanguage",priority INTO c FROM "SupportConversation" WHERE id=task_row."conversationId";
    SELECT "userId",score INTO picked,route_score FROM khe_pick_available_agent_v2(NEW."organizationId",COALESCE(c."routingTopic",'GENERAL'),COALESCE(c."requestedLanguage",'fr'),COALESCE(c.priority,'NORMAL'),NULL);
    EXIT WHEN picked IS NULL;
    UPDATE "SupportTask" SET "assignedToUserId"=picked,"assignedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE id=task_row.id AND "assignedToUserId" IS NULL;
    IF FOUND THEN
      INSERT INTO "SupportAssignmentAttempt" ("organizationId","conversationId","taskId","agentUserId","assignmentType",status,reason,score) VALUES (NEW."organizationId",task_row."conversationId",task_row.id,picked,'TASK','ASSIGNED','KHE_ROUTING_QUEUE_V2',route_score);
      INSERT INTO "AppNotification" (id,"organizationId",kind,title,body,"actionUrl","publishedAt","createdAt") VALUES (gen_random_uuid(),NEW."organizationId",'SUPPORT','KHE a distribué une tâche compatible',task_row.title,'/help?agentConversation='||task_row."conversationId"::text,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION khe_refresh_routing_from_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE topic TEXT; lang TEXT; current_priority TEXT;
BEGIN
  IF NEW.author <> 'USER' THEN RETURN NEW; END IF;
  topic:=khe_detect_support_topic(NEW.body); lang:=khe_detect_support_language(NEW.body,NULL);
  SELECT priority INTO current_priority FROM "SupportConversation" WHERE id=NEW."conversationId";
  UPDATE "SupportConversation" SET
    "routingTopic"=CASE WHEN topic<>'GENERAL' THEN topic ELSE "routingTopic" END,
    "requestedLanguage"=COALESCE(lang,"requestedLanguage"),
    priority=CASE WHEN lower(NEW.body) ~ '(urgent|evenement en cours|événement en cours|prestation en cours|panne|bloque maintenant)' THEN 'CRITICAL' ELSE priority END,
    "updatedAt"=CURRENT_TIMESTAMP
  WHERE id=NEW."conversationId";
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "SupportMessage_khe_refresh_routing" ON "SupportMessage";
CREATE TRIGGER "SupportMessage_khe_refresh_routing" AFTER INSERT ON "SupportMessage" FOR EACH ROW EXECUTE FUNCTION khe_refresh_routing_from_message();

CREATE OR REPLACE FUNCTION khe_track_first_agent_response()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.author='AGENT' THEN UPDATE "SupportConversation" SET "firstAgentResponseAt"=COALESCE("firstAgentResponseAt",NEW."createdAt"),"updatedAt"=CURRENT_TIMESTAMP WHERE id=NEW."conversationId"; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "SupportMessage_khe_first_response" ON "SupportMessage";
CREATE TRIGGER "SupportMessage_khe_first_response" AFTER INSERT ON "SupportMessage" FOR EACH ROW EXECUTE FUNCTION khe_track_first_agent_response();

CREATE OR REPLACE FUNCTION khe_process_support_sla(org_id UUID)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE row_item RECORD; policy "SupportRoutingPolicy"%ROWTYPE; picked UUID; route_score INTEGER; processed INTEGER:=0; breach TEXT;
BEGIN
  SELECT * INTO policy FROM "SupportRoutingPolicy" WHERE "organizationId"=org_id;
  IF policy.enabled IS DISTINCT FROM TRUE THEN RETURN 0; END IF;
  FOR row_item IN
    SELECT c.* FROM "SupportConversation" c
    WHERE c."organizationId"=org_id AND c.status<>'RESOLVED' AND c."escalationLevel"<COALESCE(policy."maxEscalationLevel",3)
      AND ((c."firstAgentResponseAt" IS NULL AND c."slaFirstResponseDueAt"<CURRENT_TIMESTAMP) OR c."slaResolutionDueAt"<CURRENT_TIMESTAMP)
      AND (c."escalatedAt" IS NULL OR c."escalatedAt"<CURRENT_TIMESTAMP-COALESCE(policy."escalationGraceMinutes",10)*INTERVAL '1 minute')
    ORDER BY CASE c.priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END,c."slaFirstResponseDueAt" ASC
    LIMIT 25
  LOOP
    breach:=CASE WHEN row_item."firstAgentResponseAt" IS NULL AND row_item."slaFirstResponseDueAt"<CURRENT_TIMESTAMP THEN 'FIRST_RESPONSE_SLA_BREACH' ELSE 'RESOLUTION_SLA_BREACH' END;
    picked:=NULL; route_score:=NULL;
    IF breach='FIRST_RESPONSE_SLA_BREACH' AND COALESCE(policy."autoReassignOnFirstResponseBreach",TRUE) THEN
      SELECT "userId",score INTO picked,route_score FROM khe_pick_available_agent_v2(org_id,row_item."routingTopic",row_item."requestedLanguage",row_item.priority,row_item."assignedToUserId");
    END IF;
    IF picked IS NOT NULL THEN
      UPDATE "SupportAssignmentAttempt" SET status='FAILED',reason='SLA_FIRST_RESPONSE_MISSED',"completedAt"=CURRENT_TIMESTAMP WHERE id=(SELECT id FROM "SupportAssignmentAttempt" WHERE "conversationId"=row_item.id AND "assignmentType"='CONVERSATION' AND status='ASSIGNED' ORDER BY "createdAt" DESC LIMIT 1);
      UPDATE "SupportConversation" SET "assignedToUserId"=picked,status='ASSIGNED',"escalationLevel"="escalationLevel"+1,"escalatedAt"=CURRENT_TIMESTAMP,"lastEscalationReason"='SLA_REASSIGNED',"updatedAt"=CURRENT_TIMESTAMP WHERE id=row_item.id;
      INSERT INTO "SupportAssignmentAttempt" ("organizationId","conversationId","agentUserId","assignmentType",status,reason,score) VALUES (org_id,row_item.id,picked,'CONVERSATION','ASSIGNED','KHE_SLA_REASSIGN',route_score);
      INSERT INTO "SupportMessage" (id,"conversationId",author,body,"createdAt") VALUES (gen_random_uuid(),row_item.id,'SYSTEM','KHE a réassigné automatiquement cette demande car le délai de première réponse était dépassé.',CURRENT_TIMESTAMP);
      INSERT INTO "AppNotification" (id,"organizationId",kind,title,body,"actionUrl","publishedAt","createdAt") VALUES (gen_random_uuid(),org_id,'SUPPORT','Réassignation SLA KHE','Une demande prioritaire vous a été réassignée après dépassement du délai de première réponse.','/help?agentConversation='||row_item.id::text,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
    ELSE
      UPDATE "SupportConversation" SET "escalationLevel"="escalationLevel"+1,"escalatedAt"=CURRENT_TIMESTAMP,"lastEscalationReason"=breach,"updatedAt"=CURRENT_TIMESTAMP WHERE id=row_item.id;
      INSERT INTO "AppNotification" (id,"organizationId",kind,title,body,"actionUrl","publishedAt","createdAt") VALUES (gen_random_uuid(),org_id,'SUPPORT','⚠ SLA support à risque',CASE WHEN breach='FIRST_RESPONSE_SLA_BREACH' THEN 'Une demande attend sa première réponse au-delà du SLA.' ELSE 'Une demande dépasse son délai cible de résolution.' END,'/operations/routing',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
    END IF;
    processed:=processed+1;
  END LOOP;
  RETURN processed;
END;
$$;
