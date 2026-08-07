-- New FundingNews rows were failing to insert with a NOT NULL violation on
-- "founders"/"investors" because these array columns had no default and no
-- code path ever set them explicitly on create. Backfill existing NULLs (if
-- any slipped through some other path) and set a real default going forward.
UPDATE "FundingNews" SET "founders" = '{}' WHERE "founders" IS NULL;
UPDATE "FundingNews" SET "investors" = '{}' WHERE "investors" IS NULL;

ALTER TABLE "FundingNews" ALTER COLUMN "founders" SET DEFAULT '{}';
ALTER TABLE "FundingNews" ALTER COLUMN "investors" SET DEFAULT '{}';
