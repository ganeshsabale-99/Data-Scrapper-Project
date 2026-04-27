-- FundingNews: add founders, investors, location, round
ALTER TABLE "FundingNews"
  ADD COLUMN IF NOT EXISTS "founders"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "investors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "location"  TEXT,
  ADD COLUMN IF NOT EXISTS "round"     TEXT;

-- CoworkingSpace: add all missing columns
ALTER TABLE "CoworkingSpace"
  ADD COLUMN IF NOT EXISTS "lat"                    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "lng"                    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "map_url"                TEXT,
  ADD COLUMN IF NOT EXISTS "website"                TEXT,
  ADD COLUMN IF NOT EXISTS "rating"                 DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "total_ratings"          INTEGER,
  ADD COLUMN IF NOT EXISTS "exterior_media_url"     TEXT,
  ADD COLUMN IF NOT EXISTS "builder_name"           TEXT,
  ADD COLUMN IF NOT EXISTS "security_agency_name"   TEXT,
  ADD COLUMN IF NOT EXISTS "property_manager_name"  TEXT,
  ADD COLUMN IF NOT EXISTS "property_manager_phone" TEXT,
  ADD COLUMN IF NOT EXISTS "property_manager_email" TEXT,
  ADD COLUMN IF NOT EXISTS "parking_floors"         INTEGER,
  ADD COLUMN IF NOT EXISTS "total_floors"           INTEGER,
  ADD COLUMN IF NOT EXISTS "basement_levels"        INTEGER,
  ADD COLUMN IF NOT EXISTS "spoc_name"              TEXT,
  ADD COLUMN IF NOT EXISTS "spoc_phone"             TEXT,
  ADD COLUMN IF NOT EXISTS "seating_capacity"       INTEGER,
  ADD COLUMN IF NOT EXISTS "challenges"             TEXT,
  ADD COLUMN IF NOT EXISTS "exterior_media_urls"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "isVerified"             BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "verifiedAt"             TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verifiedByUserId"       TEXT;

-- ContactLog: add missing columns
ALTER TABLE "ContactLog"
  ADD COLUMN IF NOT EXISTS "coworkingSpaceId" TEXT,
  ADD COLUMN IF NOT EXISTS "newTechParkId"    TEXT,
  ADD COLUMN IF NOT EXISTS "actualLat"        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "actualLng"        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "followUpAt"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "locationTrust"    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "metWithSpoc"      TEXT;

-- Add FK for CoworkingSpace.verifiedByUserId
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'CoworkingSpace_verifiedByUserId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."CoworkingSpace"
      ADD CONSTRAINT "CoworkingSpace_verifiedByUserId_fkey"
      FOREIGN KEY ("verifiedByUserId") REFERENCES "data_scrapper"."AdminUser"("id")
      ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;

-- Add FKs for ContactLog new columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'ContactLog_coworkingSpaceId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."ContactLog"
      ADD CONSTRAINT "ContactLog_coworkingSpaceId_fkey"
      FOREIGN KEY ("coworkingSpaceId") REFERENCES "data_scrapper"."CoworkingSpace"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'ContactLog_newTechParkId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."ContactLog"
      ADD CONSTRAINT "ContactLog_newTechParkId_fkey"
      FOREIGN KEY ("newTechParkId") REFERENCES "data_scrapper"."NewTechPark"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

-- Indexes for new ContactLog columns
CREATE INDEX IF NOT EXISTS "ContactLog_newTechParkId_createdAt_idx" ON "ContactLog" ("newTechParkId", "createdAt");
CREATE INDEX IF NOT EXISTS "ContactLog_coworkingSpaceId_createdAt_idx" ON "ContactLog" ("coworkingSpaceId", "createdAt");
