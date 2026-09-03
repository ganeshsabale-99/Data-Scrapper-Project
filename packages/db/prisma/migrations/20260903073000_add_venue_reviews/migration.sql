CREATE TABLE "data_scrapper"."VenueReview" (
  "id" TEXT NOT NULL,
  "venueType" TEXT NOT NULL,
  "venueId" TEXT NOT NULL,
  "placeId" TEXT,
  "provider" TEXT NOT NULL,
  "sourceReviewId" TEXT NOT NULL,
  "authorName" TEXT,
  "authorImageUrl" TEXT,
  "rating" DOUBLE PRECISION,
  "text" TEXT,
  "publishedAt" TIMESTAMP(3),
  "relativeTime" TEXT,
  "issueScore" INTEGER NOT NULL DEFAULT 0,
  "issueCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isParkingRelated" BOOLEAN NOT NULL DEFAULT false,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VenueReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VenueReview_provider_sourceReviewId_key" ON "data_scrapper"."VenueReview"("provider", "sourceReviewId");
CREATE INDEX "VenueReview_venueType_venueId_idx" ON "data_scrapper"."VenueReview"("venueType", "venueId");
CREATE INDEX "VenueReview_venueType_venueId_publishedAt_idx" ON "data_scrapper"."VenueReview"("venueType", "venueId", "publishedAt");
CREATE INDEX "VenueReview_isParkingRelated_idx" ON "data_scrapper"."VenueReview"("isParkingRelated");
CREATE INDEX "VenueReview_issueScore_idx" ON "data_scrapper"."VenueReview"("issueScore");
