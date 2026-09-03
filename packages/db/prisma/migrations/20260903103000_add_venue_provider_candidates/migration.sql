CREATE TABLE "VenueProviderCandidate" (
    "id" TEXT NOT NULL,
    "venueType" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "venueName" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "candidateName" TEXT,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceDomain" TEXT,
    "snippet" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "relevanceScore" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "rawData" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VenueProviderCandidate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VenueProviderCandidate_venueType_venueId_sourceUrl_key" ON "VenueProviderCandidate"("venueType", "venueId", "sourceUrl");
CREATE INDEX "VenueProviderCandidate_venueType_venueId_idx" ON "VenueProviderCandidate"("venueType", "venueId");
CREATE INDEX "VenueProviderCandidate_status_relevanceScore_idx" ON "VenueProviderCandidate"("status", "relevanceScore");
CREATE INDEX "VenueProviderCandidate_category_idx" ON "VenueProviderCandidate"("category");
