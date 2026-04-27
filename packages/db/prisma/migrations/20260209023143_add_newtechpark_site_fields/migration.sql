-- AlterTable
ALTER TABLE "NewTechPark"
ADD COLUMN     "exterior_media_url" TEXT,
ADD COLUMN     "builder_name" TEXT,
ADD COLUMN     "security_agency_name" TEXT,
ADD COLUMN     "property_manager_name" TEXT,
ADD COLUMN     "property_manager_phone" TEXT,
ADD COLUMN     "property_manager_email" TEXT,
ADD COLUMN     "parking_floors" INTEGER,
ADD COLUMN     "total_floors" INTEGER,
ADD COLUMN     "basement_levels" INTEGER,
ADD COLUMN     "spoc_name" TEXT,
ADD COLUMN     "spoc_phone" TEXT,
ADD COLUMN     "seating_capacity" INTEGER,
ADD COLUMN     "challenges" TEXT;

