-- CreateTable
CREATE TABLE "CityAlias" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "canonicalCity" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CityAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CityAlias_alias_key" ON "CityAlias"("alias");

-- CreateIndex
CREATE INDEX "CityAlias_canonicalCity_idx" ON "CityAlias"("canonicalCity");

-- CreateIndex
CREATE INDEX "CityAlias_isActive_idx" ON "CityAlias"("isActive");
