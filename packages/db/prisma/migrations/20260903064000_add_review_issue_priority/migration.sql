ALTER TABLE "data_scrapper"."NewTechPark"
  ADD COLUMN "review_issue_score" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "review_priority" TEXT NOT NULL DEFAULT 'P4_LOW',
  ADD COLUMN "review_issue_categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "review_issue_summary" TEXT,
  ADD COLUMN "review_evidence" JSONB,
  ADD COLUMN "reviews_analyzed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "review_analyzed_at" TIMESTAMP(3);

ALTER TABLE "data_scrapper"."CoworkingSpace"
  ADD COLUMN "review_issue_score" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "review_priority" TEXT NOT NULL DEFAULT 'P4_LOW',
  ADD COLUMN "review_issue_categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "review_issue_summary" TEXT,
  ADD COLUMN "review_evidence" JSONB,
  ADD COLUMN "reviews_analyzed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "review_analyzed_at" TIMESTAMP(3);

ALTER TABLE "data_scrapper"."Mall" ADD COLUMN "review_issue_score" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "review_priority" TEXT NOT NULL DEFAULT 'P4_LOW', ADD COLUMN "review_issue_categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], ADD COLUMN "review_issue_summary" TEXT, ADD COLUMN "review_evidence" JSONB, ADD COLUMN "reviews_analyzed" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "review_analyzed_at" TIMESTAMP(3);
ALTER TABLE "data_scrapper"."Hospital" ADD COLUMN "review_issue_score" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "review_priority" TEXT NOT NULL DEFAULT 'P4_LOW', ADD COLUMN "review_issue_categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], ADD COLUMN "review_issue_summary" TEXT, ADD COLUMN "review_evidence" JSONB, ADD COLUMN "reviews_analyzed" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "review_analyzed_at" TIMESTAMP(3);
ALTER TABLE "data_scrapper"."Stadium" ADD COLUMN "review_issue_score" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "review_priority" TEXT NOT NULL DEFAULT 'P4_LOW', ADD COLUMN "review_issue_categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], ADD COLUMN "review_issue_summary" TEXT, ADD COLUMN "review_evidence" JSONB, ADD COLUMN "reviews_analyzed" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "review_analyzed_at" TIMESTAMP(3);
ALTER TABLE "data_scrapper"."Airport" ADD COLUMN "review_issue_score" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "review_priority" TEXT NOT NULL DEFAULT 'P4_LOW', ADD COLUMN "review_issue_categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], ADD COLUMN "review_issue_summary" TEXT, ADD COLUMN "review_evidence" JSONB, ADD COLUMN "reviews_analyzed" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "review_analyzed_at" TIMESTAMP(3);

CREATE INDEX "NewTechPark_review_issue_score_idx" ON "data_scrapper"."NewTechPark"("review_issue_score");
CREATE INDEX "CoworkingSpace_review_issue_score_idx" ON "data_scrapper"."CoworkingSpace"("review_issue_score");
CREATE INDEX "Mall_review_issue_score_idx" ON "data_scrapper"."Mall"("review_issue_score");
CREATE INDEX "Hospital_review_issue_score_idx" ON "data_scrapper"."Hospital"("review_issue_score");
CREATE INDEX "Stadium_review_issue_score_idx" ON "data_scrapper"."Stadium"("review_issue_score");
CREATE INDEX "Airport_review_issue_score_idx" ON "data_scrapper"."Airport"("review_issue_score");
