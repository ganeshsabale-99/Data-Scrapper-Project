-- AlterEnum
-- Adds the two additional Contact Status values needed so outreach progress
-- (SPOC identified on a call, or a lead that said no) can be recorded without
-- overloading CONTACTED/CLOSED.
ALTER TYPE "Status" ADD VALUE IF NOT EXISTS 'SPOC_IDENTIFIED' AFTER 'CONTACTED';
ALTER TYPE "Status" ADD VALUE IF NOT EXISTS 'NOT_INTERESTED' AFTER 'INTERESTED';

-- AlterTable: NewTechPark
ALTER TABLE "NewTechPark"
  ADD COLUMN "spoc_email" TEXT,
  ADD COLUMN "dedupe_key" TEXT,
  ADD COLUMN "is_possible_duplicate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "do_not_call" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "NewTechPark_dedupe_key_idx" ON "NewTechPark"("dedupe_key");
CREATE INDEX "NewTechPark_do_not_call_idx" ON "NewTechPark"("do_not_call");

-- AlterTable: CoworkingSpace
ALTER TABLE "CoworkingSpace"
  ADD COLUMN "business_status" TEXT,
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "spoc_email" TEXT,
  ADD COLUMN "dedupe_key" TEXT,
  ADD COLUMN "is_possible_duplicate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "do_not_call" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "CoworkingSpace_dedupe_key_idx" ON "CoworkingSpace"("dedupe_key");
CREATE INDEX "CoworkingSpace_is_active_idx" ON "CoworkingSpace"("is_active");
CREATE INDEX "CoworkingSpace_do_not_call_idx" ON "CoworkingSpace"("do_not_call");

-- AlterTable: Mall
ALTER TABLE "Mall"
  ADD COLUMN "spoc_email" TEXT,
  ADD COLUMN "dedupe_key" TEXT,
  ADD COLUMN "is_possible_duplicate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "do_not_call" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Mall_dedupe_key_idx" ON "Mall"("dedupe_key");
CREATE INDEX "Mall_do_not_call_idx" ON "Mall"("do_not_call");

-- AlterTable: Hospital
ALTER TABLE "Hospital"
  ADD COLUMN "spoc_email" TEXT,
  ADD COLUMN "dedupe_key" TEXT,
  ADD COLUMN "is_possible_duplicate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "do_not_call" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Hospital_dedupe_key_idx" ON "Hospital"("dedupe_key");
CREATE INDEX "Hospital_do_not_call_idx" ON "Hospital"("do_not_call");

-- AlterTable: Stadium
ALTER TABLE "Stadium"
  ADD COLUMN "spoc_email" TEXT,
  ADD COLUMN "dedupe_key" TEXT,
  ADD COLUMN "is_possible_duplicate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "do_not_call" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Stadium_dedupe_key_idx" ON "Stadium"("dedupe_key");
CREATE INDEX "Stadium_do_not_call_idx" ON "Stadium"("do_not_call");

-- AlterTable: Airport
ALTER TABLE "Airport"
  ADD COLUMN "spoc_email" TEXT,
  ADD COLUMN "dedupe_key" TEXT,
  ADD COLUMN "is_possible_duplicate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "do_not_call" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Airport_dedupe_key_idx" ON "Airport"("dedupe_key");
CREATE INDEX "Airport_do_not_call_idx" ON "Airport"("do_not_call");

-- CreateTable: ScrapeReviewQueue
CREATE TABLE "ScrapeReviewQueue" (
    "id" TEXT NOT NULL,
    "venueType" TEXT NOT NULL,
    "placeId" TEXT,
    "name" TEXT,
    "reason" TEXT NOT NULL,
    "rawData" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapeReviewQueue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScrapeReviewQueue_venueType_resolved_idx" ON "ScrapeReviewQueue"("venueType", "resolved");
