CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION khe_sync_enterprise_contract_term()
RETURNS trigger AS $$
DECLARE
  q_term INTEGER;
BEGIN
  IF NEW."quoteId" IS NOT NULL THEN
    SELECT "contractTermMonths" INTO q_term FROM "EnterpriseQuote" WHERE id=NEW."quoteId";
    IF q_term IN (12,24,36,48,60) THEN
      NEW."termMonths" := q_term;
      NEW."contractSnapshot" := jsonb_set(COALESCE(NEW."contractSnapshot",'{}'::jsonb),'{termMonths}',to_jsonb(q_term),true);
      NEW."contractSnapshot" := jsonb_set(COALESCE(NEW."contractSnapshot",'{}'::jsonb),'{quote,contractTermMonths}',to_jsonb(q_term),true);
      NEW."contentHash" := encode(digest(convert_to(NEW."contractSnapshot"::text,'UTF8'),'sha256'),'hex');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "EnterpriseContract_term_sync" ON "EnterpriseContract";
CREATE TRIGGER "EnterpriseContract_term_sync"
BEFORE INSERT OR UPDATE OF "quoteId","contractSnapshot","termMonths" ON "EnterpriseContract"
FOR EACH ROW EXECUTE FUNCTION khe_sync_enterprise_contract_term();
