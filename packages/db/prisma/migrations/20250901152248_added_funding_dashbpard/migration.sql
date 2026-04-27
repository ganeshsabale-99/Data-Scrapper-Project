-- CreateEnum
CREATE TYPE "NewsSource" AS ENUM ('ENTRACKR', 'YOURSTORY');

-- CreateTable
CREATE TABLE "FundingNews" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "article_url" TEXT NOT NULL,
    "source" "NewsSource" NOT NULL,
    "author" TEXT,
    "date_published" TEXT,
    "content_summary" TEXT,
    "funding_amount" TEXT,
    "company_name" TEXT,
    "industry" TEXT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_bookmarked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingNews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FundingNews_article_url_key" ON "FundingNews"("article_url");
