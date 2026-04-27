-- CreateTable
CREATE TABLE "CityCatalog" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CityCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CityCatalog_state_idx" ON "CityCatalog"("state");

-- CreateIndex
CREATE UNIQUE INDEX "CityCatalog_state_city_unique" ON "CityCatalog"("state", "city");

