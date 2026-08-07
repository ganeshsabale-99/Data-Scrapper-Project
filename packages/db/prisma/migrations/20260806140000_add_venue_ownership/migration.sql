-- AlterTable
ALTER TABLE "NewTechPark" ADD COLUMN "ownerId" TEXT, ADD COLUMN "assignedAt" TIMESTAMP(3);
-- AlterTable
ALTER TABLE "CoworkingSpace" ADD COLUMN "ownerId" TEXT, ADD COLUMN "assignedAt" TIMESTAMP(3);
-- AlterTable
ALTER TABLE "Mall" ADD COLUMN "ownerId" TEXT, ADD COLUMN "assignedAt" TIMESTAMP(3);
-- AlterTable
ALTER TABLE "Hospital" ADD COLUMN "ownerId" TEXT, ADD COLUMN "assignedAt" TIMESTAMP(3);
-- AlterTable
ALTER TABLE "Stadium" ADD COLUMN "ownerId" TEXT, ADD COLUMN "assignedAt" TIMESTAMP(3);
-- AlterTable
ALTER TABLE "Airport" ADD COLUMN "ownerId" TEXT, ADD COLUMN "assignedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "NewTechPark" ADD CONSTRAINT "NewTechPark_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "CoworkingSpace" ADD CONSTRAINT "CoworkingSpace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Mall" ADD CONSTRAINT "Mall_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Hospital" ADD CONSTRAINT "Hospital_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Stadium" ADD CONSTRAINT "Stadium_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Airport" ADD CONSTRAINT "Airport_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "NewTechPark_ownerId_idx" ON "NewTechPark"("ownerId");
-- CreateIndex
CREATE INDEX "CoworkingSpace_ownerId_idx" ON "CoworkingSpace"("ownerId");
-- CreateIndex
CREATE INDEX "Mall_ownerId_idx" ON "Mall"("ownerId");
-- CreateIndex
CREATE INDEX "Hospital_ownerId_idx" ON "Hospital"("ownerId");
-- CreateIndex
CREATE INDEX "Stadium_ownerId_idx" ON "Stadium"("ownerId");
-- CreateIndex
CREATE INDEX "Airport_ownerId_idx" ON "Airport"("ownerId");
