/*
  Warnings:

  - You are about to drop the column `contact_email` on the `TechPark` table. All the data in the column will be lost.
  - You are about to drop the column `contact_international_phone` on the `TechPark` table. All the data in the column will be lost.
  - You are about to drop the column `contact_phone` on the `TechPark` table. All the data in the column will be lost.
  - Made the column `address` on table `TechPark` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "TechPark" DROP COLUMN "contact_email",
DROP COLUMN "contact_international_phone",
DROP COLUMN "contact_phone",
ADD COLUMN     "email" TEXT,
ADD COLUMN     "internationalPhone" TEXT,
ADD COLUMN     "phone" TEXT,
ALTER COLUMN "address" SET NOT NULL;
