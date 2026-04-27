-- CreateEnum
CREATE TYPE "NewTechParkStatus" AS ENUM ('NOT_CONTACTED', 'CONTACTED', 'INTRESTED', 'MEETING_SCHEDULED', 'PROPOSAL_SENT', 'IN_PROGRESS');

-- CreateTable
CREATE TABLE "NewTechPark" (
    "id" TEXT NOT NULL,
    "place_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "locality" TEXT,
    "city" TEXT,
    "district" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "country" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "map_url" TEXT,
    "photo_url" TEXT,
    "website" TEXT,
    "reception_phone" TEXT,
    "international_phone" TEXT,
    "generic_email" TEXT,
    "contact_page_url" TEXT,
    "rating" DOUBLE PRECISION,
    "total_ratings" INTEGER,
    "business_status" TEXT,
    "types" TEXT[],
    "operator_name" TEXT,
    "campus_brand" TEXT,
    "legal_entity" TEXT,
    "campus_size_hint" TEXT,
    "tenant_signal" TEXT,
    "amenities_signal" TEXT,
    "source_primary" TEXT,
    "sources_raw" JSONB,
    "confidence_overall" DOUBLE PRECISION,
    "qa_status" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "notes_internal" TEXT,
    "first_seen_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "last_changed_at" TIMESTAMP(3),
    "status" "NewTechParkStatus" NOT NULL,

    CONSTRAINT "NewTechPark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewTechPark_place_id_key" ON "NewTechPark"("place_id");
