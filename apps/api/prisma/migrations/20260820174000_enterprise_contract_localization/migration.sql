ALTER TABLE "EnterpriseOnboarding"
  ADD COLUMN IF NOT EXISTS "preferredLanguage" TEXT NOT NULL DEFAULT 'fr';

CREATE INDEX IF NOT EXISTS "EnterpriseOnboarding_language_idx"
  ON "EnterpriseOnboarding"("organizationId","preferredLanguage","updatedAt" DESC);
