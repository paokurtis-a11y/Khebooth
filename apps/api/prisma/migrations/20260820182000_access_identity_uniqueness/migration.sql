-- Global access identity uniqueness for KHE BOOTH.
-- Access e-mails and usernames are unique case-insensitively across the whole platform.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS username TEXT;

UPDATE "User"
SET email = lower(trim(email))
WHERE email <> lower(trim(email));

CREATE UNIQUE INDEX IF NOT EXISTS "User_lower_email_key"
  ON "User" (lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS "User_lower_username_key"
  ON "User" (lower(username))
  WHERE username IS NOT NULL;

ALTER TABLE "User"
  DROP CONSTRAINT IF EXISTS "User_username_format_check";

ALTER TABLE "User"
  ADD CONSTRAINT "User_username_format_check"
  CHECK (username IS NULL OR username ~ '^[a-z0-9][a-z0-9._-]{2,31}$');
