CREATE TABLE IF NOT EXISTS "AgentApplication" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
  "applicationNumber" TEXT NOT NULL,
  "accessTokenHash" TEXT NOT NULL UNIQUE,
  "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUBMITTED',
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  street TEXT NOT NULL,
  "addressNumber" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  city TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "preferredLanguage" TEXT NOT NULL DEFAULT 'fr',
  "experienceYears" INTEGER NOT NULL DEFAULT 0,
  "boothExperience" JSONB NOT NULL DEFAULT '[]'::jsonb,
  motivation TEXT,
  "privacyAcceptedAt" TIMESTAMP(3) NOT NULL,
  "assignedToUserId" UUID REFERENCES "User"(id) ON DELETE SET NULL,
  "reviewedByUserId" UUID REFERENCES "User"(id) ON DELETE SET NULL,
  "decisionReason" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "teamInvitationId" UUID REFERENCES "TeamInvitation"(id) ON DELETE SET NULL,
  "invitedUserId" UUID REFERENCES "User"(id) ON DELETE SET NULL,
  "activatedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentApplication_status_check" CHECK (status IN ('SUBMITTED','UNDER_REVIEW','CHANGES_REQUESTED','CONTRACT_PENDING','CONTRACT_SIGNED','ACTIVATION_SENT','ACTIVATED','REJECTED')),
  CONSTRAINT "AgentApplication_language_check" CHECK ("preferredLanguage" IN ('fr','en','de','it','es','pt')),
  CONSTRAINT "AgentApplication_country_check" CHECK ("countryCode" ~ '^[A-Z]{2}$'),
  CONSTRAINT "AgentApplication_experience_check" CHECK ("experienceYears" BETWEEN 0 AND 80),
  UNIQUE ("organizationId", "applicationNumber")
);

CREATE INDEX IF NOT EXISTS "AgentApplication_org_status_created_idx" ON "AgentApplication"("organizationId", status, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AgentApplication_org_email_idx" ON "AgentApplication"("organizationId", lower(email));

CREATE TABLE IF NOT EXISTS "AgentApplicationDocument" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
  "applicationId" UUID NOT NULL REFERENCES "AgentApplication"(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  pathname TEXT NOT NULL UNIQUE,
  "originalFileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  "rejectionReason" TEXT,
  "reviewedByUserId" UUID REFERENCES "User"(id) ON DELETE SET NULL,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentApplicationDocument_kind_check" CHECK (kind IN ('IDENTITY','PROOF_OF_ADDRESS','CV','SIGNED_CONTRACT','OTHER')),
  CONSTRAINT "AgentApplicationDocument_status_check" CHECK (status IN ('PENDING','VALID','REJECTED')),
  CONSTRAINT "AgentApplicationDocument_size_check" CHECK ("byteSize" > 0 AND "byteSize" <= 15728640)
);

CREATE INDEX IF NOT EXISTS "AgentApplicationDocument_application_idx" ON "AgentApplicationDocument"("applicationId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "AgentContract" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
  "applicationId" UUID NOT NULL UNIQUE REFERENCES "AgentApplication"(id) ON DELETE CASCADE,
  "contractNumber" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'fr',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  "contractSnapshot" JSONB NOT NULL,
  "contentHash" TEXT NOT NULL,
  "legalReviewRequired" BOOLEAN NOT NULL DEFAULT TRUE,
  "legalReviewConfirmedAt" TIMESTAMP(3),
  "legalReviewConfirmedByUserId" UUID REFERENCES "User"(id) ON DELETE SET NULL,
  "legalReviewReference" TEXT,
  "signatureMethod" TEXT,
  "signerName" TEXT,
  "signatureMention" TEXT,
  "signatureHash" TEXT,
  "signatureEvidence" JSONB,
  "sentAt" TIMESTAMP(3),
  "signedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentContract_status_check" CHECK (status IN ('DRAFT','SENT','SIGNED','VOID')),
  CONSTRAINT "AgentContract_language_check" CHECK (language IN ('fr','en','de','it','es','pt')),
  UNIQUE ("organizationId", "contractNumber")
);

CREATE INDEX IF NOT EXISTS "AgentContract_org_status_idx" ON "AgentContract"("organizationId", status, "createdAt" DESC);
