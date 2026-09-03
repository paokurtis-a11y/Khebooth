CREATE TABLE "HypnoticMessage" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
  "ownerUserId" uuid NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('OWNER','ASSISTANT')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 12000),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "HypnoticMessage_owner_created_idx"
  ON "HypnoticMessage" ("organizationId", "ownerUserId", "createdAt");

ALTER TABLE "HypnoticMessage" ENABLE ROW LEVEL SECURITY;
