-- Annual Enterprise contracts, signature evidence, localized legal templates and update governance.

ALTER TABLE "EnterpriseFormTemplate"
  ADD COLUMN IF NOT EXISTS "translations" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "autoUpdateMode" TEXT NOT NULL DEFAULT 'SAFE_AUTO';

ALTER TABLE "EnterpriseOfferTemplate"
  ADD COLUMN IF NOT EXISTS "contractTermMonths" INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS "billingCadence" TEXT NOT NULL DEFAULT 'ANNUAL',
  ADD COLUMN IF NOT EXISTS "baseAnnualCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "extraUserAnnualCents" INTEGER NOT NULL DEFAULT 0;

UPDATE "EnterpriseOfferTemplate"
SET "baseAnnualCents"=CASE WHEN "baseAnnualCents"=0 THEN "baseMonthlyCents"*12 ELSE "baseAnnualCents" END,
    "extraUserAnnualCents"=CASE WHEN "extraUserAnnualCents"=0 THEN "extraUserMonthlyCents"*12 ELSE "extraUserAnnualCents" END,
    "contractTermMonths"=12,
    "billingCadence"='ANNUAL';

ALTER TABLE "EnterpriseOfferTemplate"
  ADD CONSTRAINT "EnterpriseOfferTemplate_contract_term_check" CHECK ("contractTermMonths"=12),
  ADD CONSTRAINT "EnterpriseOfferTemplate_billing_cadence_check" CHECK ("billingCadence" IN ('ANNUAL','MONTHLY_UNDER_ANNUAL_TERM')),
  ADD CONSTRAINT "EnterpriseOfferTemplate_annual_amount_check" CHECK ("baseAnnualCents">=0 AND "extraUserAnnualCents">=0);

ALTER TABLE "EnterpriseQuote"
  ADD COLUMN IF NOT EXISTS "contractTermMonths" INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS "billingCadence" TEXT NOT NULL DEFAULT 'ANNUAL',
  ADD COLUMN IF NOT EXISTS "annualCents" INTEGER NOT NULL DEFAULT 0;

UPDATE "EnterpriseQuote"
SET "annualCents"=CASE WHEN "annualCents"=0 THEN "monthlyCents"*12 ELSE "annualCents" END,
    "contractTermMonths"=12,
    "billingCadence"='ANNUAL';

ALTER TABLE "EnterpriseQuote"
  ADD CONSTRAINT "EnterpriseQuote_contract_term_check" CHECK ("contractTermMonths"=12),
  ADD CONSTRAINT "EnterpriseQuote_billing_cadence_check" CHECK ("billingCadence" IN ('ANNUAL','MONTHLY_UNDER_ANNUAL_TERM')),
  ADD CONSTRAINT "EnterpriseQuote_annual_amount_check" CHECK ("annualCents">=0);

CREATE TABLE IF NOT EXISTS "EnterpriseContractTemplate" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "jurisdiction" TEXT NOT NULL DEFAULT 'GLOBAL',
  "countryCodes" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "defaultLanguage" TEXT NOT NULL DEFAULT 'fr',
  "version" INTEGER NOT NULL DEFAULT 1,
  "termMonths" INTEGER NOT NULL DEFAULT 12,
  "translations" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "sections" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "layout" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "signaturePolicy" TEXT NOT NULL DEFAULT 'NATIVE_EVIDENCE',
  "governingLaw" TEXT NOT NULL DEFAULT '',
  "venue" TEXT NOT NULL DEFAULT '',
  "sourceReferences" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "legalReviewRequired" BOOLEAN NOT NULL DEFAULT TRUE,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdByUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "updatedByUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnterpriseContractTemplate_term_check" CHECK ("termMonths"=12),
  CONSTRAINT "EnterpriseContractTemplate_signature_check" CHECK ("signaturePolicy" IN ('NATIVE_EVIDENCE','ADVANCED_REQUIRED','QUALIFIED_REQUIRED','MANUAL_SIGNATURE'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "EnterpriseContractTemplate_code_unique" ON "EnterpriseContractTemplate"("organizationId","code");
CREATE INDEX IF NOT EXISTS "EnterpriseContractTemplate_jurisdiction_idx" ON "EnterpriseContractTemplate"("organizationId","active","jurisdiction");

CREATE TABLE IF NOT EXISTS "EnterpriseContract" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "clientId" UUID NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
  "quoteId" UUID REFERENCES "EnterpriseQuote"("id") ON DELETE SET NULL,
  "templateId" UUID REFERENCES "EnterpriseContractTemplate"("id") ON DELETE SET NULL,
  "contractNumber" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL DEFAULT '',
  "jurisdiction" TEXT NOT NULL DEFAULT 'GLOBAL',
  "language" TEXT NOT NULL DEFAULT 'fr',
  "templateVersion" INTEGER NOT NULL DEFAULT 1,
  "termMonths" INTEGER NOT NULL DEFAULT 12,
  "startsOn" DATE,
  "endsOn" DATE,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "contractSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "contentHash" TEXT NOT NULL,
  "signaturePolicy" TEXT NOT NULL DEFAULT 'NATIVE_EVIDENCE',
  "signatureMethod" TEXT,
  "signerName" TEXT,
  "signerEmail" TEXT,
  "signerIp" TEXT,
  "signerUserAgent" TEXT,
  "signatureHash" TEXT,
  "signatureEvidence" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "signedAt" TIMESTAMP(3),
  "viewedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnterpriseContract_number_unique" UNIQUE ("organizationId","contractNumber"),
  CONSTRAINT "EnterpriseContract_term_check" CHECK ("termMonths"=12),
  CONSTRAINT "EnterpriseContract_status_check" CHECK ("status" IN ('DRAFT','SENT','VIEWED','SIGNED','VOID','SUPERSEDED')),
  CONSTRAINT "EnterpriseContract_signature_policy_check" CHECK ("signaturePolicy" IN ('NATIVE_EVIDENCE','ADVANCED_REQUIRED','QUALIFIED_REQUIRED','MANUAL_SIGNATURE')),
  CONSTRAINT "EnterpriseContract_signature_method_check" CHECK ("signatureMethod" IS NULL OR "signatureMethod" IN ('TYPED','DRAWN','QUALIFIED_PROVIDER','MANUAL_UPLOAD'))
);
CREATE INDEX IF NOT EXISTS "EnterpriseContract_client_idx" ON "EnterpriseContract"("clientId","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "EnterpriseContract_status_idx" ON "EnterpriseContract"("organizationId","status","updatedAt" DESC);

CREATE TABLE IF NOT EXISTS "EnterpriseContractAttachment" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "clientId" UUID NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
  "contractId" UUID NOT NULL REFERENCES "EnterpriseContract"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "pathname" TEXT NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnterpriseContractAttachment_kind_check" CHECK ("kind" IN ('SIGNED_MANUAL','SIGNED_GENERATED','SUPPORTING')),
  CONSTRAINT "EnterpriseContractAttachment_size_check" CHECK ("byteSize">0 AND "byteSize"<=20971520)
);
CREATE INDEX IF NOT EXISTS "EnterpriseContractAttachment_contract_idx" ON "EnterpriseContractAttachment"("contractId","createdAt" DESC);

CREATE TABLE IF NOT EXISTS "LegalGovernanceSettings" (
  "organizationId" UUID PRIMARY KEY REFERENCES "Organization"("id") ON DELETE CASCADE,
  "safeAutoApply" BOOLEAN NOT NULL DEFAULT TRUE,
  "requireApprovalMedium" BOOLEAN NOT NULL DEFAULT TRUE,
  "requireApprovalHigh" BOOLEAN NOT NULL DEFAULT TRUE,
  "requireApprovalCritical" BOOLEAN NOT NULL DEFAULT TRUE,
  "notifyOwner" BOOLEAN NOT NULL DEFAULT TRUE,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "LegalUpdateProposal" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "scope" TEXT NOT NULL,
  "jurisdiction" TEXT NOT NULL DEFAULT 'GLOBAL',
  "countryCodes" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "languages" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "sourceTitle" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "sourcePublishedAt" TIMESTAMP(3),
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "summary" TEXT NOT NULL,
  "analysis" TEXT NOT NULL,
  "advantages" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "disadvantages" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "impact" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
  "recommendedAction" TEXT NOT NULL DEFAULT 'REVIEW',
  "proposedPatch" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "ownerDecisionNote" TEXT,
  "ownerDecisionAt" TIMESTAMP(3),
  "ownerDecisionByUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "appliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalUpdateProposal_scope_check" CHECK ("scope" IN ('FORM','CONTRACT','LOCALIZATION','PRIVACY','SIGNATURE','BILLING','ACCESS','OTHER')),
  CONSTRAINT "LegalUpdateProposal_risk_check" CHECK ("riskLevel" IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  CONSTRAINT "LegalUpdateProposal_action_check" CHECK ("recommendedAction" IN ('AUTO_APPLY','REVIEW','REJECT')),
  CONSTRAINT "LegalUpdateProposal_status_check" CHECK ("status" IN ('PROPOSED','AUTO_APPLIED','OWNER_APPROVED','OWNER_REJECTED','APPLIED','SUPERSEDED'))
);
CREATE INDEX IF NOT EXISTS "LegalUpdateProposal_queue_idx" ON "LegalUpdateProposal"("organizationId","status","riskLevel","detectedAt" DESC);

CREATE TABLE IF NOT EXISTS "LegalComplianceReport" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "periodType" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "windowEnd" TIMESTAMP(3) NOT NULL,
  "summary" TEXT NOT NULL,
  "metrics" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "contractSummary" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "updateSummary" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "riskSummary" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalComplianceReport_period_check" CHECK ("periodType" IN ('DAILY','WEEKLY','MONTHLY','QUARTERLY','SEMIANNUAL','ANNUAL','YEAR_2','YEAR_3','YEAR_4','YEAR_5','YEAR_6','YEAR_7','YEAR_8','YEAR_9','YEAR_10','CUSTOM'))
);
CREATE INDEX IF NOT EXISTS "LegalComplianceReport_period_idx" ON "LegalComplianceReport"("organizationId","periodType","generatedAt" DESC);

INSERT INTO "LegalGovernanceSettings" ("organizationId")
SELECT id FROM "Organization" WHERE COALESCE("tenantKind",'KHE_ROOT')='KHE_ROOT'
ON CONFLICT ("organizationId") DO NOTHING;

-- Editable baseline contract templates. These are operational defaults, not a substitute for local legal review.
INSERT INTO "EnterpriseContractTemplate" (id,"organizationId",code,name,jurisdiction,"countryCodes","defaultLanguage",translations,sections,layout,"signaturePolicy","governingLaw",venue,"sourceReferences","legalReviewRequired")
SELECT gen_random_uuid(),o.id,'CH_ANNUAL','Contrat Enterprise annuel — Suisse','SWITZERLAND','["CH"]'::jsonb,'fr',
  '{"fr":{"title":"Contrat annuel KHE BOOTH Enterprise"},"de":{"title":"Jahresvertrag KHE BOOTH Enterprise"},"it":{"title":"Contratto annuale KHE BOOTH Enterprise"},"en":{"title":"KHE BOOTH Enterprise Annual Agreement"}}'::jsonb,
  '[{"key":"parties","title":"1. Parties","body":"Le présent contrat lie KHE BOOTH / Kurtis Hypnotic Events au client Enterprise identifié dans le dossier."},{"key":"term","title":"2. Durée","body":"Engagement contractuel de douze mois à compter de la date d’effet indiquée au contrat."},{"key":"services","title":"3. Services","body":"Les services, utilisateurs inclus, limites et options sont ceux du devis Enterprise accepté et annexé au présent contrat."},{"key":"billing","title":"4. Prix et facturation","body":"Les montants, taxes et modalités de paiement correspondent au devis accepté et aux documents de facturation applicables."},{"key":"security","title":"5. Comptes et sécurité","body":"Le client protège ses identifiants et respecte les contrôles d’accès, règles de sécurité et conditions d’utilisation de KHE BOOTH."},{"key":"data","title":"6. Données et confidentialité","body":"Les données sont traitées pour fournir le service, sécuriser la plateforme, administrer le contrat et respecter les obligations applicables."},{"key":"termination","title":"7. Résiliation et suspension","body":"Les conditions de suspension, résiliation anticipée, renouvellement ou non-renouvellement sont celles indiquées dans le devis et les conditions particulières."},{"key":"signature","title":"8. Signature","body":"Les parties reconnaissent la méthode de signature utilisée et les éléments de preuve enregistrés par KHE BOOTH, sous réserve des exigences de forme impératives applicables."}]'::jsonb,
  '{"brand":"KHE_BOOTH","accent":"gold","logoPlacement":"header","pageNumbers":true,"signatureBlock":"boxed"}'::jsonb,'NATIVE_EVIDENCE','Droit suisse','Suisse',
  '[{"title":"ZertES / signature électronique","url":"https://www.bakom.admin.ch/en/electronic-signature"}]'::jsonb,FALSE
FROM "Organization" o WHERE COALESCE(o."tenantKind",'KHE_ROOT')='KHE_ROOT'
ON CONFLICT ("organizationId",code) DO NOTHING;

INSERT INTO "EnterpriseContractTemplate" (id,"organizationId",code,name,jurisdiction,"countryCodes","defaultLanguage",translations,sections,layout,"signaturePolicy","governingLaw",venue,"sourceReferences","legalReviewRequired")
SELECT gen_random_uuid(),o.id,'EU_EEA_ANNUAL','Contrat Enterprise annuel — UE / EEE','EU_EEA',
  '["AT","BE","BG","HR","CY","CZ","DE","DK","EE","ES","FI","FR","GR","HU","IE","IS","IT","LI","LT","LU","LV","MT","NL","NO","PL","PT","RO","SE","SI","SK"]'::jsonb,'en',
  '{"en":{"title":"KHE BOOTH Enterprise Annual Agreement"},"fr":{"title":"Contrat annuel KHE BOOTH Enterprise"},"de":{"title":"Jahresvertrag KHE BOOTH Enterprise"},"it":{"title":"Contratto annuale KHE BOOTH Enterprise"},"es":{"title":"Contrato anual KHE BOOTH Enterprise"},"pt":{"title":"Contrato anual KHE BOOTH Enterprise"}}'::jsonb,
  '[{"key":"parties","title":"1. Parties","body":"This agreement is between KHE BOOTH / Kurtis Hypnotic Events and the Enterprise customer identified in the customer file."},{"key":"term","title":"2. Term","body":"The contractual commitment is twelve months from the effective date shown in the agreement."},{"key":"services","title":"3. Services","body":"Services, included users, limits and options are defined by the accepted Enterprise quote attached to this agreement."},{"key":"billing","title":"4. Fees and billing","body":"Prices, taxes and payment terms follow the accepted quote and applicable billing documents."},{"key":"security","title":"5. Accounts and security","body":"The customer protects credentials and follows KHE BOOTH access controls, security rules and platform terms."},{"key":"data","title":"6. Data and privacy","body":"Personal data is processed to provide the service, secure the platform, administer the contract and comply with applicable obligations."},{"key":"termination","title":"7. Termination and suspension","body":"Suspension, early termination and renewal rules are defined in the quote and special conditions."},{"key":"signature","title":"8. Electronic signature","body":"Electronic signature evidence is retained by KHE BOOTH. Where a qualified electronic signature is legally required, the required qualified trust service must be used."}]'::jsonb,
  '{"brand":"KHE_BOOTH","accent":"gold","logoPlacement":"header","pageNumbers":true,"signatureBlock":"boxed"}'::jsonb,'NATIVE_EVIDENCE','As specified in the signed contract','As specified in the signed contract',
  '[{"title":"eIDAS Article 25","url":"https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02014R0910-20241018"}]'::jsonb,TRUE
FROM "Organization" o WHERE COALESCE(o."tenantKind",'KHE_ROOT')='KHE_ROOT'
ON CONFLICT ("organizationId",code) DO NOTHING;

INSERT INTO "EnterpriseContractTemplate" (id,"organizationId",code,name,jurisdiction,"countryCodes","defaultLanguage",translations,sections,layout,"signaturePolicy","governingLaw",venue,"sourceReferences","legalReviewRequired")
SELECT gen_random_uuid(),o.id,'GLOBAL_ANNUAL','Contrat Enterprise annuel — International','GLOBAL','[]'::jsonb,'en',
  '{"en":{"title":"KHE BOOTH Enterprise Annual Agreement"},"fr":{"title":"Contrat annuel KHE BOOTH Enterprise"},"de":{"title":"Jahresvertrag KHE BOOTH Enterprise"},"it":{"title":"Contratto annuale KHE BOOTH Enterprise"},"es":{"title":"Contrato anual KHE BOOTH Enterprise"},"pt":{"title":"Contrato anual KHE BOOTH Enterprise"}}'::jsonb,
  '[{"key":"parties","title":"1. Parties","body":"This agreement is between KHE BOOTH / Kurtis Hypnotic Events and the Enterprise customer identified in the customer file."},{"key":"term","title":"2. Term","body":"The contractual commitment is twelve months from the effective date shown in the agreement."},{"key":"services","title":"3. Services","body":"Services, users, limits and options are defined in the accepted Enterprise quote."},{"key":"billing","title":"4. Fees and billing","body":"Prices, taxes and payment terms follow the accepted quote."},{"key":"security","title":"5. Security","body":"The customer follows KHE BOOTH access controls, security rules and platform terms."},{"key":"data","title":"6. Data and privacy","body":"Data processing is limited to service delivery, security, contract administration and applicable legal obligations."},{"key":"localLaw","title":"7. Local law","body":"Mandatory local-law requirements prevail. KHE marks this template for local legal review before relying on it in a jurisdiction without a validated local template."},{"key":"signature","title":"8. Signature","body":"The signature method must satisfy any mandatory form requirement applicable to this contract in the customer jurisdiction."}]'::jsonb,
  '{"brand":"KHE_BOOTH","accent":"gold","logoPlacement":"header","pageNumbers":true,"signatureBlock":"boxed"}'::jsonb,'NATIVE_EVIDENCE','To be validated for the customer jurisdiction','To be validated for the customer jurisdiction','[]'::jsonb,TRUE
FROM "Organization" o WHERE COALESCE(o."tenantKind",'KHE_ROOT')='KHE_ROOT'
ON CONFLICT ("organizationId",code) DO NOTHING;
