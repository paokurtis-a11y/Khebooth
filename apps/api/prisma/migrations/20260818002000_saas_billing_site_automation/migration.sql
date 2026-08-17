ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "kheCode" TEXT,
  ADD COLUMN IF NOT EXISTS "billingProvider" TEXT,
  ADD COLUMN IF NOT EXISTS "billingCustomerId" TEXT,
  ADD COLUMN IF NOT EXISTS "billingSubscriptionId" TEXT,
  ADD COLUMN IF NOT EXISTS "lastPaymentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "marketingEmailsEnabled" BOOLEAN NOT NULL DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS "Client_kheCode_key" ON "Client"("kheCode") WHERE "kheCode" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Client_billingCustomerId_idx" ON "Client"("billingCustomerId");

CREATE TABLE IF NOT EXISTS "MarketingSiteConfig" (
  "organizationId" UUID PRIMARY KEY REFERENCES "Organization"("id") ON DELETE CASCADE,
  "heroTitle" TEXT NOT NULL DEFAULT 'Transformez chaque événement en moment que l’on partage.',
  "heroSubtitle" TEXT NOT NULL DEFAULT 'Capture, création, cloud et partage invité réunis dans KHE Booth.',
  "primaryCta" TEXT NOT NULL DEFAULT 'Commencer avec KHE Booth',
  "appDownloadUrl" TEXT,
  "supportEmail" TEXT,
  "latestVersion" TEXT NOT NULL DEFAULT '0.2.0',
  "releaseNotes" TEXT NOT NULL DEFAULT '',
  "maintenanceActive" BOOLEAN NOT NULL DEFAULT FALSE,
  "maintenanceMessage" TEXT,
  "paymentMethods" JSONB NOT NULL DEFAULT '["card","apple_pay","google_pay","twint"]'::jsonb,
  "faq" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "media" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "seo" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "socialLinks" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "announcement" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "contentBlocks" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "SubscriptionPlanConfig" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tagline" TEXT NOT NULL,
  "priceMonthlyChf" INTEGER,
  "features" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "highlighted" BOOLEAN NOT NULL DEFAULT FALSE,
  "stripePriceId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("organizationId", "code")
);

CREATE TABLE IF NOT EXISTS "BillingEvent" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "provider" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL UNIQUE,
  "eventType" TEXT NOT NULL,
  "payload" JSONB,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ClientMessage" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "clientId" UUID NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL DEFAULT 'SYSTEM',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "actionUrl" TEXT,
  "emailRequested" BOOLEAN NOT NULL DEFAULT FALSE,
  "emailSentAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ClientMessage_clientId_createdAt_idx" ON "ClientMessage"("clientId", "createdAt" DESC);

INSERT INTO "SubscriptionPlanConfig" ("organizationId", "code", "name", "tagline", "priceMonthlyChf", "features", "active", "highlighted", "sortOrder")
SELECT o.id, p.code, p.name, p.tagline, p.price, p.features::jsonb, TRUE, p.highlighted, p.sort_order
FROM "Organization" o
CROSS JOIN (VALUES
  ('DISCOVERY','Découverte','Découvrir KHE Booth',0,'["Découverte de la plateforme","1 profil KHE","Accès aux nouveautés","Support standard"]',FALSE,10),
  ('STARTER','Starter','Pour démarrer professionnellement',2900,'["CAPTURE & SHARING","Cloud KHE","QR invité","Studio créatif"]',FALSE,20),
  ('PRO','Pro','Pour les professionnels réguliers',5900,'["Tout Starter","Plus de capacité événement","Branding avancé","Support prioritaire"]',TRUE,30),
  ('BUSINESS','Business','Pour équipes et agences',9900,'["Tout Pro","Gestion multi-événements","Outils équipe","Automatisations avancées"]',FALSE,40),
  ('ENTERPRISE','Enterprise','Pour déploiements sur mesure',NULL,'["Configuration sur mesure","Accompagnement dédié","Intégrations personnalisées","SLA adapté"]',FALSE,50)
) AS p(code,name,tagline,price,features,highlighted,sort_order)
ON CONFLICT ("organizationId","code") DO NOTHING;
