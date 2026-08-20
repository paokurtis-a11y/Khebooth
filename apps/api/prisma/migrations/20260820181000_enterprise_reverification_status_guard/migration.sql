CREATE OR REPLACE FUNCTION khe_protect_enterprise_approval_during_reverification()
RETURNS trigger AS $$
BEGIN
  IF OLD.status='APPROVED' AND NEW.status='CHANGES_REQUESTED' AND OLD."verificationCycle">0 THEN
    NEW.status:='APPROVED';
    NEW."reverificationStatus":='CHANGES_REQUESTED';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "EnterpriseOnboarding_protect_annual_approval" ON "EnterpriseOnboarding";
CREATE TRIGGER "EnterpriseOnboarding_protect_annual_approval"
BEFORE UPDATE OF status ON "EnterpriseOnboarding"
FOR EACH ROW EXECUTE FUNCTION khe_protect_enterprise_approval_during_reverification();
