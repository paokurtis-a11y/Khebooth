CREATE OR REPLACE FUNCTION khe_open_enterprise_onboarding_after_payment()
RETURNS TRIGGER AS $$
DECLARE
  selected_template UUID;
BEGIN
  IF NEW."subscriptionPlan"='ENTERPRISE' AND NEW."paymentStatus"='PAID' THEN
    SELECT id INTO selected_template
      FROM "EnterpriseFormTemplate"
      WHERE "organizationId"=NEW."organizationId" AND code='GLOBAL_BASELINE' AND active=TRUE
      LIMIT 1;

    INSERT INTO "EnterpriseOnboarding" (
      id,"organizationId","clientId","templateId",status,"paymentVerifiedAt","formAvailableAt","updatedAt"
    ) VALUES (
      gen_random_uuid(),NEW."organizationId",NEW.id,selected_template,'FORM_AVAILABLE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
    )
    ON CONFLICT ("clientId") DO UPDATE SET
      "paymentVerifiedAt"=COALESCE("EnterpriseOnboarding"."paymentVerifiedAt",CURRENT_TIMESTAMP),
      "formAvailableAt"=COALESCE("EnterpriseOnboarding"."formAvailableAt",CURRENT_TIMESTAMP),
      status=CASE
        WHEN "EnterpriseOnboarding".status='PAYMENT_PENDING' THEN 'FORM_AVAILABLE'
        ELSE "EnterpriseOnboarding".status
      END,
      "updatedAt"=CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Client_enterprise_onboarding_after_payment" ON "Client";
CREATE TRIGGER "Client_enterprise_onboarding_after_payment"
AFTER INSERT OR UPDATE OF "subscriptionPlan","paymentStatus" ON "Client"
FOR EACH ROW EXECUTE FUNCTION khe_open_enterprise_onboarding_after_payment();

-- Backfill any already-paid Enterprise client without changing access state.
INSERT INTO "EnterpriseOnboarding" (id,"organizationId","clientId","templateId",status,"paymentVerifiedAt","formAvailableAt","updatedAt")
SELECT gen_random_uuid(),c."organizationId",c.id,t.id,'FORM_AVAILABLE',COALESCE(c."lastPaymentAt",CURRENT_TIMESTAMP),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM "Client" c
LEFT JOIN "EnterpriseFormTemplate" t ON t."organizationId"=c."organizationId" AND t.code='GLOBAL_BASELINE' AND t.active=TRUE
WHERE c."subscriptionPlan"='ENTERPRISE' AND c."paymentStatus"='PAID'
ON CONFLICT ("clientId") DO NOTHING;
