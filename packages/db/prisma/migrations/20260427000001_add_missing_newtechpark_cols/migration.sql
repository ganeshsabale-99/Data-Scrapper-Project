DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE t.typname = 'ReviewStatus' AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "ReviewStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');
  END IF;
END $$;

ALTER TABLE "NewTechPark"
  ADD COLUMN IF NOT EXISTS "duplication_score" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  ADD COLUMN IF NOT EXISTS "ai_review_summary" JSONB;

CREATE INDEX IF NOT EXISTS "NewTechPark_reviewStatus_idx" ON "NewTechPark" ("reviewStatus");
