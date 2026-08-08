import crypto from "crypto";
import { prismaInstance } from "@repo/db";
import { runVenueScraper, VenueScraperConfig, VenueScraperResult, VenueSearchOptions, VenueUpsertData } from "./venueScraperCore";

export type AirportSearchOptions = VenueSearchOptions;

const AIRPORT_KEYWORDS = [
  "international airport",
  "domestic airport",
  "airport terminal",
  "airport",
];

function isLikelyAirport(types: string[], name: string): boolean {
  const nameLower = name.toLowerCase();
  const hasAirportName = nameLower.includes("airport") || nameLower.includes("terminal");
  const hasAirportType = types.includes("airport");
  return hasAirportName && (hasAirportType || name.endsWith("Airport"));
}

function generateAirportId(placeId: string): string {
  return "ap" + crypto.createHash("sha256").update(placeId).digest("hex").slice(0, 22);
}

const airportConfig: VenueScraperConfig = {
  logPrefix: "airport",
  keywords: AIRPORT_KEYWORDS,
  isLikelyVenue: isLikelyAirport,
  upsertVenue: async (data: VenueUpsertData, searchCity: string, searchState: string) => {
    const id = generateAirportId(data.placeId);
    const now = new Date();
    await prismaInstance.airport.upsert({
      where: { place_id: data.placeId },
      update: {
        name: data.name,
        address: data.address,
        locality: data.locality,
        district: data.district,
        city: data.city || searchCity,
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
        city: data.city || searchCity,
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

export async function getAllIndiaAirports(options: AirportSearchOptions = {}): Promise<VenueScraperResult> {
  return runVenueScraper(airportConfig, options);
}
