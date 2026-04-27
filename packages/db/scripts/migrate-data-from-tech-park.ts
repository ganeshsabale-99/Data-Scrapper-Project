import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🚀 Starting data migration from tech_park → data_scrapper...\n");

    // NewTechPark
    console.log("📦 Migrating NewTechPark...");
    const ntpResult = await prisma.$executeRawUnsafe(`
        INSERT INTO data_scrapper."NewTechPark" (
            id, place_id, name, address_line1, address_line2, locality, city, district,
            state, pincode, country, lat, lng, map_url, photo_url, website,
            reception_phone, international_phone, generic_email, contact_page_url,
            rating, total_ratings, business_status, types, operator_name, campus_brand,
            legal_entity, campus_size_hint, tenant_signal, amenities_signal,
            source_primary, sources_raw, confidence_overall, qa_status, is_active,
            notes_internal, first_seen_at, last_seen_at, last_changed_at,
            "createdAt", "updatedAt", exterior_media_url, builder_name,
            security_agency_name, property_manager_name, property_manager_phone,
            property_manager_email, parking_floors, total_floors, basement_levels,
            spoc_name, spoc_phone, seating_capacity, challenges, exterior_media_urls,
            status, "isVerified", "verifiedByUserId", "verifiedAt",
            duplication_score, "reviewStatus", ai_review_summary
        )
        SELECT
            id, place_id, name, address_line1, address_line2, locality, city, district,
            state, pincode, country, lat, lng, map_url, photo_url, website,
            reception_phone, international_phone, generic_email, contact_page_url,
            rating, total_ratings, business_status, types, operator_name, campus_brand,
            legal_entity, campus_size_hint, tenant_signal, amenities_signal,
            source_primary, sources_raw, confidence_overall, qa_status, is_active,
            notes_internal, first_seen_at, last_seen_at, last_changed_at,
            "createdAt", "updatedAt", exterior_media_url, builder_name,
            security_agency_name, property_manager_name, property_manager_phone,
            property_manager_email, parking_floors, total_floors, basement_levels,
            spoc_name, spoc_phone, seating_capacity, challenges,
            COALESCE(exterior_media_urls, ARRAY[]::text[]),
            status::text::"data_scrapper"."Status",
            "isVerified", NULL, "verifiedAt",
            COALESCE(duplication_score, 0),
            COALESCE("reviewStatus"::text, 'PENDING_REVIEW')::"data_scrapper"."ReviewStatus",
            ai_review_summary
        FROM tech_park."NewTechPark"
        ON CONFLICT (id) DO NOTHING
    `);
    console.log(`   ✅ NewTechPark: ${ntpResult} rows inserted`);

    // TechPark
    console.log("📦 Migrating TechPark...");
    const tpResult = await prisma.$executeRawUnsafe(`
        INSERT INTO data_scrapper."TechPark" (
            id, name, address, city, "locationLat", "locationLng", website,
            description, operator, rating, total_ratings, types, plus_code,
            opening_hours, map_url, photo_reference, "createdAt", "updatedAt",
            email, "internationalPhone", phone, status
        )
        SELECT
            id, name, address, city, "locationLat", "locationLng", website,
            description, operator, rating, total_ratings, types, plus_code,
            opening_hours, map_url, photo_reference, "createdAt", "updatedAt",
            email, "internationalPhone", phone,
            status::text::"data_scrapper"."Status"
        FROM tech_park."TechPark"
        ON CONFLICT (id) DO NOTHING
    `);
    console.log(`   ✅ TechPark: ${tpResult} rows inserted`);

    // FundingNews
    console.log("📦 Migrating FundingNews...");
    const fnResult = await prisma.$executeRawUnsafe(`
        INSERT INTO data_scrapper."FundingNews" (
            id, title, article_url, source, author, content_summary,
            funding_amount, company_name, industry, is_featured, is_bookmarked,
            created_at, updated_at, contact_email, contact_person, contact_phone,
            contact_status, date_published, founders, investors, location, round
        )
        SELECT
            id, title, article_url,
            source::text::"data_scrapper"."NewsSource",
            author, content_summary,
            funding_amount, company_name, industry, is_featured, is_bookmarked,
            created_at, updated_at, contact_email, contact_person, contact_phone,
            contact_status::text::"data_scrapper"."Status",
            date_published,
            COALESCE(founders, ARRAY[]::text[]),
            COALESCE(investors, ARRAY[]::text[]),
            location, round
        FROM tech_park."FundingNews"
        ON CONFLICT (article_url) DO NOTHING
    `);
    console.log(`   ✅ FundingNews: ${fnResult} rows inserted`);

    // CoworkingSpace
    console.log("📦 Migrating CoworkingSpace...");
    const csResult = await prisma.$executeRawUnsafe(`
        INSERT INTO data_scrapper."CoworkingSpace" (
            id, name, city, state, district, pincode, country, address,
            contact_phone, international_phone, generic_email, operator_name,
            campus_brand, legal_entity, campus_size_hint, status,
            "createdAt", "updatedAt", lat, lng, map_url, website, rating,
            total_ratings, exterior_media_url, builder_name, security_agency_name,
            property_manager_name, property_manager_phone, property_manager_email,
            parking_floors, total_floors, basement_levels, spoc_name, spoc_phone,
            seating_capacity, challenges, exterior_media_urls,
            "isVerified", "verifiedAt", "verifiedByUserId"
        )
        SELECT
            id, name, city, state, district, pincode, country, address,
            contact_phone, international_phone, generic_email, operator_name,
            campus_brand, legal_entity, campus_size_hint,
            status::text::"data_scrapper"."Status",
            "createdAt", "updatedAt", lat, lng, map_url, website, rating,
            total_ratings, exterior_media_url, builder_name, security_agency_name,
            property_manager_name, property_manager_phone, property_manager_email,
            parking_floors, total_floors, basement_levels, spoc_name, spoc_phone,
            seating_capacity, challenges,
            COALESCE(exterior_media_urls, ARRAY[]::text[]),
            "isVerified", "verifiedAt", NULL
        FROM tech_park."CoworkingSpace"
        ON CONFLICT (id) DO NOTHING
    `);
    console.log(`   ✅ CoworkingSpace: ${csResult} rows inserted`);

    // TechParkCompany (depends on NewTechPark)
    console.log("📦 Migrating TechParkCompany...");
    const tpcResult = await prisma.$executeRawUnsafe(`
        INSERT INTO data_scrapper."TechParkCompany" (
            id, name, address, city, "locationLat", "locationLng", website,
            description, operator, rating, total_ratings, types, business_status,
            plus_code, opening_hours, map_url, photo_reference, contact_phone,
            contact_international_phone, contact_email, "newTechParkId",
            "createdAt", "updatedAt"
        )
        SELECT
            tc.id, tc.name, tc.address, tc.city, tc."locationLat", tc."locationLng",
            tc.website, tc.description, tc.operator, tc.rating, tc.total_ratings,
            tc.types, tc.business_status, tc.plus_code, tc.opening_hours,
            tc.map_url, tc.photo_reference, tc.contact_phone,
            tc.contact_international_phone, tc.contact_email,
            CASE WHEN ds.id IS NOT NULL THEN tc."newTechParkId" ELSE NULL END,
            tc."createdAt", tc."updatedAt"
        FROM tech_park."TechParkCompany" tc
        LEFT JOIN data_scrapper."NewTechPark" ds ON ds.id = tc."newTechParkId"
        ON CONFLICT (id) DO NOTHING
    `);
    console.log(`   ✅ TechParkCompany: ${tpcResult} rows inserted`);

    // CoworkingCompany (depends on CoworkingSpace)
    console.log("📦 Migrating CoworkingCompany...");
    const ccResult = await prisma.$executeRawUnsafe(`
        INSERT INTO data_scrapper."CoworkingCompany" (
            id, "coworkingSpaceId", name, description, operator,
            contact_phone, contact_email, contact_international_phone,
            business_status, "createdAt", "updatedAt"
        )
        SELECT
            cc.id, cc."coworkingSpaceId", cc.name, cc.description, cc.operator,
            cc.contact_phone, cc.contact_email, cc.contact_international_phone,
            cc.business_status, cc."createdAt", cc."updatedAt"
        FROM tech_park."CoworkingCompany" cc
        INNER JOIN data_scrapper."CoworkingSpace" ds ON ds.id = cc."coworkingSpaceId"
        ON CONFLICT (id) DO NOTHING
    `);
    console.log(`   ✅ CoworkingCompany: ${ccResult} rows inserted`);

    // Summary
    const [ntpCount, tpCount, fnCount, csCount, tpcCount, ccCount] = await Promise.all([
        prisma.newTechPark.count(),
        prisma.techPark.count(),
        prisma.fundingNews.count(),
        prisma.coworkingSpace.count(),
        prisma.techParkCompany.count(),
        prisma.coworkingCompany.count(),
    ]);

    console.log("\n✅ Migration complete! data_scrapper now has:");
    console.log(`   NewTechPark:      ${ntpCount}`);
    console.log(`   TechPark:         ${tpCount}`);
    console.log(`   FundingNews:      ${fnCount}`);
    console.log(`   CoworkingSpace:   ${csCount}`);
    console.log(`   TechParkCompany:  ${tpcCount}`);
    console.log(`   CoworkingCompany: ${ccCount}`);
}

main()
    .catch((e) => {
        console.error("❌ Migration failed:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
