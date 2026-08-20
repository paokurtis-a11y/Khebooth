-- KHE Workforce Intelligence: staffing forecasts, planned shifts and understaffing alerts.

CREATE TABLE IF NOT EXISTS "WorkforceIntelligenceConfig" (
  "organizationId" UUID PRIMARY KEY REFERENCES "Organization"("id") ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  "historyDays" INTEGER NOT NULL DEFAULT 56,
  "forecastDays" INTEGER NOT NULL DEFAULT 7,
  "slotMinutes" INTEGER NOT NULL DEFAULT 60,
  "forecastTimezone" TEXT NOT NULL DEFAULT 'Europe/Zurich',
  "targetUtilizationPct" INTEGER NOT NULL DEFAULT 75,
  "safetyBufferPct" INTEGER NOT NULL DEFAULT 20,
  "serviceMinutesPerRequest" INTEGER NOT NULL DEFAULT 18,
  "minAgentsPerDemandSlot" INTEGER NOT NULL DEFAULT 1,
  "alertGapAgents" INTEGER NOT NULL DEFAULT 1,
  "notifyUnderstaffing" BOOLEAN NOT NULL DEFAULT FALSE,
  "countryForecastEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "lastPulseAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkforceIntelligenceConfig_history_check" CHECK ("historyDays" BETWEEN 14 AND 365),
  CONSTRAINT "WorkforceIntelligenceConfig_forecast_check" CHECK ("forecastDays" BETWEEN 1 AND 30),
  CONSTRAINT "WorkforceIntelligenceConfig_slot_check" CHECK ("slotMinutes" IN (30,60)),
  CONSTRAINT "WorkforceIntelligenceConfig_utilization_check" CHECK ("targetUtilizationPct" BETWEEN 40 AND 95),
  CONSTRAINT "WorkforceIntelligenceConfig_buffer_check" CHECK ("safetyBufferPct" BETWEEN 0 AND 100),
  CONSTRAINT "WorkforceIntelligenceConfig_service_check" CHECK ("serviceMinutesPerRequest" BETWEEN 5 AND 120),
  CONSTRAINT "WorkforceIntelligenceConfig_min_agents_check" CHECK ("minAgentsPerDemandSlot" BETWEEN 0 AND 20),
  CONSTRAINT "WorkforceIntelligenceConfig_gap_check" CHECK ("alertGapAgents" BETWEEN 1 AND 20)
);
INSERT INTO "WorkforceIntelligenceConfig" ("organizationId") SELECT id FROM "Organization" ON CONFLICT ("organizationId") DO NOTHING;

CREATE TABLE IF NOT EXISTS "AgentWorkShift" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  status TEXT NOT NULL DEFAULT 'PLANNED',
  source TEXT NOT NULL DEFAULT 'MANUAL',
  note TEXT,
  "createdByUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentWorkShift_dates_check" CHECK ("endsAt">"startsAt"),
  CONSTRAINT "AgentWorkShift_status_check" CHECK (status IN ('PLANNED','CANCELLED','COMPLETED')),
  CONSTRAINT "AgentWorkShift_source_check" CHECK (source IN ('MANUAL','RECOMMENDED'))
);
CREATE INDEX IF NOT EXISTS "AgentWorkShift_org_time_idx" ON "AgentWorkShift"("organizationId","startsAt","endsAt");
CREATE INDEX IF NOT EXISTS "AgentWorkShift_user_time_idx" ON "AgentWorkShift"("userId","startsAt","endsAt");

CREATE TABLE IF NOT EXISTS "WorkforceAlert" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "slotStart" TIMESTAMP(3) NOT NULL,
  "slotEnd" TIMESTAMP(3) NOT NULL,
  severity TEXT NOT NULL,
  "requiredAgents" INTEGER NOT NULL,
  "scheduledAgents" INTEGER NOT NULL,
  "gapAgents" INTEGER NOT NULL,
  languages TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  topics TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "countryCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'OPEN',
  "acknowledgedByUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "acknowledgedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkforceAlert_severity_check" CHECK (severity IN ('WATCH','HIGH','CRITICAL')),
  CONSTRAINT "WorkforceAlert_status_check" CHECK (status IN ('OPEN','ACKNOWLEDGED','RESOLVED')),
  CONSTRAINT "WorkforceAlert_gap_check" CHECK ("gapAgents">=0),
  CONSTRAINT "WorkforceAlert_slot_check" CHECK ("slotEnd">"slotStart"),
  UNIQUE("organizationId","slotStart","slotEnd")
);
CREATE INDEX IF NOT EXISTS "WorkforceAlert_org_status_idx" ON "WorkforceAlert"("organizationId",status,"slotStart");
