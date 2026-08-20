-- Global access identity uniqueness for KHE BOOTH.
-- Access e-mails and usernames are unique case-insensitively across the whole platform.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS username TEXT;

-- Refuse a production migration if historical access accounts already collide once
-- e-mails are normalized. This protects existing identities instead of guessing which
-- account should keep a duplicated address.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "User"
    GROUP BY lower(trim(email))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'KHE_ACCESS_EMAIL_CASE_INSENSITIVE_DUPLICATES_FOUND: resolve duplicate User e-mails before applying this migration';
  END IF;
END
$$;

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
