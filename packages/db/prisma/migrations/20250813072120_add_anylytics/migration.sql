/*
  Warnings:

  - You are about to drop the column `business_status` on the `TechPark` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "Status" AS ENUM ('NOT_CONTACTED', 'CONTACTED', 'INTRESTED', 'MEETING_SCHEDULED', 'PROPOSAL_SENT', 'CLOSED');

-- AlterTable
ALTER TABLE "TechPark" DROP COLUMN "business_status",
ADD COLUMN     "status" "Status" NOT NULL DEFAULT 'NOT_CONTACTED';
