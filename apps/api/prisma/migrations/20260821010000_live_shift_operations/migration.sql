-- KHE Live Shift Operations: live execution, no-show alerts and optional routing gate.

CREATE TABLE IF NOT EXISTS "LiveShiftPolicy" (
  "organizationId" UUID PRIMARY KEY REFERENCES "Organization"("id") ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  "startEarlyMinutes" INTEGER NOT NULL DEFAULT 30,
  "startGraceMinutes" INTEGER NOT NULL DEFAULT 10,
  "noShowAlertMinutes" INTEGER NOT NULL DEFAULT 10,
  "autoCloseMinutes" INTEGER NOT NULL DEFAULT 15,
  "requireActiveShiftForRouting" BOOLEAN NOT NULL DEFAULT FALSE,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveShiftPolicy_early_check" CHECK ("startEarlyMinutes" BETWEEN 0 AND 180),
  CONSTRAINT "LiveShiftPolicy_grace_check" CHECK ("startGraceMinutes" BETWEEN 0 AND 180),
  CONSTRAINT "LiveShiftPolicy_no_show_check" CHECK ("noShowAlertMinutes" BETWEEN 1 AND 180),
  CONSTRAINT "LiveShiftPolicy_auto_close_check" CHECK ("autoCloseMinutes" BETWEEN 0 AND 240)
);
INSERT INTO "LiveShiftPolicy" ("organizationId") SELECT id FROM "Organization" ON CONFLICT ("organizationId") DO NOTHING;

ALTER TABLE "AgentWorkShift"
  ADD COLUMN IF NOT EXISTS "liveStatus" TEXT NOT NULL DEFAULT 'SCHEDULED',
  ADD COLUMN IF NOT EXISTS "actualStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "actualEndedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pauseStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pausedSeconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastLiveActionAt" TIMESTAMP(3);
DO $$ BEGIN
  ALTER TABLE "AgentWorkShift" ADD CONSTRAINT "AgentWorkShift_live_status_check" CHECK ("liveStatus" IN ('SCHEDULED','ACTIVE','PAUSED','COMPLETED','MISSED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AgentWorkShift" ADD CONSTRAINT "AgentWorkShift_paused_seconds_check" CHECK ("pausedSeconds">=0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "AgentWorkShift_live_org_idx" ON "AgentWorkShift"("organizationId","liveStatus","startsAt","endsAt");
CREATE INDEX IF NOT EXISTS "AgentWorkShift_live_user_idx" ON "AgentWorkShift"("userId","liveStatus","startsAt","endsAt");

CREATE TABLE IF NOT EXISTS "AgentWorkShiftLiveEvent" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "shiftId" UUID NOT NULL REFERENCES "AgentWorkShift"(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentWorkShiftLiveEvent_action_check" CHECK (action IN ('START','PAUSE','RESUME','END','AUTO_END','MISSED'))
);
CREATE INDEX IF NOT EXISTS "AgentWorkShiftLiveEvent_shift_idx" ON "AgentWorkShiftLiveEvent"("shiftId","createdAt");
CREATE INDEX IF NOT EXISTS "AgentWorkShiftLiveEvent_org_idx" ON "AgentWorkShiftLiveEvent"("organizationId","createdAt" DESC);

CREATE TABLE IF NOT EXISTS "LiveShiftAlert" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "shiftId" UUID NOT NULL REFERENCES "AgentWorkShift"(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'HIGH',
  status TEXT NOT NULL DEFAULT 'OPEN',
  "acknowledgedByUserId" UUID REFERENCES "User"(id) ON DELETE SET NULL,
  "acknowledgedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveShiftAlert_type_check" CHECK (type IN ('NO_SHOW')),
  CONSTRAINT "LiveShiftAlert_severity_check" CHECK (severity IN ('WATCH','HIGH','CRITICAL')),
  CONSTRAINT "LiveShiftAlert_status_check" CHECK (status IN ('OPEN','ACKNOWLEDGED','RESOLVED')),
  UNIQUE("shiftId",type)
);
CREATE INDEX IF NOT EXISTS "LiveShiftAlert_org_status_idx" ON "LiveShiftAlert"("organizationId",status,"createdAt" DESC);

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
      COALESCE(policy."respectAgentWorkingHours",TRUE) respect_hours,
      COALESCE(live."requireActiveShiftForRouting",FALSE) require_live_shift,
      COALESCE(live."autoCloseMinutes",15) auto_close_minutes
    FROM "User" u
    JOIN "AgentPresence" p ON p."userId"=u.id
    LEFT JOIN "AgentRoutingProfile" rp ON rp."userId"=u.id
    LEFT JOIN "SupportRoutingPolicy" policy ON policy."organizationId"=u."organizationId"
    LEFT JOIN "LiveShiftPolicy" live ON live."organizationId"=u."organizationId"
    WHERE u."organizationId"=org_id AND u."isActive"=TRUE AND u.role IN ('OWNER','ADMIN','OPERATOR')
      AND COALESCE(rp.enabled,TRUE)=TRUE AND p.availability='AVAILABLE' AND p."acceptingAssignments"=TRUE
      AND p."lastHeartbeatAt">CURRENT_TIMESTAMP-INTERVAL '90 seconds' AND (exclude_user_id IS NULL OR u.id<>exclude_user_id)
  ), eligible AS (
    SELECT *, (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(profile_timezone,presence_timezone,'UTC')) local_now
    FROM candidates
    WHERE active_conv<max_conv AND active_tasks<max_tasks
      AND (require_live_shift=FALSE OR EXISTS(
        SELECT 1 FROM "AgentWorkShift" s
        WHERE s."organizationId"=org_id AND s."userId"=candidates.id AND s.status='PLANNED' AND s."liveStatus"='ACTIVE'
          AND s."actualStartedAt" IS NOT NULL AND CURRENT_TIMESTAMP < s."endsAt" + auto_close_minutes*INTERVAL '1 minute'
      ))
  )
  SELECT id AS "userId",
    (active_conv*100 + active_tasks*10
      + CASE WHEN COALESCE(array_length(skills,1),0)=0 OR upper(COALESCE(topic,'GENERAL'))=ANY(skills) THEN 0 ELSE 60 END
      + CASE WHEN lower(COALESCE(language_code,'fr'))=ANY(languages) THEN 0 ELSE 40 END
      + round((5.0-avg_rating)*8)::int - LEAST(20,resolved_count/5) - priority_bias
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
