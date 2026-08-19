CREATE TABLE IF NOT EXISTS "BillingAutomationSettings" (
  "organizationId" UUID PRIMARY KEY REFERENCES "Organization"("id") ON DELETE CASCADE,
  "automaticTaxEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "taxInclusive" BOOLEAN NOT NULL DEFAULT TRUE,
  "stripeTaxCode" TEXT,
  "invoiceEmailEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "receiptEmailEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "remindersEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "reminderDelaysDays" JSONB NOT NULL DEFAULT '[1,3,7]'::jsonb,
  "reminderTitle" TEXT NOT NULL DEFAULT 'Votre paiement KHE Booth est à régulariser',
  "reminderBody" TEXT NOT NULL DEFAULT 'Bonjour {{clientName}}, votre paiement {{planName}} de {{amount}} est toujours en attente. Mettez à jour votre moyen de paiement afin de conserver l’accès à vos fonctionnalités KHE Booth.',
  "thankYouEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "thankYouTitle" TEXT NOT NULL DEFAULT 'Merci pour votre confiance ✨',
  "thankYouBody" TEXT NOT NULL DEFAULT 'Votre paiement {{planName}} est confirmé. Votre abonnement est actif et vos fonctionnalités sont prêtes : {{features}}. Nous avons hâte de vous accompagner sur vos prochains événements.',
  "invoiceTitle" TEXT NOT NULL DEFAULT 'FACTURE KHE BOOTH',
  "receiptTitle" TEXT NOT NULL DEFAULT 'REÇU DE PAIEMENT KHE BOOTH',
  "companyLegalName" TEXT NOT NULL DEFAULT 'Kurtis Hypnotic Events',
  "companyDetails" TEXT NOT NULL DEFAULT 'KHE Booth · Kurtis Hypnotic Events',
  "logoUrl" TEXT,
  "fontFamily" TEXT NOT NULL DEFAULT 'Inter',
  "fontScale" NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  "documentStyle" TEXT NOT NULL DEFAULT 'ELEGANT',
  "accentColor" TEXT NOT NULL DEFAULT '#D2AD4F',
  "secondaryColor" TEXT NOT NULL DEFAULT '#B31520',
  "backgroundColor" TEXT NOT NULL DEFAULT '#0D0D0F',
  "textColor" TEXT NOT NULL DEFAULT '#FFFFFF',
  "invoiceNote" TEXT NOT NULL DEFAULT 'Merci d’avoir choisi KHE Booth pour vos événements.',
  "receiptNote" TEXT NOT NULL DEFAULT 'Paiement reçu avec succès. Merci pour votre confiance.',
  "footerText" TEXT NOT NULL DEFAULT 'KHE Booth · Votre événement, notre expertise',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "BillingDocument" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "clientId" UUID NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
  "provider" TEXT NOT NULL DEFAULT 'stripe',
  "providerDocumentId" TEXT NOT NULL,
  "providerPaymentId" TEXT,
  "documentType" TEXT NOT NULL DEFAULT 'INVOICE',
  "documentNumber" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "billingReason" TEXT,
  "currency" TEXT NOT NULL,
  "subtotalCents" INTEGER NOT NULL DEFAULT 0,
  "taxCents" INTEGER NOT NULL DEFAULT 0,
  "totalCents" INTEGER NOT NULL DEFAULT 0,
  "taxCountry" TEXT,
  "taxDetails" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "hostedUrl" TEXT,
  "pdfUrl" TEXT,
  "receiptUrl" TEXT,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "failedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("provider", "providerDocumentId")
);
CREATE INDEX IF NOT EXISTS "BillingDocument_clientId_issuedAt_idx" ON "BillingDocument"("clientId", "issuedAt" DESC);
CREATE INDEX IF NOT EXISTS "BillingDocument_status_failedAt_idx" ON "BillingDocument"("status", "failedAt");

CREATE TABLE IF NOT EXISTS "BillingDeliveryLog" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "clientId" UUID NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
  "billingDocumentId" UUID REFERENCES "BillingDocument"("id") ON DELETE CASCADE,
  "deliveryKey" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SENT',
  "providerMessageId" TEXT,
  "error" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("clientId", "deliveryKey", "channel")
);
CREATE INDEX IF NOT EXISTS "BillingDeliveryLog_document_idx" ON "BillingDeliveryLog"("billingDocumentId", "sentAt" DESC);

INSERT INTO "BillingAutomationSettings" ("organizationId")
SELECT id FROM "Organization"
ON CONFLICT ("organizationId") DO NOTHING;