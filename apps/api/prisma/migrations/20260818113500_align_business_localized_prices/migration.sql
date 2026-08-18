UPDATE "SubscriptionPlanConfig"
SET "localizedPrices" = COALESCE("localizedPrices", '{}'::jsonb) || '{"GBP":8990,"USD":12190}'::jsonb,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE code = 'BUSINESS';
