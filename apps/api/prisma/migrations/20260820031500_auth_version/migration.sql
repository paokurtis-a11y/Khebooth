ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "authVersion" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "User_authVersion_idx" ON "User"("id","authVersion") WHERE "isActive"=TRUE;
