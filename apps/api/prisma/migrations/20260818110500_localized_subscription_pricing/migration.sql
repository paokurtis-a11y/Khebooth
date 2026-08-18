ALTER TABLE "SubscriptionPlanConfig"
  ADD COLUMN IF NOT EXISTS "localizedPrices" JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE "SubscriptionPlanConfig"
SET "stripePriceId" = CASE code
  WHEN 'STARTER' THEN 'price_1U5ia7Pw7DjFzVboCPV5BsZZ'
  WHEN 'PRO' THEN 'price_1U5id3Pw7DjFzVbooueBojq3'
  WHEN 'BUSINESS' THEN 'price_1U5idEPw7DjFzVbo3uZPxsLH'
  ELSE "stripePriceId"
END,
"localizedPrices" = CASE code
  WHEN 'STARTER' THEN '{"EUR":3090,"GBP":2690,"USD":3590,"CAD":4990,"AUD":5090}'::jsonb
  WHEN 'PRO' THEN '{"EUR":6290,"GBP":5390,"USD":7290,"CAD":10090,"AUD":10290}'::jsonb
  WHEN 'BUSINESS' THEN '{"EUR":10590,"GBP":9090,"USD":12290,"CAD":16990,"AUD":17190}'::jsonb
  ELSE "localizedPrices"
END,
"updatedAt" = CURRENT_TIMESTAMP
WHERE code IN ('STARTER','PRO','BUSINESS');
