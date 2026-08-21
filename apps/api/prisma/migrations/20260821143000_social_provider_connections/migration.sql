CREATE TABLE "SocialProviderConnection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
  "externalAccountId" TEXT,
  "externalAccountName" TEXT,
  "accessTokenCiphertext" TEXT,
  "refreshTokenCiphertext" TEXT,
  "tokenExpiresAt" TIMESTAMP(3),
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "connectedAt" TIMESTAMP(3),
  "disconnectedAt" TIMESTAMP(3),
  "lastValidatedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialProviderConnection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SocialProviderConnection_provider_check" CHECK ("provider" IN ('WHATSAPP','TIKTOK','FACEBOOK','INSTAGRAM','X','TELEGRAM','YOUTUBE')),
  CONSTRAINT "SocialProviderConnection_status_check" CHECK ("status" IN ('DISCONNECTED','AUTHORIZING','SELECTION_REQUIRED','CONNECTED','EXPIRED','ERROR','REVOKED'))
);

CREATE UNIQUE INDEX "SocialProviderConnection_organizationId_provider_key" ON "SocialProviderConnection"("organizationId","provider");
CREATE INDEX "SocialProviderConnection_status_idx" ON "SocialProviderConnection"("status");
ALTER TABLE "SocialProviderConnection"
  ADD CONSTRAINT "SocialProviderConnection_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SocialOAuthState" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "stationSessionId" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "stateHash" TEXT NOT NULL,
  "codeVerifierCiphertext" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialOAuthState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SocialOAuthState_provider_check" CHECK ("provider" IN ('FACEBOOK','INSTAGRAM','TIKTOK','X','YOUTUBE'))
);

CREATE UNIQUE INDEX "SocialOAuthState_stateHash_key" ON "SocialOAuthState"("stateHash");
CREATE INDEX "SocialOAuthState_organizationId_provider_idx" ON "SocialOAuthState"("organizationId","provider","expiresAt");
ALTER TABLE "SocialOAuthState"
  ADD CONSTRAINT "SocialOAuthState_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialOAuthState"
  ADD CONSTRAINT "SocialOAuthState_stationSessionId_fkey"
  FOREIGN KEY ("stationSessionId") REFERENCES "StationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep the state table short-lived even when a browser flow is abandoned.
CREATE INDEX "SocialOAuthState_expiresAt_idx" ON "SocialOAuthState"("expiresAt");
