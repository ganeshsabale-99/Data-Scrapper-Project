-- CreateEnum
CREATE TYPE "ScrapeJobStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "ScrapeJob" (
    "id" TEXT NOT NULL,
    "venueType" TEXT NOT NULL,
    "status" "ScrapeJobStatus" NOT NULL DEFAULT 'RUNNING',
    "triggeredBy" TEXT,
    "testMode" BOOLEAN NOT NULL DEFAULT false,
    "cityFilter" TEXT,
    "totalFound" INTEGER,
    "saved" INTEGER,
    "skipped" INTEGER,
    "failed" INTEGER,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ScrapeJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScrapeJob_venueType_status_idx" ON "ScrapeJob"("venueType", "status");

-- CreateIndex
CREATE INDEX "ScrapeJob_startedAt_idx" ON "ScrapeJob"("startedAt");
