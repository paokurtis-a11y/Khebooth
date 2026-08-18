ALTER TABLE "OrganizationProfile"
ADD COLUMN "address" TEXT NOT NULL DEFAULT '',
ADD COLUMN "birthDate" DATE,
ADD COLUMN "avatarPath" TEXT;
