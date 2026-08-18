CREATE TABLE IF NOT EXISTS "PublicReview" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "clientId" UUID NOT NULL UNIQUE REFERENCES "Client"("id") ON DELETE CASCADE,
  "rating" INTEGER NOT NULL,
  "title" TEXT,
  "body" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "verifiedSubscriber" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (rating >= 1 AND rating <= 5)
);
CREATE INDEX IF NOT EXISTS "PublicReview_org_active_created_idx" ON "PublicReview"("organizationId","active","createdAt" DESC);
