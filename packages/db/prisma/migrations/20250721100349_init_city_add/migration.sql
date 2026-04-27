    -- CreateTable
    CREATE TABLE "TechPark" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "address" TEXT NOT NULL,
        "city" TEXT NOT NULL,
        "locationLat" DOUBLE PRECISION NOT NULL,
        "locationLng" DOUBLE PRECISION NOT NULL,
        "website" TEXT,
        "description" TEXT,
        "operator" TEXT,
        "rating" DOUBLE PRECISION,
        "total_ratings" INTEGER,
        "types" TEXT[],
        "business_status" TEXT NOT NULL,
        "plus_code" TEXT,
        "opening_hours" TEXT[],
        "map_url" TEXT,
        "photo_reference" TEXT,
        "contact_phone" TEXT,
        "contact_international_phone" TEXT,
        "contact_email" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,

        CONSTRAINT "TechPark_pkey" PRIMARY KEY ("id")
    );
