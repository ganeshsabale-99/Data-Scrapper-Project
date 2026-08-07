-- AlterTable
ALTER TABLE "TechParkCompany"
  ADD COLUMN "place_id" TEXT,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "firstSeenAt" TIMESTAMP(3),
  ADD COLUMN "lastSeenAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "TechParkCompany_place_id_key" ON "TechParkCompany"("place_id");

-- CreateIndex
CREATE INDEX "TechParkCompany_isActive_idx" ON "TechParkCompany"("isActive");
