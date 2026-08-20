-- Enterprise onboarding, client profile mirroring, compliance forms and quote catalog.
-- Sensitive verification files are stored in private Blob; the database stores metadata/path only.

CREATE TABLE IF NOT EXISTS "ClientProfileSnapshot" (
  "clientId" UUID PRIMARY KEY REFERENCES "Client"("id") ON DELETE CASCADE,
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "sourceOrganizationId" UUID REFERENCES "Organization"("id") ON DELETE SET NULL,
  "source" TEXT NOT NULL DEFAULT 'KHE_CLIENT',
  "firstName" TEXT NOT NULL DEFAULT '',
  "lastName" TEXT NOT NULL DEFAULT '',
  "displayName" TEXT NOT NULL DEFAULT '',
  "company" TEXT NOT NULL DEFAULT '',
  "role" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "address" TEXT NOT NULL DEFAULT '',
  "city" TEXT NOT NULL DEFAULT '',
  "country" TEXT NOT NULL DEFAULT '',
  "countryCode" TEXT NOT NULL DEFAULT '',
  "birthDate" DATE,
  "bio" TEXT NOT NULL DEFAULT '',
  "avatarPath" TEXT,
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientProfileSnapshot_source_check" CHECK ("source" IN ('CAPTURE','SHARING','ENTERPRISE_PORTAL','KHE_CLIENT','IMPORT'))
);
CREATE INDEX IF NOT EXISTS "ClientProfileSnapshot_organizationId_idx" ON "ClientProfileSnapshot"("organizationId","updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "ClientProfileSnapshot_sourceOrganizationId_idx" ON "ClientProfileSnapshot"("sourceOrganizationId");

CREATE TABLE IF NOT EXISTS "EnterpriseFormTemplate" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "jurisdiction" TEXT NOT NULL,
  "countryCodes" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "language" TEXT NOT NULL DEFAULT 'fr',
  "version" INTEGER NOT NULL DEFAULT 1,
  "fields" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "identityRequirements" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "privacyNotice" TEXT NOT NULL DEFAULT '',
  "retentionPolicy" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "legalReviewRequired" BOOLEAN NOT NULL DEFAULT TRUE,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdByUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "updatedByUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "EnterpriseFormTemplate_code_unique" ON "EnterpriseFormTemplate"("organizationId","code");
CREATE INDEX IF NOT EXISTS "EnterpriseFormTemplate_active_idx" ON "EnterpriseFormTemplate"("organizationId","active","jurisdiction");

CREATE TABLE IF NOT EXISTS "EnterpriseOnboarding" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "clientId" UUID NOT NULL UNIQUE REFERENCES "Client"("id") ON DELETE CASCADE,
  "templateId" UUID REFERENCES "EnterpriseFormTemplate"("id") ON DELETE SET NULL,
  "status" TEXT NOT NULL DEFAULT 'PAYMENT_PENDING',
  "countryCode" TEXT NOT NULL DEFAULT '',
  "jurisdiction" TEXT NOT NULL DEFAULT 'GLOBAL',
  "desiredUsers" INTEGER NOT NULL DEFAULT 1,
  "formVersion" INTEGER NOT NULL DEFAULT 1,
  "answers" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "privacyAcceptedAt" TIMESTAMP(3),
  "truthConfirmedAt" TIMESTAMP(3),
  "paymentVerifiedAt" TIMESTAMP(3),
  "formAvailableAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "reviewStartedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "ownerApprovedAt" TIMESTAMP(3),
  "ownerApprovedByUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "reviewNotes" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnterpriseOnboarding_status_check" CHECK ("status" IN ('PAYMENT_PENDING','FORM_AVAILABLE','FORM_SUBMITTED','IDENTITY_PENDING','UNDER_REVIEW','CHANGES_REQUESTED','VERIFIED','APPROVED','REJECTED')),
  CONSTRAINT "EnterpriseOnboarding_desiredUsers_check" CHECK ("desiredUsers" BETWEEN 1 AND 10000)
);
CREATE INDEX IF NOT EXISTS "EnterpriseOnboarding_queue_idx" ON "EnterpriseOnboarding"("organizationId","status","updatedAt" DESC);

CREATE TABLE IF NOT EXISTS "EnterpriseOnboardingToken" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "clientId" UUID NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "EnterpriseOnboardingToken_client_idx" ON "EnterpriseOnboardingToken"("clientId","createdAt" DESC);

CREATE TABLE IF NOT EXISTS "EnterpriseVerificationDocument" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "clientId" UUID NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
  "documentType" TEXT NOT NULL,
  "pathname" TEXT NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "expiresOn" DATE,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedAt" TIMESTAMP(3),
  "verifiedByUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "rejectionReason" TEXT,
  "retentionDeleteAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnterpriseVerificationDocument_type_check" CHECK ("documentType" IN ('IDENTITY_CARD','PASSPORT','PROOF_OF_ADDRESS','MANUAL_FORM_PDF','MANUAL_FORM_DOCX','MANUAL_FORM_XLSX','OTHER')),
  CONSTRAINT "EnterpriseVerificationDocument_status_check" CHECK ("status" IN ('RECEIVED','UNDER_REVIEW','VERIFIED','REJECTED','EXPIRED','DELETED')),
  CONSTRAINT "EnterpriseVerificationDocument_size_check" CHECK ("byteSize">0 AND "byteSize"<=20971520)
);
CREATE INDEX IF NOT EXISTS "EnterpriseVerificationDocument_client_idx" ON "EnterpriseVerificationDocument"("clientId","documentType","uploadedAt" DESC);
CREATE INDEX IF NOT EXISTS "EnterpriseVerificationDocument_retention_idx" ON "EnterpriseVerificationDocument"("retentionDeleteAt") WHERE "deletedAt" IS NULL;

CREATE TABLE IF NOT EXISTS "EnterpriseOfferTemplate" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "currency" TEXT NOT NULL DEFAULT 'CHF',
  "baseMonthlyCents" INTEGER NOT NULL DEFAULT 0,
  "setupFeeCents" INTEGER NOT NULL DEFAULT 0,
  "includedUsers" INTEGER NOT NULL DEFAULT 1,
  "extraUserMonthlyCents" INTEGER NOT NULL DEFAULT 0,
  "features" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "limits" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnterpriseOfferTemplate_amount_check" CHECK ("baseMonthlyCents">=0 AND "setupFeeCents">=0 AND "extraUserMonthlyCents">=0 AND "includedUsers">=1)
);
CREATE UNIQUE INDEX IF NOT EXISTS "EnterpriseOfferTemplate_code_unique" ON "EnterpriseOfferTemplate"("organizationId","code");

CREATE TABLE IF NOT EXISTS "EnterpriseQuote" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "clientId" UUID NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
  "offerTemplateId" UUID REFERENCES "EnterpriseOfferTemplate"("id") ON DELETE SET NULL,
  "quoteNumber" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CHF',
  "userCount" INTEGER NOT NULL DEFAULT 1,
  "monthlyCents" INTEGER NOT NULL DEFAULT 0,
  "setupFeeCents" INTEGER NOT NULL DEFAULT 0,
  "discountCents" INTEGER NOT NULL DEFAULT 0,
  "customItems" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "features" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "validUntil" DATE,
  "acceptedAt" TIMESTAMP(3),
  "createdByUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnterpriseQuote_status_check" CHECK ("status" IN ('DRAFT','SENT','ACCEPTED','REJECTED','EXPIRED')),
  CONSTRAINT "EnterpriseQuote_amount_check" CHECK ("monthlyCents">=0 AND "setupFeeCents">=0 AND "discountCents">=0 AND "userCount">=1)
);
CREATE UNIQUE INDEX IF NOT EXISTS "EnterpriseQuote_number_unique" ON "EnterpriseQuote"("organizationId","quoteNumber");
CREATE INDEX IF NOT EXISTS "EnterpriseQuote_client_idx" ON "EnterpriseQuote"("clientId","createdAt" DESC);

-- Global baseline. Country-specific templates are owner-editable and may override this configuration.
INSERT INTO "EnterpriseFormTemplate" (id,"organizationId",code,name,jurisdiction,"countryCodes",fields,"identityRequirements","privacyNotice","retentionPolicy","legalReviewRequired")
SELECT gen_random_uuid(),o.id,'GLOBAL_BASELINE','Formulaire Enterprise international','GLOBAL','[]'::jsonb,
  '[{"key":"legalName","label":"Raison sociale / nom légal","type":"text","required":true},{"key":"registrationNumber","label":"Numéro d’enregistrement de l’entreprise","type":"text","required":false},{"key":"taxId","label":"Numéro fiscal / TVA","type":"text","required":false},{"key":"registeredAddress","label":"Adresse légale complète","type":"textarea","required":true},{"key":"representativeName","label":"Représentant autorisé","type":"text","required":true},{"key":"representativeRole","label":"Fonction du représentant","type":"text","required":true},{"key":"website","label":"Site internet","type":"url","required":false},{"key":"businessActivity","label":"Activité principale","type":"textarea","required":true},{"key":"desiredUsers","label":"Nombre d’utilisateurs prévus","type":"number","required":true,"min":1,"max":10000}]'::jsonb,
  '{"acceptedIdentity":["IDENTITY_CARD","PASSPORT"],"proofOfAddress":true,"validDocumentRequired":true,"manualReview":true}'::jsonb,
  'Vos données sont collectées uniquement pour l’identification, la contractualisation, la sécurité et la gestion de votre accès Enterprise KHE Booth. Les documents d’identité sont soumis à un accès restreint et à une durée de conservation limitée.',
  '{"identityCopy":"DELETE_AFTER_VERIFICATION_WHEN_LEGALLY_POSSIBLE","proofOfAddress":"MINIMIZE_AND_REVIEW","audit":"RETAIN_SECURITY_LOG"}'::jsonb,TRUE
FROM "Organization" o WHERE COALESCE(o."tenantKind",'KHE_ROOT')='KHE_ROOT'
ON CONFLICT ("organizationId",code) DO NOTHING;

INSERT INTO "EnterpriseFormTemplate" (id,"organizationId",code,name,jurisdiction,"countryCodes",fields,"identityRequirements","privacyNotice","retentionPolicy","legalReviewRequired")
SELECT gen_random_uuid(),o.id,'CH','Formulaire Enterprise Suisse','SWITZERLAND','["CH"]'::jsonb,
  '[{"key":"legalName","label":"Raison sociale / nom légal","type":"text","required":true},{"key":"uidNumber","label":"IDE / UID (si applicable)","type":"text","required":false},{"key":"vatNumber","label":"N° TVA (si applicable)","type":"text","required":false},{"key":"registeredAddress","label":"Adresse complète en Suisse","type":"textarea","required":true},{"key":"representativeName","label":"Personne habilitée à engager l’entreprise","type":"text","required":true},{"key":"representativeRole","label":"Fonction","type":"text","required":true},{"key":"desiredUsers","label":"Nombre d’utilisateurs prévus","type":"number","required":true,"min":1,"max":10000}]'::jsonb,
  '{"acceptedIdentity":["IDENTITY_CARD","PASSPORT"],"proofOfAddress":true,"validDocumentRequired":true,"manualReview":true}'::jsonb,
  'Traitement selon les principes de la LPD suisse : finalité, proportionnalité, transparence et sécurité. Une copie d’identité ne doit pas être conservée plus longtemps que nécessaire à l’identification.',
  '{"identityCopy":"DELETE_AFTER_VERIFICATION_WHEN_LEGALLY_POSSIBLE","proofOfAddress":"MINIMIZE_AND_REVIEW","privacyRights":"ACCESS_CORRECT_DELETE_WHERE_APPLICABLE"}'::jsonb,FALSE
FROM "Organization" o WHERE COALESCE(o."tenantKind",'KHE_ROOT')='KHE_ROOT'
ON CONFLICT ("organizationId",code) DO NOTHING;

INSERT INTO "EnterpriseFormTemplate" (id,"organizationId",code,name,jurisdiction,"countryCodes",fields,"identityRequirements","privacyNotice","retentionPolicy","legalReviewRequired")
SELECT gen_random_uuid(),o.id,'EU_EEA','Formulaire Enterprise UE / EEE','EU_EEA',
  '["AT","BE","BG","HR","CY","CZ","DE","DK","EE","ES","FI","FR","GR","HU","IE","IS","IT","LI","LT","LU","LV","MT","NL","NO","PL","PT","RO","SE","SI","SK"]'::jsonb,
  '[{"key":"legalName","label":"Dénomination légale","type":"text","required":true},{"key":"registrationNumber","label":"N° registre / société","type":"text","required":false},{"key":"vatNumber","label":"N° TVA intracommunautaire (si applicable)","type":"text","required":false},{"key":"registeredAddress","label":"Siège / adresse légale","type":"textarea","required":true},{"key":"representativeName","label":"Représentant autorisé","type":"text","required":true},{"key":"representativeRole","label":"Fonction","type":"text","required":true},{"key":"desiredUsers","label":"Nombre d’utilisateurs prévus","type":"number","required":true,"min":1,"max":10000}]'::jsonb,
  '{"acceptedIdentity":["IDENTITY_CARD","PASSPORT"],"proofOfAddress":true,"validDocumentRequired":true,"manualReview":true}'::jsonb,
  'Traitement fondé sur une finalité explicite, avec minimisation des données, durée de conservation limitée, transparence et mesures de sécurité appropriées. Les droits applicables sont présentés avant soumission.',
  '{"identityCopy":"DELETE_AFTER_VERIFICATION_WHEN_LEGALLY_POSSIBLE","proofOfAddress":"MINIMIZE_AND_REVIEW","privacyRights":"GDPR_DATA_SUBJECT_RIGHTS"}'::jsonb,FALSE
FROM "Organization" o WHERE COALESCE(o."tenantKind",'KHE_ROOT')='KHE_ROOT'
ON CONFLICT ("organizationId",code) DO NOTHING;

INSERT INTO "EnterpriseOfferTemplate" (id,"organizationId",code,name,description,"baseMonthlyCents","setupFeeCents","includedUsers","extraUserMonthlyCents",features,limits,"sortOrder")
SELECT gen_random_uuid(),o.id,'ENTERPRISE_ESSENTIAL','Enterprise Essential','Pour équipes et prestataires avec administration centralisée.',14900,49000,5,1500,
 '["Tout Business","5 utilisateurs inclus","Tenant Enterprise isolé","Gestion des événements et Studio","Rapports et exports","Support prioritaire"]'::jsonb,
 '{"recommendedUsers":"1-10","support":"priority"}'::jsonb,10
FROM "Organization" o WHERE COALESCE(o."tenantKind",'KHE_ROOT')='KHE_ROOT'
ON CONFLICT ("organizationId",code) DO NOTHING;

INSERT INTO "EnterpriseOfferTemplate" (id,"organizationId",code,name,description,"baseMonthlyCents","setupFeeCents","includedUsers","extraUserMonthlyCents",features,limits,"sortOrder")
SELECT gen_random_uuid(),o.id,'ENTERPRISE_SCALE','Enterprise Scale','Pour agences multi-équipes et volumes événementiels élevés.',29900,99000,15,1200,
 '["Tout Enterprise Essential","15 utilisateurs inclus","Pilotage multi-équipe","Marketing & Analytics avancé","Rapports de direction","Support renforcé"]'::jsonb,
 '{"recommendedUsers":"10-50","support":"enhanced"}'::jsonb,20
FROM "Organization" o WHERE COALESCE(o."tenantKind",'KHE_ROOT')='KHE_ROOT'
ON CONFLICT ("organizationId",code) DO NOTHING;

INSERT INTO "EnterpriseOfferTemplate" (id,"organizationId",code,name,description,"baseMonthlyCents","setupFeeCents","includedUsers","extraUserMonthlyCents",features,limits,"sortOrder")
SELECT gen_random_uuid(),o.id,'ENTERPRISE_CUSTOM','Enterprise Sur Mesure','Pour réseaux, franchises et déploiements nécessitant un devis personnalisé.',0,0,1,0,
 '["Configuration sur mesure","Nombre d’utilisateurs personnalisable","Intégrations et accompagnement selon devis","SLA et support négociables"]'::jsonb,
 '{"recommendedUsers":"custom","quoteRequired":true}'::jsonb,30
FROM "Organization" o WHERE COALESCE(o."tenantKind",'KHE_ROOT')='KHE_ROOT'
ON CONFLICT ("organizationId",code) DO NOTHING;
