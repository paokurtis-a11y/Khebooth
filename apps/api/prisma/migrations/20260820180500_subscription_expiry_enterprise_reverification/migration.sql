-- Subscription expiry safety + annual Enterprise document reverification.

ALTER TABLE "Client" DROP CONSTRAINT IF EXISTS "Client_subscriptionStatus_check";
ALTER TABLE "Client"
  ADD CONSTRAINT "Client_subscriptionStatus_check"
  CHECK ("subscriptionStatus" IN ('PROSPECT','PLAN_SELECTED','PAYMENT_PENDING','ACTIVE','SUSPENDED','CANCELLED','EXPIRED'));

ALTER TABLE "EnterpriseOnboarding"
  ADD COLUMN IF NOT EXISTS "documentsVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "nextDocumentVerificationAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verificationCycle" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "reverificationStatus" TEXT NOT NULL DEFAULT 'NOT_DUE',
  ADD COLUMN IF NOT EXISTS "reverificationStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reverificationDueAt" TIMESTAMP(3);

ALTER TABLE "EnterpriseOnboarding" DROP CONSTRAINT IF EXISTS "EnterpriseOnboarding_reverification_status_check";
ALTER TABLE "EnterpriseOnboarding"
  ADD CONSTRAINT "EnterpriseOnboarding_reverification_status_check"
  CHECK ("reverificationStatus" IN ('NOT_DUE','ACTION_REQUIRED','DOCUMENTS_RECEIVED','UNDER_REVIEW','CHANGES_REQUESTED','VERIFIED','OVERDUE')),
  ADD CONSTRAINT "EnterpriseOnboarding_verification_cycle_check" CHECK ("verificationCycle">=0);

ALTER TABLE "EnterpriseVerificationDocument"
  ADD COLUMN IF NOT EXISTS "verificationCycle" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "EnterpriseVerificationDocument_cycle_idx"
  ON "EnterpriseVerificationDocument"("clientId","verificationCycle","documentType",status);

ALTER TABLE "EnterpriseWorkflowSettings"
  ADD COLUMN IF NOT EXISTS "documentReverificationMonths" INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS "reverificationLeadDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "EnterpriseWorkflowSettings" DROP CONSTRAINT IF EXISTS "EnterpriseWorkflowSettings_reverification_months_check";
ALTER TABLE "EnterpriseWorkflowSettings" DROP CONSTRAINT IF EXISTS "EnterpriseWorkflowSettings_reverification_lead_check";
ALTER TABLE "EnterpriseWorkflowSettings"
  ADD CONSTRAINT "EnterpriseWorkflowSettings_reverification_months_check" CHECK ("documentReverificationMonths"=12),
  ADD CONSTRAINT "EnterpriseWorkflowSettings_reverification_lead_check" CHECK ("reverificationLeadDays" BETWEEN 7 AND 60);

CREATE TABLE IF NOT EXISTS "EnterpriseReverificationReminder" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "clientId" UUID NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
  "verificationCycle" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnterpriseReverificationReminder_kind_check" CHECK ("kind" IN ('OPENED','D30','D14','D7','D1','DUE','OVERDUE_7')),
  CONSTRAINT "EnterpriseReverificationReminder_cycle_check" CHECK ("verificationCycle">=1)
);
CREATE UNIQUE INDEX IF NOT EXISTS "EnterpriseReverificationReminder_unique"
  ON "EnterpriseReverificationReminder"("clientId","verificationCycle","kind");
CREATE INDEX IF NOT EXISTS "EnterpriseReverificationReminder_org_idx"
  ON "EnterpriseReverificationReminder"("organizationId","sentAt" DESC);

-- Backfill the next annual verification for already approved Enterprise clients.
UPDATE "EnterpriseOnboarding" o
SET "documentsVerifiedAt"=COALESCE(o."documentsVerifiedAt",d."verifiedAt",CURRENT_TIMESTAMP),
    "nextDocumentVerificationAt"=COALESCE(o."nextDocumentVerificationAt",COALESCE(d."verifiedAt",CURRENT_TIMESTAMP)+INTERVAL '1 year'),
    "reverificationStatus"=CASE WHEN o."nextDocumentVerificationAt" IS NULL THEN 'VERIFIED' ELSE o."reverificationStatus" END
FROM (
  SELECT "clientId",MAX("verifiedAt") AS "verifiedAt"
  FROM "EnterpriseVerificationDocument"
  WHERE status='VERIFIED' AND "documentType" IN ('IDENTITY_CARD','PASSPORT','PROOF_OF_ADDRESS')
  GROUP BY "clientId"
) d
WHERE o."clientId"=d."clientId" AND o.status='APPROVED';

-- Reconcile the current verification cycle only. Initial onboarding can auto-approve;
-- annual re-verification refreshes the yearly validity without requiring another manual approval.
CREATE OR REPLACE FUNCTION khe_reconcile_enterprise_validation(target_client UUID)
RETURNS BOOLEAN AS $$
DECLARE
  root_org UUID;
  payment_ok BOOLEAN;
  form_ok BOOLEAN;
  contract_ok BOOLEAN;
  identity_ok BOOLEAN;
  address_ok BOOLEAN;
  auto_ok BOOLEAN;
  current_status TEXT;
  current_cycle INTEGER;
BEGIN
  SELECT c."organizationId",(c."subscriptionPlan"='ENTERPRISE' AND c."paymentStatus"='PAID')
    INTO root_org,payment_ok FROM "Client" c WHERE c.id=target_client;
  IF root_org IS NULL THEN RETURN FALSE; END IF;

  SELECT COALESCE(w."autoApproveAfterVerifiedDocuments",TRUE)
    INTO auto_ok FROM "EnterpriseWorkflowSettings" w WHERE w."organizationId"=root_org;
  auto_ok:=COALESCE(auto_ok,TRUE);

  SELECT (o."submittedAt" IS NOT NULL),o.status,o."verificationCycle"
    INTO form_ok,current_status,current_cycle FROM "EnterpriseOnboarding" o WHERE o."clientId"=target_client;
  IF current_status IS NULL OR current_status='REJECTED' THEN RETURN FALSE; END IF;

  SELECT EXISTS(SELECT 1 FROM "EnterpriseContract" c WHERE c."clientId"=target_client AND c.status='SIGNED') INTO contract_ok;
  SELECT EXISTS(SELECT 1 FROM "EnterpriseVerificationDocument" d WHERE d."clientId"=target_client AND d."deletedAt" IS NULL AND d."verificationCycle"=current_cycle AND d."documentType" IN ('IDENTITY_CARD','PASSPORT') AND d.status='VERIFIED') INTO identity_ok;
  SELECT EXISTS(SELECT 1 FROM "EnterpriseVerificationDocument" d WHERE d."clientId"=target_client AND d."deletedAt" IS NULL AND d."verificationCycle"=current_cycle AND d."documentType"='PROOF_OF_ADDRESS' AND d.status='VERIFIED') INTO address_ok;

  IF identity_ok AND address_ok THEN
    UPDATE "EnterpriseOnboarding"
       SET "documentsVerifiedAt"=CURRENT_TIMESTAMP,
           "nextDocumentVerificationAt"=CURRENT_TIMESTAMP+INTERVAL '1 year',
           "reverificationStatus"='VERIFIED',
           "reverificationStartedAt"=NULL,
           "reverificationDueAt"=NULL,
           "updatedAt"=CURRENT_TIMESTAMP
     WHERE "clientId"=target_client;
  END IF;

  IF auto_ok AND payment_ok AND form_ok AND contract_ok AND identity_ok AND address_ok AND current_cycle=0 AND current_status<>'APPROVED' THEN
    UPDATE "EnterpriseOnboarding"
       SET status='APPROVED',
           "reviewedAt"=COALESCE("reviewedAt",CURRENT_TIMESTAMP),
           "reviewNotes"='Validation automatique KHE : paiement, formulaire et contrat conformes; identité et domicile validés humainement.',
           "updatedAt"=CURRENT_TIMESTAMP
     WHERE "clientId"=target_client;
    INSERT INTO "AuditLog" (id,"organizationId","userId",action,"entityType","entityId",metadata,"createdAt")
    VALUES (gen_random_uuid(),root_org,NULL,'ENTERPRISE_AUTO_APPROVED_AFTER_DOCUMENT_REVIEW','Client',target_client,
      jsonb_build_object('paymentValidated',payment_ok,'formSubmitted',form_ok,'contractSigned',contract_ok,'identityHumanVerified',identity_ok,'addressHumanVerified',address_ok,'verificationCycle',current_cycle),CURRENT_TIMESTAMP);
    RETURN TRUE;
  END IF;

  IF current_cycle>0 AND identity_ok AND address_ok THEN
    INSERT INTO "AuditLog" (id,"organizationId","userId",action,"entityType","entityId",metadata,"createdAt")
    VALUES (gen_random_uuid(),root_org,NULL,'ENTERPRISE_ANNUAL_REVERIFICATION_COMPLETED','Client',target_client,
      jsonb_build_object('verificationCycle',current_cycle),CURRENT_TIMESTAMP);
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
