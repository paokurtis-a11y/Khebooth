ALTER TABLE "OrganizationProfile" ADD COLUMN IF NOT EXISTS "address" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OrganizationProfile" ADD COLUMN IF NOT EXISTS "birthDate" DATE;
ALTER TABLE "OrganizationProfile" ADD COLUMN IF NOT EXISTS "avatarPath" TEXT;
