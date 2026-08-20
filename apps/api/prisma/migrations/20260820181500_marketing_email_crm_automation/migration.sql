-- Synchronized CRM + consented e-mail marketing automation.

ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedByUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "emailSource" TEXT,
  ADD COLUMN IF NOT EXISTS "emailLastCapturedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "marketingConsentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "marketingConsentSource" TEXT,
  ADD COLUMN IF NOT EXISTS "marketingConsentVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "marketingUnsubscribedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastMarketingEmailAt" TIMESTAMP(3);

-- Legacy rows had TRUE as a schema default without proof of consent. Do not treat that as marketing permission.
ALTER TABLE "Client" ALTER COLUMN "marketingEmailsEnabled" SET DEFAULT FALSE;
UPDATE "Client"
SET "marketingEmailsEnabled"=FALSE
WHERE "marketingEmailsEnabled"=TRUE AND "marketingConsentAt" IS NULL;

CREATE INDEX IF NOT EXISTS "Client_org_archived_idx" ON "Client"("organizationId","archivedAt","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Client_marketing_consent_idx" ON "Client"("organizationId","marketingEmailsEnabled","marketingConsentAt") WHERE "archivedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "Client_lower_email_idx" ON "Client"("organizationId",lower(email)) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS "MarketingEmailSettings" (
  "organizationId" UUID PRIMARY KEY REFERENCES "Organization"("id") ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  "senderName" TEXT NOT NULL DEFAULT 'KHE BOOTH',
  "replyTo" TEXT,
  "assignedUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "maxEmailsPer7Days" INTEGER NOT NULL DEFAULT 3,
  timezone TEXT NOT NULL DEFAULT 'Europe/Zurich',
  "sendWindowStartHour" INTEGER NOT NULL DEFAULT 8,
  "sendWindowEndHour" INTEGER NOT NULL DEFAULT 19,
  "consentVersion" TEXT NOT NULL DEFAULT 'marketing-v1',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingEmailSettings_frequency_check" CHECK ("maxEmailsPer7Days" BETWEEN 1 AND 10),
  CONSTRAINT "MarketingEmailSettings_start_hour_check" CHECK ("sendWindowStartHour" BETWEEN 0 AND 23),
  CONSTRAINT "MarketingEmailSettings_end_hour_check" CHECK ("sendWindowEndHour" BETWEEN 1 AND 24)
);

CREATE TABLE IF NOT EXISTS "MarketingEmailScenario" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  segment TEXT NOT NULL,
  "scheduleHours" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "subjectTemplate" TEXT NOT NULL,
  "bodyTemplate" TEXT NOT NULL,
  "ctaLabel" TEXT NOT NULL DEFAULT 'Découvrir KHE BOOTH',
  "ctaPath" TEXT NOT NULL DEFAULT '/subscribe',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("organizationId",code)
);

CREATE TABLE IF NOT EXISTS "MarketingEmailJourney" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "clientId" UUID NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
  "scenarioCode" TEXT NOT NULL,
  "journeyKey" TEXT NOT NULL,
  source TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastStep" INTEGER NOT NULL DEFAULT -1,
  "lastSentAt" TIMESTAMP(3),
  "nextDueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("organizationId","clientId","scenarioCode","journeyKey")
);
CREATE INDEX IF NOT EXISTS "MarketingEmailJourney_due_idx" ON "MarketingEmailJourney"("organizationId","nextDueAt") WHERE "completedAt" IS NULL AND "cancelledAt" IS NULL;

CREATE TABLE IF NOT EXISTS "MarketingEmailDelivery" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "clientId" UUID NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
  "journeyId" UUID REFERENCES "MarketingEmailJourney"("id") ON DELETE SET NULL,
  "scenarioCode" TEXT NOT NULL,
  step INTEGER NOT NULL DEFAULT 0,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  "providerMessageId" TEXT,
  "sentAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  error TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingEmailDelivery_status_check" CHECK (status IN ('QUEUED','SENT','FAILED','SKIPPED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "MarketingEmailDelivery_journey_step_key" ON "MarketingEmailDelivery"("journeyId",step) WHERE "journeyId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "MarketingEmailDelivery_client_idx" ON "MarketingEmailDelivery"("clientId","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "MarketingEmailDelivery_org_idx" ON "MarketingEmailDelivery"("organizationId","createdAt" DESC);

INSERT INTO "MarketingEmailSettings" ("organizationId")
SELECT id FROM "Organization" WHERE COALESCE("tenantKind",'KHE_ROOT')='KHE_ROOT'
ON CONFLICT ("organizationId") DO NOTHING;

INSERT INTO "MarketingEmailScenario" ("organizationId",code,name,segment,"scheduleHours","subjectTemplate","bodyTemplate","ctaLabel","ctaPath")
SELECT o.id,s.code,s.name,s.segment,s.schedule::jsonb,s.subject,s.body,s.cta,s.path
FROM "Organization" o
CROSS JOIN (VALUES
  ('CART_RECOVERY','Panier abandonné','CART_ABANDONED','[1,24,72]',
   'Votre configuration KHE BOOTH est toujours prête',
   'Bonjour {{name}}, vous étiez à une étape de finaliser votre offre {{plan}}. Votre sélection est toujours disponible. Reprenez là où vous vous êtes arrêté pour activer KHE BOOTH sans recommencer.',
   'Reprendre mon abonnement','/subscribe'),
  ('DISCOVERY_NURTURE','Découverte vers abonnement','DISCOVERY','[48,168,504]',
   'Passez de la découverte à votre prochain événement',
   'Bonjour {{name}}, votre profil KHE BOOTH est prêt. Passez à {{plan}} pour débloquer davantage d’outils de capture, partage, cloud et personnalisation pour vos prochains événements.',
   'Voir les offres','/subscribe'),
  ('EXPIRED_WINBACK','Réactivation abonnement','EXPIRED','[72,336,720]',
   'Vos avantages KHE BOOTH peuvent être réactivés',
   'Bonjour {{name}}, votre ancien abonnement {{plan}} est arrivé à échéance. Votre compte gratuit reste disponible et vos données de compte sont conservées. Réactivez une offre quand vous le souhaitez pour retrouver les fonctionnalités payantes.',
   'Réactiver KHE BOOTH','/subscribe')
) AS s(code,name,segment,schedule,subject,body,cta,path)
WHERE COALESCE(o."tenantKind",'KHE_ROOT')='KHE_ROOT'
ON CONFLICT ("organizationId",code) DO NOTHING;
