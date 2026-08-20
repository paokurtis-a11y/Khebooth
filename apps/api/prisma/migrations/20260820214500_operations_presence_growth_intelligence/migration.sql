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
