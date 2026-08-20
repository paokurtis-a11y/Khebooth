CREATE TABLE IF NOT EXISTS "SecurityAutomationConfig" (
  "organizationId" UUID PRIMARY KEY REFERENCES "Organization"("id") ON DELETE CASCADE,
  "mode" TEXT NOT NULL DEFAULT 'AUTO_SAFE',
  "safeAutoContainment" BOOLEAN NOT NULL DEFAULT TRUE,
  "emailAlerts" BOOLEAN NOT NULL DEFAULT TRUE,
  "ownerReports" BOOLEAN NOT NULL DEFAULT TRUE,
  "failedLoginThreshold" INTEGER NOT NULL DEFAULT 5,
  "healthScanMinutes" INTEGER NOT NULL DEFAULT 60,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityAutomationConfig_mode_check" CHECK ("mode" IN ('AUTO_SAFE','MANUAL')),
  CONSTRAINT "SecurityAutomationConfig_failedLoginThreshold_check" CHECK ("failedLoginThreshold" BETWEEN 3 AND 10),
  CONSTRAINT "SecurityAutomationConfig_healthScanMinutes_check" CHECK ("healthScanMinutes" BETWEEN 15 AND 1440)
);
