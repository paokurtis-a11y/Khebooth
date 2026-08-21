CREATE TABLE IF NOT EXISTS "SocialDeveloperCredential" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
  provider text NOT NULL,
  "credentialsCiphertext" text NOT NULL,
  "configuredFields" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "configuredByUserId" uuid REFERENCES "User"(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialDeveloperCredential_provider_check" CHECK (provider IN ('META','WHATSAPP','TIKTOK','X','TELEGRAM','YOUTUBE')),
  CONSTRAINT "SocialDeveloperCredential_status_check" CHECK (status IN ('ACTIVE','DISABLED')),
  CONSTRAINT "SocialDeveloperCredential_org_provider_key" UNIQUE ("organizationId", provider)
);
CREATE INDEX IF NOT EXISTS "SocialDeveloperCredential_org_idx" ON "SocialDeveloperCredential" ("organizationId", "updatedAt" DESC);
