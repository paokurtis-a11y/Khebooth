ALTER TABLE "EnterpriseOfferTemplate"
  ADD COLUMN IF NOT EXISTS "termPricing" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "EnterpriseQuote"
  ADD COLUMN IF NOT EXISTS "totalContractCents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "EnterpriseContractTemplate" DROP CONSTRAINT IF EXISTS "EnterpriseContractTemplate_term_check";
ALTER TABLE "EnterpriseContractTemplate" ADD CONSTRAINT "EnterpriseContractTemplate_term_check" CHECK ("termMonths" IN (12,24,36,48,60));
ALTER TABLE "EnterpriseQuote" DROP CONSTRAINT IF EXISTS "EnterpriseQuote_contract_term_check";
ALTER TABLE "EnterpriseQuote" ADD CONSTRAINT "EnterpriseQuote_contract_term_check" CHECK ("contractTermMonths" IN (12,24,36,48,60));
ALTER TABLE "EnterpriseOfferTemplate" DROP CONSTRAINT IF EXISTS "EnterpriseOfferTemplate_contract_term_check";
ALTER TABLE "EnterpriseOfferTemplate" ADD CONSTRAINT "EnterpriseOfferTemplate_contract_term_check" CHECK ("contractTermMonths" IN (12,24,36,48,60));
ALTER TABLE "EnterpriseContract" DROP CONSTRAINT IF EXISTS "EnterpriseContract_term_check";
ALTER TABLE "EnterpriseContract" ADD CONSTRAINT "EnterpriseContract_term_check" CHECK ("termMonths" IN (12,24,36,48,60));

-- Suggested launch pricing. OWNER can change every amount from KHE BOOTH.
-- Values are annual invoice amounts in CHF cents for each commitment duration.
UPDATE "EnterpriseOfferTemplate"
SET "termPricing"='{
  "12":{"annualCents":154800,"monthlyEquivalentCents":12900,"discountPercent":0},
  "24":{"annualCents":142800,"monthlyEquivalentCents":11900,"discountPercent":8},
  "36":{"annualCents":130800,"monthlyEquivalentCents":10900,"discountPercent":16},
  "48":{"annualCents":118800,"monthlyEquivalentCents":9900,"discountPercent":23},
  "60":{"annualCents":106800,"monthlyEquivalentCents":8900,"discountPercent":31}
}'::jsonb,
"baseAnnualCents"=154800,"baseMonthlyCents"=12900,"contractTermMonths"=12,"billingCadence"='ANNUAL'
WHERE code='ENTERPRISE_ESSENTIAL';

UPDATE "EnterpriseOfferTemplate"
SET "termPricing"='{
  "12":{"annualCents":298800,"monthlyEquivalentCents":24900,"discountPercent":0},
  "24":{"annualCents":274800,"monthlyEquivalentCents":22900,"discountPercent":8},
  "36":{"annualCents":250800,"monthlyEquivalentCents":20900,"discountPercent":16},
  "48":{"annualCents":226800,"monthlyEquivalentCents":18900,"discountPercent":24},
  "60":{"annualCents":202800,"monthlyEquivalentCents":16900,"discountPercent":32}
}'::jsonb,
"baseAnnualCents"=298800,"baseMonthlyCents"=24900,"contractTermMonths"=12,"billingCadence"='ANNUAL'
WHERE code='ENTERPRISE_SCALE';

UPDATE "EnterpriseOfferTemplate"
SET "termPricing"='{
  "12":{"quoteRequired":true},"24":{"quoteRequired":true},"36":{"quoteRequired":true},"48":{"quoteRequired":true},"60":{"quoteRequired":true}
}'::jsonb,
"contractTermMonths"=12,"billingCadence"='ANNUAL'
WHERE code='ENTERPRISE_CUSTOM';

UPDATE "EnterpriseQuote"
SET "totalContractCents"=GREATEST(0,("annualCents" * ("contractTermMonths"/12)) + "setupFeeCents" - "discountCents")
WHERE "totalContractCents"=0;
