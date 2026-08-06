-- AlterTable
ALTER TABLE "ContactLog"
  ADD COLUMN "mallId" TEXT,
  ADD COLUMN "hospitalId" TEXT,
  ADD COLUMN "stadiumId" TEXT,
  ADD COLUMN "airportId" TEXT;

-- AddForeignKey
ALTER TABLE "ContactLog" ADD CONSTRAINT "ContactLog_mallId_fkey" FOREIGN KEY ("mallId") REFERENCES "Mall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactLog" ADD CONSTRAINT "ContactLog_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactLog" ADD CONSTRAINT "ContactLog_stadiumId_fkey" FOREIGN KEY ("stadiumId") REFERENCES "Stadium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactLog" ADD CONSTRAINT "ContactLog_airportId_fkey" FOREIGN KEY ("airportId") REFERENCES "Airport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ContactLog_mallId_createdAt_idx" ON "ContactLog"("mallId", "createdAt");

-- CreateIndex
CREATE INDEX "ContactLog_hospitalId_createdAt_idx" ON "ContactLog"("hospitalId", "createdAt");

-- CreateIndex
CREATE INDEX "ContactLog_stadiumId_createdAt_idx" ON "ContactLog"("stadiumId", "createdAt");

-- CreateIndex
CREATE INDEX "ContactLog_airportId_createdAt_idx" ON "ContactLog"("airportId", "createdAt");
