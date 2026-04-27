-- CreateEnum
CREATE TYPE "ContactLogType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'DEMO', 'PROPOSAL');

-- CreateTable
CREATE TABLE "ContactLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "ContactLogType" NOT NULL DEFAULT 'CALL',
    "status" "Status" NOT NULL,
    "subject" TEXT,
    "notes" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3),
    "attachments" JSONB,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ContactLog" ADD CONSTRAINT "ContactLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "TechParkCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
