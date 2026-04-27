-- Align NewTechPark status enum with shared Status enum and add read-heavy indexes.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'tech_park'
      AND table_name = 'NewTechPark'
      AND column_name = 'status'
      AND udt_name = 'NewTechParkStatus'
  ) THEN
    EXECUTE '
      ALTER TABLE "tech_park"."NewTechPark"
      ALTER COLUMN "status" DROP DEFAULT
    ';
    EXECUTE '
      ALTER TABLE "tech_park"."NewTechPark"
      ALTER COLUMN "status" TYPE "tech_park"."Status"
      USING ("status"::text::"tech_park"."Status")
    ';
    EXECUTE '
      ALTER TABLE "tech_park"."NewTechPark"
      ALTER COLUMN "status" SET DEFAULT ''NOT_CONTACTED''::"tech_park"."Status"
    ';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'tech_park' AND t.typname = 'NewTechParkStatus'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE n.nspname = 'tech_park'
      AND t.typname = 'NewTechParkStatus'
      AND a.attnum > 0
      AND NOT a.attisdropped
  ) THEN
    EXECUTE 'DROP TYPE "tech_park"."NewTechParkStatus"';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "NewTechPark_state_idx" ON "tech_park"."NewTechPark" ("state");
CREATE INDEX IF NOT EXISTS "NewTechPark_state_city_idx" ON "tech_park"."NewTechPark" ("state", "city");
CREATE INDEX IF NOT EXISTS "NewTechPark_status_idx" ON "tech_park"."NewTechPark" ("status");
CREATE INDEX IF NOT EXISTS "NewTechPark_is_active_idx" ON "tech_park"."NewTechPark" ("is_active");

CREATE INDEX IF NOT EXISTS "TechParkCompany_newTechParkId_idx" ON "tech_park"."TechParkCompany" ("newTechParkId");
CREATE INDEX IF NOT EXISTS "TechParkCompany_business_status_idx" ON "tech_park"."TechParkCompany" ("business_status");
CREATE INDEX IF NOT EXISTS "TechParkCompany_city_idx" ON "tech_park"."TechParkCompany" ("city");

CREATE INDEX IF NOT EXISTS "ContactLog_companyId_createdAt_idx" ON "tech_park"."ContactLog" ("companyId", "createdAt");
CREATE INDEX IF NOT EXISTS "ContactLog_coworkingCompanyId_createdAt_idx" ON "tech_park"."ContactLog" ("coworkingCompanyId", "createdAt");
CREATE INDEX IF NOT EXISTS "ContactLog_status_idx" ON "tech_park"."ContactLog" ("status");

CREATE INDEX IF NOT EXISTS "CoworkingSpace_state_idx" ON "tech_park"."CoworkingSpace" ("state");
CREATE INDEX IF NOT EXISTS "CoworkingSpace_state_city_idx" ON "tech_park"."CoworkingSpace" ("state", "city");
CREATE INDEX IF NOT EXISTS "CoworkingSpace_status_idx" ON "tech_park"."CoworkingSpace" ("status");

CREATE INDEX IF NOT EXISTS "CoworkingCompany_coworkingSpaceId_idx" ON "tech_park"."CoworkingCompany" ("coworkingSpaceId");
CREATE INDEX IF NOT EXISTS "CoworkingCompany_business_status_idx" ON "tech_park"."CoworkingCompany" ("business_status");
