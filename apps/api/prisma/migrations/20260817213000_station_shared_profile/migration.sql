CREATE TABLE "OrganizationProfile" (
  "organizationId" UUID NOT NULL,
  "firstName" TEXT NOT NULL DEFAULT '',
  "lastName" TEXT NOT NULL DEFAULT '',
  "displayName" TEXT NOT NULL DEFAULT '',
  "company" TEXT NOT NULL DEFAULT '',
  "role" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "city" TEXT NOT NULL DEFAULT '',
  "country" TEXT NOT NULL DEFAULT '',
  "bio" TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationProfile_pkey" PRIMARY KEY ("organizationId"),
  CONSTRAINT "OrganizationProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
