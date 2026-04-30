import dotenv from "dotenv";
import path from "path";
import { prismaInstance } from "@repo/db";
import { enrichTechParkWebsiteDetails } from "../src/libs/techParkWebsiteEnrichment";

dotenv.config();
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
}
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
}
if (!process.env.GOOGLE_API_KEY) {
  dotenv.config({ path: path.resolve(process.cwd(), "apps/analyzer-api/.env") });
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
}

const BATCH_SIZE = Math.max(1, Number(process.env.TECHPARK_ENRICH_BATCH_SIZE || 10));
const REQUEST_DELAY_MS = Math.max(0, Number(process.env.TECHPARK_ENRICH_DELAY_MS || 300));
const MAX_RECORDS = Math.max(1, Number(process.env.TECHPARK_ENRICH_LIMIT || 500));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const hasText = (value: string | null | undefined) => Boolean(String(value || "").trim());

async function main() {
  console.log("--- TECH PARK MISSING DETAILS BACKFILL ---");
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Delay per record: ${REQUEST_DELAY_MS}ms`);
  console.log(`Max records: ${MAX_RECORDS}`);

  await prismaInstance.$connect();

  const techParks = await prismaInstance.newTechPark.findMany({
    where: {
      is_active: true,
      OR: [
        { website: null },
        { website: "" },
        { generic_email: null },
        { generic_email: "" },
        { contact_page_url: null },
        { contact_page_url: "" },
        { reception_phone: null },
        { reception_phone: "" },
        { map_url: null },
        { map_url: "" },
        { builder_name: null },
        { builder_name: "" },
        { property_manager_name: null },
        { property_manager_name: "" },
        { property_manager_phone: null },
        { property_manager_phone: "" },
        { property_manager_email: null },
        { property_manager_email: "" },
        { spoc_name: null },
        { spoc_name: "" },
        { spoc_phone: null },
        { spoc_phone: "" },
        { photo_url: null },
        { photo_url: "" },
      ],
    },
    select: {
      id: true,
      place_id: true,
      name: true,
      address_line1: true,
      locality: true,
      city: true,
      state: true,
      website: true,
      contact_page_url: true,
      generic_email: true,
      reception_phone: true,
      map_url: true,
      builder_name: true,
      property_manager_name: true,
      property_manager_phone: true,
      property_manager_email: true,
      spoc_name: true,
      spoc_phone: true,
      photo_url: true,
    },
    orderBy: { createdAt: "asc" },
    take: MAX_RECORDS,
  });

  console.log(`Found ${techParks.length} tech parks with missing website/details.`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < techParks.length; i += BATCH_SIZE) {
    const batch = techParks.slice(i, i + BATCH_SIZE);

    for (const park of batch) {
      if (!hasText(park.name)) {
        skipped++;
        console.log(`Skipped ${park.id}: missing name`);
        continue;
      }

      try {
        const result = await enrichTechParkWebsiteDetails({
          id: park.id,
          place_id: park.place_id,
          name: park.name!,
          address_line1: park.address_line1,
          locality: park.locality,
          city: park.city,
          state: park.state,
          website: park.website,
          contact_page_url: park.contact_page_url,
        });

        if (!result.success || !result.data) {
          skipped++;
          console.log(`Skipped ${park.name}: ${result.message}`);
        } else {
          updated++;
          console.log(`Updated ${park.name}`);
        }
      } catch (error) {
        failed++;
        console.error(
          `Failed ${park.name || park.id}:`,
          error instanceof Error ? error.message : String(error),
        );
      }

      if (REQUEST_DELAY_MS > 0) {
        await sleep(REQUEST_DELAY_MS);
      }
    }
  }

  console.log("");
  console.log("Backfill complete");
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
}

main()
  .catch((error) => {
    console.error(
      "Tech park details backfill failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismaInstance.$disconnect();
  });
