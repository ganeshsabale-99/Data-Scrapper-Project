/**
 * One-time cleanup for the data-quality gaps found in the 10,596-row export
 * audit (missing City, test/placeholder rows, unflagged duplicates, unflagged
 * closed listings). The scraper/export pipeline now prevents these going
 * forward (see venueDataQuality.ts, venueScraperCore.ts, exportController.ts)
 * — this script fixes what's already in the DB.
 *
 * Usage: pnpm --filter analyzer-api exec tsx scripts/backfillDataQuality.ts
 */
import dotenv from "dotenv";
import path from "path";
import { prismaInstance } from "@repo/db";
import {
  buildDedupeKey,
  extractCityFromAddress,
  isClosedBusinessStatus,
  isPlaceholderVenue,
  logToReviewQueue,
} from "../src/utils/venueDataQuality";

dotenv.config();
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
}
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
}

interface VenueBackfillConfig {
  key: string;
  model: any;
  addressField: "address" | "address_line1";
  hasBusinessStatus: boolean;
  // CoworkingSpace.city is a non-nullable String column, unlike the other 5
  // venue models where city is optional — `{ city: null }` is a type error
  // against a required field, so it can only ever be blank, never null.
  cityIsNullable: boolean;
  // CoworkingSpace has no place_id column at all (it's keyed by a hash-based
  // id, not tied to a Google Place ID like the other 5 venue models).
  hasPlaceId: boolean;
}

const VENUES: VenueBackfillConfig[] = [
  { key: "techpark", model: prismaInstance.newTechPark, addressField: "address_line1", hasBusinessStatus: true, cityIsNullable: true, hasPlaceId: true },
  { key: "coworking", model: prismaInstance.coworkingSpace, addressField: "address", hasBusinessStatus: true, cityIsNullable: false, hasPlaceId: false },
  { key: "mall", model: prismaInstance.mall, addressField: "address", hasBusinessStatus: true, cityIsNullable: true, hasPlaceId: true },
  { key: "hospital", model: prismaInstance.hospital, addressField: "address", hasBusinessStatus: true, cityIsNullable: true, hasPlaceId: true },
  { key: "stadium", model: prismaInstance.stadium, addressField: "address", hasBusinessStatus: true, cityIsNullable: true, hasPlaceId: true },
  { key: "airport", model: prismaInstance.airport, addressField: "address", hasBusinessStatus: true, cityIsNullable: true, hasPlaceId: true },
];

async function backfillMissingCity(cfg: VenueBackfillConfig) {
  const rows = await cfg.model.findMany({
    where: cfg.cityIsNullable ? { OR: [{ city: null }, { city: "" }] } : { city: "" },
    select: { id: true, ...(cfg.hasPlaceId ? { place_id: true } : {}), name: true, [cfg.addressField]: true },
  });

  let resolved = 0;
  let queued = 0;
  for (const row of rows) {
    const address: string | null = row[cfg.addressField] ?? null;
    const city = extractCityFromAddress(address);
    if (city) {
      await cfg.model.update({ where: { id: row.id }, data: { city } });
      resolved++;
    } else {
      await logToReviewQueue(cfg.key, row.place_id ?? null, row.name ?? null, "missing_city", {
        address,
        backfill: true,
      });
      queued++;
    }
  }
  console.log(`  [${cfg.key}] city backfill: ${rows.length} candidates, ${resolved} resolved from address, ${queued} sent to review queue`);
}

async function deactivatePlaceholders(cfg: VenueBackfillConfig) {
  const rows = await cfg.model.findMany({
    where: { is_active: true },
    select: { id: true, ...(cfg.hasPlaceId ? { place_id: true } : {}), lat: true, lng: true, [cfg.addressField]: true },
  });

  let deactivated = 0;
  for (const row of rows) {
    const address: string | null = row[cfg.addressField] ?? null;
    if (isPlaceholderVenue({ placeId: row.place_id ?? null, lat: row.lat, lng: row.lng, address })) {
      await cfg.model.update({
        where: { id: row.id },
        data: { is_active: false, notes_internal: "Deactivated by backfillDataQuality: test/placeholder record (no real location data)." },
      });
      deactivated++;
    }
  }
  if (deactivated > 0) console.log(`  [${cfg.key}] deactivated ${deactivated} test/placeholder record(s)`);
}

async function flagClosedListings(cfg: VenueBackfillConfig) {
  if (!cfg.hasBusinessStatus) return;
  const rows = await cfg.model.findMany({
    where: { do_not_call: false },
    select: { id: true, business_status: true },
  });

  const closedIds = rows.filter((r: any) => isClosedBusinessStatus(r.business_status)).map((r: any) => r.id);
  if (closedIds.length === 0) return;
  await cfg.model.updateMany({ where: { id: { in: closedIds } }, data: { do_not_call: true } });
  console.log(`  [${cfg.key}] flagged ${closedIds.length} closed listing(s) as do_not_call`);
}

async function flagDuplicates(cfg: VenueBackfillConfig) {
  const rows = await cfg.model.findMany({ select: { id: true, name: true, city: true } });

  const keyToIds = new Map<string, string[]>();
  for (const row of rows) {
    const key = buildDedupeKey(row.name, row.city);
    if (!key) continue;
    const ids = keyToIds.get(key) ?? [];
    ids.push(row.id);
    keyToIds.set(key, ids);
  }

  let updated = 0;
  for (const [key, ids] of keyToIds) {
    await cfg.model.updateMany({ where: { id: { in: ids } }, data: { dedupe_key: key } });
    if (ids.length > 1) {
      await cfg.model.updateMany({ where: { id: { in: ids } }, data: { is_possible_duplicate: true } });
      updated += ids.length;
    }
  }
  if (updated > 0) console.log(`  [${cfg.key}] flagged ${updated} row(s) across ${[...keyToIds.values()].filter((v) => v.length > 1).length} duplicate group(s)`);
}

async function main() {
  console.log("--- DATA QUALITY BACKFILL ---");
  await prismaInstance.$connect();

  for (const cfg of VENUES) {
    console.log(`\n[${cfg.key}]`);
    await backfillMissingCity(cfg);
    await deactivatePlaceholders(cfg);
    await flagClosedListings(cfg);
    await flagDuplicates(cfg);
  }

  console.log("\n--- DONE ---");
  await prismaInstance.$disconnect();
}

main().catch(async (error) => {
  console.error("Backfill failed:", error);
  await prismaInstance.$disconnect();
  process.exit(1);
});
