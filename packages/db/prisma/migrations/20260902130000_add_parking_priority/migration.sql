-- Numeric priority derived from the existing parking_score (HIGH/MEDIUM/LOW)
-- signal, so the sales team can sort/filter venues by parking-problem
-- severity efficiently at the DB level (a plain string column sorts
-- alphabetically — HIGH, LOW, MEDIUM — which is not severity order).

ALTER TABLE "Mall" ADD COLUMN "parking_priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Hospital" ADD COLUMN "parking_priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Stadium" ADD COLUMN "parking_priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Airport" ADD COLUMN "parking_priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CoworkingSpace" ADD COLUMN "parking_priority" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Mall_parking_priority_idx" ON "Mall"("parking_priority");
CREATE INDEX "Hospital_parking_priority_idx" ON "Hospital"("parking_priority");
CREATE INDEX "Stadium_parking_priority_idx" ON "Stadium"("parking_priority");
CREATE INDEX "Airport_parking_priority_idx" ON "Airport"("parking_priority");
CREATE INDEX "CoworkingSpace_parking_priority_idx" ON "CoworkingSpace"("parking_priority");

-- Backfill existing rows' priority from their existing parking_score string
-- so sorting is correct immediately, without waiting for the next scrape.
UPDATE "Mall" SET "parking_priority" = CASE parking_score WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 1 ELSE 0 END;
UPDATE "Hospital" SET "parking_priority" = CASE parking_score WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 1 ELSE 0 END;
UPDATE "Stadium" SET "parking_priority" = CASE parking_score WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 1 ELSE 0 END;
UPDATE "Airport" SET "parking_priority" = CASE parking_score WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 1 ELSE 0 END;
