-- Correct Routing v2 tenant classification: tenant kind belongs to Organization, not User.
-- Keep unknown follow-up language neutral so it does not overwrite the existing conversation language.

CREATE OR REPLACE FUNCTION khe_detect_support_language(input_text TEXT, fallback TEXT DEFAULT 'fr')
RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE
    WHEN lower(COALESCE(input_text,'')) ~ '(hallo|hilfe|rechnung|passwort|anmeldung|bitte)' THEN 'de'
    WHEN lower(COALESCE(input_text,'')) ~ '(hola|ayuda|factura|contraseña|cuenta|por favor)' THEN 'es'
    WHEN lower(COALESCE(input_text,'')) ~ '(ciao|aiuto|fattura|password|account|per favore)' THEN 'it'
    WHEN lower(COALESCE(input_text,'')) ~ '(olá|ola |ajuda|fatura|senha|conta|por favor)' THEN 'pt'
    WHEN lower(COALESCE(input_text,'')) ~ '(hello|help|invoice|password|account|please)' THEN 'en'
    WHEN lower(COALESCE(input_text,'')) ~ '(bonjour|aide|facture|mot de passe|compte|s.il vous plait|s’il vous plaît)' THEN 'fr'
    ELSE fallback END;
$$;

CREATE OR REPLACE FUNCTION khe_classify_support_conversation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE default_lang TEXT; requester_tenant TEXT;
BEGIN
  SELECT COALESCE("defaultLanguage",'fr') INTO default_lang FROM "SupportRoutingPolicy" WHERE "organizationId"=NEW."organizationId";
  SELECT COALESCE(o."tenantKind",'KHE_ROOT') INTO requester_tenant
  FROM "User" u JOIN "Organization" o ON o.id=u."organizationId"
  WHERE u.id=NEW."requesterUserId";
  IF TG_OP='INSERT' OR NEW."routingTopic" IS NULL OR NEW."routingTopic"='GENERAL' THEN NEW."routingTopic":=khe_detect_support_topic(NEW.subject); END IF;
  IF TG_OP='INSERT' OR NEW."requestedLanguage" IS NULL THEN NEW."requestedLanguage":=COALESCE(khe_detect_support_language(NEW.subject,default_lang),default_lang,'fr'); END IF;
  IF requester_tenant='ENTERPRISE_CLIENT' THEN NEW."customerTier":='ENTERPRISE'; ELSE NEW."customerTier":=COALESCE(NEW."customerTier",'STANDARD'); END IF;
  IF lower(COALESCE(NEW.subject,'')) ~ '(urgent|evenement en cours|événement en cours|prestation en cours|panne|bloque maintenant)' THEN NEW.priority:='CRITICAL';
  ELSIF NEW."customerTier"='ENTERPRISE' OR NEW."routingTopic" IN ('ENTERPRISE','BILLING','SECURITY') THEN NEW.priority:=CASE WHEN NEW.priority='CRITICAL' THEN 'CRITICAL' ELSE 'HIGH' END;
  ELSE NEW.priority:=COALESCE(NEW.priority,'NORMAL'); END IF;
  RETURN NEW;
END;
$$;
