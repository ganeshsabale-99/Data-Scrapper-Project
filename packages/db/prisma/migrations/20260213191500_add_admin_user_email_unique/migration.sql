DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "tech_park"."AdminUser"
    GROUP BY LOWER("email")
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot apply AdminUser email uniqueness: duplicate email values exist. Resolve duplicates first.';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AdminUser_email_key'
      AND conrelid = 'tech_park."AdminUser"'::regclass
  ) THEN
    ALTER TABLE "tech_park"."AdminUser"
    ADD CONSTRAINT "AdminUser_email_key" UNIQUE ("email");
  END IF;
END
$$;
