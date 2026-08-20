-- Marketing consent belongs to the exact e-mail address that granted it.
-- Any Client e-mail change invalidates the previous consent and cancels pending marketing journeys,
-- regardless of which synchronized surface performed the update.

CREATE OR REPLACE FUNCTION "khe_reset_marketing_consent_on_client_email_change"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF lower(COALESCE(OLD.email, '')) IS DISTINCT FROM lower(COALESCE(NEW.email, '')) THEN
    NEW."marketingEmailsEnabled" := FALSE;
    NEW."marketingConsentAt" := NULL;
    NEW."marketingConsentSource" := NULL;
    NEW."marketingConsentVersion" := NULL;
    NEW."marketingUnsubscribedAt" := NULL;
    NEW."lastMarketingEmailAt" := NULL;

    UPDATE "MarketingEmailJourney"
    SET "cancelledAt" = CURRENT_TIMESTAMP,
        "nextDueAt" = NULL,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "clientId" = OLD.id
      AND "completedAt" IS NULL
      AND "cancelledAt" IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Client_reset_marketing_consent_on_email_change" ON "Client";
CREATE TRIGGER "Client_reset_marketing_consent_on_email_change"
BEFORE UPDATE OF email ON "Client"
FOR EACH ROW
EXECUTE FUNCTION "khe_reset_marketing_consent_on_client_email_change"();
