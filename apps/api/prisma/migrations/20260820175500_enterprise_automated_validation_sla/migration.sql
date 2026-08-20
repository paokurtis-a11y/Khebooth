CREATE TABLE IF NOT EXISTS "EnterpriseWorkflowSettings" (
  "organizationId" UUID PRIMARY KEY REFERENCES "Organization"("id") ON DELETE CASCADE,
  "documentReviewTargetHours" INTEGER NOT NULL DEFAULT 24,
  "documentReviewEscalationHours" INTEGER NOT NULL DEFAULT 36,
  "autoApproveAfterVerifiedDocuments" BOOLEAN NOT NULL DEFAULT TRUE,
  "paidWaitingPortalEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "ownerKycOverrideEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnterpriseWorkflowSettings_review_hours_check" CHECK ("documentReviewTargetHours" BETWEEN 1 AND 168),
  CONSTRAINT "EnterpriseWorkflowSettings_escalation_check" CHECK ("documentReviewEscalationHours">="documentReviewTargetHours" AND "documentReviewEscalationHours"<=336)
);

INSERT INTO "EnterpriseWorkflowSettings" ("organizationId")
SELECT id FROM "Organization" WHERE COALESCE("tenantKind",'KHE_ROOT')='KHE_ROOT'
ON CONFLICT ("organizationId") DO NOTHING;

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
BEGIN
  SELECT c."organizationId",
         (c."subscriptionPlan"='ENTERPRISE' AND c."paymentStatus"='PAID')
    INTO root_org,payment_ok
  FROM "Client" c WHERE c.id=target_client;
  IF root_org IS NULL THEN RETURN FALSE; END IF;

  SELECT COALESCE(w."autoApproveAfterVerifiedDocuments",TRUE)
    INTO auto_ok FROM "EnterpriseWorkflowSettings" w WHERE w."organizationId"=root_org;
  auto_ok:=COALESCE(auto_ok,TRUE);

  SELECT (o."submittedAt" IS NOT NULL),o.status
    INTO form_ok,current_status FROM "EnterpriseOnboarding" o WHERE o."clientId"=target_client;
  IF current_status IS NULL OR current_status='REJECTED' THEN RETURN FALSE; END IF;

  SELECT EXISTS(SELECT 1 FROM "EnterpriseContract" c WHERE c."clientId"=target_client AND c.status='SIGNED') INTO contract_ok;
  SELECT EXISTS(SELECT 1 FROM "EnterpriseVerificationDocument" d WHERE d."clientId"=target_client AND d."deletedAt" IS NULL AND d."documentType" IN ('IDENTITY_CARD','PASSPORT') AND d.status='VERIFIED') INTO identity_ok;
  SELECT EXISTS(SELECT 1 FROM "EnterpriseVerificationDocument" d WHERE d."clientId"=target_client AND d."deletedAt" IS NULL AND d."documentType"='PROOF_OF_ADDRESS' AND d.status='VERIFIED') INTO address_ok;

  IF auto_ok AND payment_ok AND form_ok AND contract_ok AND identity_ok AND address_ok AND current_status<>'APPROVED' THEN
    UPDATE "EnterpriseOnboarding"
       SET status='APPROVED',
           "reviewedAt"=COALESCE("reviewedAt",CURRENT_TIMESTAMP),
           "reviewNotes"='Validation automatique KHE : paiement, formulaire et contrat conformes; identité et domicile validés humainement.',
           "updatedAt"=CURRENT_TIMESTAMP
     WHERE "clientId"=target_client;

    INSERT INTO "AuditLog" (id,"organizationId","userId",action,"entityType","entityId",metadata,"createdAt")
    VALUES (gen_random_uuid(),root_org,NULL,'ENTERPRISE_AUTO_APPROVED_AFTER_DOCUMENT_REVIEW','Client',target_client,
      jsonb_build_object('paymentValidated',payment_ok,'formSubmitted',form_ok,'contractSigned',contract_ok,'identityHumanVerified',identity_ok,'addressHumanVerified',address_ok),CURRENT_TIMESTAMP);
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION khe_reconcile_enterprise_from_document()
RETURNS trigger AS $$
BEGIN
  PERFORM khe_reconcile_enterprise_validation(NEW."clientId");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "EnterpriseDocument_reconcile_validation" ON "EnterpriseVerificationDocument";
CREATE TRIGGER "EnterpriseDocument_reconcile_validation"
AFTER INSERT OR UPDATE OF status,"deletedAt" ON "EnterpriseVerificationDocument"
FOR EACH ROW EXECUTE FUNCTION khe_reconcile_enterprise_from_document();

CREATE OR REPLACE FUNCTION khe_reconcile_enterprise_from_contract()
RETURNS trigger AS $$
BEGIN
  PERFORM khe_reconcile_enterprise_validation(NEW."clientId");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "EnterpriseContract_reconcile_validation" ON "EnterpriseContract";
CREATE TRIGGER "EnterpriseContract_reconcile_validation"
AFTER INSERT OR UPDATE OF status ON "EnterpriseContract"
FOR EACH ROW EXECUTE FUNCTION khe_reconcile_enterprise_from_contract();
