/*
  Warnings:

  - The values [INTRESTED] on the enum `Status` will be removed. If these variants are still used in the database, this will fail.
  - The `date_published` column on the `FundingNews` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `NewTechPark` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


DO $$
BEGIN
  ALTER TYPE "NewsSource" ADD VALUE 'VCCIRCLE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "NewsSource" ADD VALUE 'TECHCRUNCH';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "NewsSource" ADD VALUE 'ETSTARTUP';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "NewsSource" ADD VALUE 'INC42';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum
DO $$
BEGIN
  CREATE TYPE "Status_new" AS ENUM ('NOT_CONTACTED', 'CONTACTED', 'INTERESTED', 'MEETING_SCHEDULED', 'PROPOSAL_SENT', 'IN_PROGRESS', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

BEGIN;
ALTER TABLE "tech_park"."FundingNews" ALTER COLUMN "contact_status" DROP DEFAULT;
ALTER TABLE "tech_park"."TechPark" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "tech_park"."NewTechPark" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "tech_park"."ContactLog" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "tech_park"."TechPark"
  ALTER COLUMN "status" TYPE "Status_new"
  USING (CASE WHEN "status"::text = 'INTRESTED' THEN 'INTERESTED' ELSE "status"::text END)::"Status_new";
ALTER TABLE "tech_park"."NewTechPark"
  ALTER COLUMN "status" TYPE "Status_new"
  USING (CASE WHEN "status"::text = 'INTRESTED' THEN 'INTERESTED' ELSE "status"::text END)::"Status_new";
ALTER TABLE "tech_park"."ContactLog"
  ALTER COLUMN "status" TYPE "Status_new"
  USING (CASE WHEN "status"::text = 'INTRESTED' THEN 'INTERESTED' ELSE "status"::text END)::"Status_new";
ALTER TABLE "tech_park"."FundingNews"
  ALTER COLUMN "contact_status" TYPE "Status_new"
  USING (CASE WHEN "contact_status"::text = 'INTRESTED' THEN 'INTERESTED' ELSE "contact_status"::text END)::"Status_new";
-- ALTER TABLE "CoworkingSpace" ALTER COLUMN "status" TYPE "Status_new" USING ("status"::text::"Status_new");
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'tech_park' AND t.typname = 'Status'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'tech_park' AND t.typname = 'Status_old'
  ) THEN
    EXECUTE 'ALTER TYPE "tech_park"."Status" RENAME TO "Status_old"';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'tech_park' AND t.typname = 'Status_new'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'tech_park' AND t.typname = 'Status'
  ) THEN
    EXECUTE 'ALTER TYPE "Status_new" RENAME TO "Status"';
  END IF;
END $$;

DROP TYPE IF EXISTS "tech_park"."Status_old";
ALTER TABLE "tech_park"."FundingNews" ALTER COLUMN "contact_status" SET DEFAULT 'NOT_CONTACTED';
ALTER TABLE "tech_park"."TechPark" ALTER COLUMN "status" SET DEFAULT 'NOT_CONTACTED';
ALTER TABLE "tech_park"."NewTechPark" ALTER COLUMN "status" SET DEFAULT 'NOT_CONTACTED';
ALTER TABLE "tech_park"."ContactLog" ALTER COLUMN "status" SET DEFAULT 'NOT_CONTACTED';
COMMIT;

-- AlterTable
ALTER TABLE "tech_park"."ContactLog" ADD COLUMN IF NOT EXISTS    "coworkingCompanyId" TEXT,
ALTER COLUMN "companyId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "tech_park"."FundingNews" DROP COLUMN IF EXISTS "date_published",
ADD COLUMN IF NOT EXISTS    "date_published" TIMESTAMP(3);

-- AlterTable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'tech_park' AND table_name = 'NewTechPark' AND column_name = 'status'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."NewTechPark" DROP COLUMN "status"';
  END IF;
  EXECUTE 'ALTER TABLE "tech_park"."NewTechPark" ADD COLUMN IF NOT EXISTS "status" "Status" NOT NULL DEFAULT ''NOT_CONTACTED''';
END $$;

-- DropEnum
DROP TYPE IF EXISTS "tech_park"."NewTechParkStatus";

-- CreateTable
CREATE TABLE IF NOT EXISTS "tech_park"."CoworkingSpace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT,
    "pincode" TEXT,
    "country" TEXT,
    "address" TEXT,
    "contact_phone" TEXT,
    "international_phone" TEXT,
    "generic_email" TEXT,
    "operator_name" TEXT,
    "campus_brand" TEXT,
    "legal_entity" TEXT,
    "campus_size_hint" TEXT,
    "status" "Status" NOT NULL DEFAULT 'NOT_CONTACTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoworkingSpace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "tech_park"."CoworkingCompany" (
    "id" TEXT NOT NULL,
    "coworkingSpaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "operator" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "contact_international_phone" TEXT,
    "business_status" TEXT NOT NULL DEFAULT 'NOT_CONTACTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoworkingCompany_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'ContactLog_coworkingCompanyId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."ContactLog" ADD CONSTRAINT "ContactLog_coworkingCompanyId_fkey" FOREIGN KEY ("coworkingCompanyId") REFERENCES "tech_park"."CoworkingCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'CoworkingCompany_coworkingSpaceId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."CoworkingCompany" ADD CONSTRAINT "CoworkingCompany_coworkingSpaceId_fkey" FOREIGN KEY ("coworkingSpaceId") REFERENCES "tech_park"."CoworkingSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;
