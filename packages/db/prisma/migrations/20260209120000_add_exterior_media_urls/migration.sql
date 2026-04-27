-- AlterTable
ALTER TABLE "NewTechPark"
ADD COLUMN     "exterior_media_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill from legacy single-url column
UPDATE "NewTechPark"
SET "exterior_media_urls" = ARRAY["exterior_media_url"]
WHERE "exterior_media_url" IS NOT NULL
  AND "exterior_media_url" <> ''
  AND COALESCE(array_length("exterior_media_urls", 1), 0) = 0;

