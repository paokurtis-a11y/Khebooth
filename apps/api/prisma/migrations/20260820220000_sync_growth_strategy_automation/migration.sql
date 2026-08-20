-- Keep commercial strategy settings as the source of truth for automatic public promotions.
-- Paid advertising remains separately approval-gated in Growth Lab.
UPDATE "MarketingAutomationConfig" m
SET enabled=g."autoPromotionEnabled","updatedAt"=CURRENT_TIMESTAMP
FROM "GrowthStrategyConfig" g
WHERE g."organizationId"=m."organizationId";

CREATE OR REPLACE FUNCTION khe_sync_growth_strategy_automation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO "MarketingAutomationConfig" ("organizationId",enabled,"updatedAt")
  VALUES (NEW."organizationId",NEW."autoPromotionEnabled",CURRENT_TIMESTAMP)
  ON CONFLICT ("organizationId") DO UPDATE SET enabled=EXCLUDED.enabled,"updatedAt"=CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "GrowthStrategyConfig_khe_automation" ON "GrowthStrategyConfig";
CREATE TRIGGER "GrowthStrategyConfig_khe_automation"
AFTER INSERT OR UPDATE OF "autoPromotionEnabled" ON "GrowthStrategyConfig"
FOR EACH ROW EXECUTE FUNCTION khe_sync_growth_strategy_automation();
