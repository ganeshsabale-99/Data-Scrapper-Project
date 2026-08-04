import crypto from "crypto";
import { prismaInstance } from "@repo/db";
import { runVenueScraper, VenueScraperConfig, VenueSearchOptions, VenueUpsertData } from "./venueScraperCore";

export type MallSearchOptions = VenueSearchOptions;

const MALL_KEYWORDS = [
  "shopping mall",
  "mall",
  "shopping centre",
  "retail complex",
  "shopping complex",
  "phoenix mall",
  "nexus mall",
  "dlf mall",
];

const NON_VENUE_TYPES = new Set([
  "restaurant",
  "food",
  "gym",
  "hospital",
  "school",
  "lodging",
  "hotel",
  "bar",
  "cafe",
  "grocery_or_supermarket",
  "supermarket",
]);

function isLikelyMall(types: string[], name: string): boolean {
  if (types.some((t) => NON_VENUE_TYPES.has(t))) return false;
  const nameLower = name.toLowerCase();
  return (
    nameLower.includes("mall") ||
    nameLower.includes("shopping") ||
    nameLower.includes("retail") ||
    nameLower.includes("nexus") ||
    nameLower.includes("phoenix") ||
    nameLower.includes("pacific") ||
    nameLower.includes("ambience")
  );
}

function generateMallId(placeId: string): string {
  return "ml" + crypto.createHash("sha256").update(placeId).digest("hex").slice(0, 22);
}

const mallConfig: VenueScraperConfig = {
  logPrefix: "mall",
  keywords: MALL_KEYWORDS,
  isLikelyVenue: isLikelyMall,
  upsertVenue: async (data: VenueUpsertData, searchCity: string, searchState: string) => {
    const id = generateMallId(data.placeId);
    const now = new Date();
    await prismaInstance.mall.upsert({
      where: { place_id: data.placeId },
      update: {
        name: data.name,
        address: data.address,
        locality: data.locality,
        district: data.district,
        city: searchCity || data.city,
        state: data.state || searchState,
        pincode: data.pincode,
        country: data.country,
        lat: data.lat,
        lng: data.lng,
        map_url: data.mapUrl,
        photo_url: data.photoRef,
        website: data.website,
        reception_phone: data.phone,
        international_phone: data.intlPhone,
        rating: data.rating,
        total_ratings: data.totalRatings,
        types: data.types,
        business_status: data.businessStatus,
        parking_score: data.parkingScore,
        last_seen_at: now,
      },
      create: {
        id,
        place_id: data.placeId,
        name: data.name,
        address: data.address,
        locality: data.locality,
        district: data.district,
        city: searchCity || data.city,
        state: data.state || searchState,
        pincode: data.pincode,
        country: data.country,
        lat: data.lat,
        lng: data.lng,
        map_url: data.mapUrl,
        photo_url: data.photoRef,
        website: data.website,
        reception_phone: data.phone,
        international_phone: data.intlPhone,
        rating: data.rating,
        total_ratings: data.totalRatings,
        types: data.types,
        business_status: data.businessStatus,
        parking_score: data.parkingScore,
        first_seen_at: now,
        last_seen_at: now,
      },
    });
  },
};

export async function getAllIndiaMalls(options: MallSearchOptions = {}): Promise<void> {
  await runVenueScraper(mallConfig, options);
}
