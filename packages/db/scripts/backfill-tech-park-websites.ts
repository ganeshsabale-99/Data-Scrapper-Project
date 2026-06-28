#!/usr/bin/env tsx

import axios from "axios";
import { PrismaClient } from "@prisma/client";

type TechParkRow = {
  id: string;
  place_id: string | null;
  name: string | null;
  website: string | null;
};

const prisma = new PrismaClient({
  log: ["error", "warn"],
});

const GOOGLE_PLACE_DETAILS_URL =
  "https://maps.googleapis.com/maps/api/place/details/json";

const BATCH_SIZE = 25;
const REQUEST_DELAY_MS = 200;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeWebsite = (value: unknown): string | null => {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return parsed.toString();
  } catch {
    return null;
  }
};

const fetchWebsiteByPlaceId = async (
  placeId: string,
  apiKey: string,
): Promise<string | null> => {
  const response = await axios.get(GOOGLE_PLACE_DETAILS_URL, {
    params: {
      key: apiKey,
      place_id: placeId,
      fields: ["place_id", "website"].join(","),
    },
    timeout: 20000,
  });

  const result = response.data?.result;
  return normalizeWebsite(result?.website);
};

async function main() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is required to backfill tech park websites.");
  }

  await prisma.$connect();

  const techParks = await prisma.newTechPark.findMany({
    where: {
      is_active: true,
      OR: [{ website: null }, { website: "" }],
      NOT: [{ place_id: null }, { place_id: "" }],
    },
    select: {
      id: true,
      place_id: true,
      name: true,
      website: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${techParks.length} tech parks with missing website.`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < techParks.length; i += BATCH_SIZE) {
    const batch = techParks.slice(i, i + BATCH_SIZE);

    for (const park of batch as TechParkRow[]) {
      const placeId = String(park.place_id || "").trim();
      if (!placeId) {
        skipped++;
        continue;
      }

      try {
        const website = await fetchWebsiteByPlaceId(placeId, apiKey);
        if (!website) {
          skipped++;
          continue;
        }

        await prisma.newTechPark.update({
          where: { id: park.id },
          data: { website },
        });

        updated++;
        console.log(`Updated website for ${park.name || placeId}`);
      } catch (error) {
        failed++;
        console.error(
          `Failed to fetch website for ${park.name || placeId}:`,
          error instanceof Error ? error.message : String(error),
        );
      }

      await sleep(REQUEST_DELAY_MS);
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
      "Website backfill failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
