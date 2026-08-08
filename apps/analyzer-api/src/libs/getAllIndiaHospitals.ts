import crypto from "crypto";
import { prismaInstance } from "@repo/db";
import { runVenueScraper, VenueScraperConfig, VenueScraperResult, VenueSearchOptions, VenueUpsertData } from "./venueScraperCore";

export type HospitalSearchOptions = VenueSearchOptions;

const HOSPITAL_KEYWORDS = [
  "hospital",
  "multi-specialty hospital",
  "medical college hospital",
  "super specialty hospital",
  "AIIMS",
  "Apollo hospital",
  "Fortis hospital",
  "Manipal hospital",
  "Max hospital",
  "Medanta",
];

function isLikelyHospital(_types: string[], name: string): boolean {
  const nameLower = name.toLowerCase();
  if (nameLower.includes("veterinary") || nameLower.includes("pet")) return false;
  return (
    nameLower.includes("hospital") ||
    nameLower.includes("medical") ||
    nameLower.includes("healthcare") ||
    nameLower.includes("health care") ||
    nameLower.includes("clinic")
  );
}

function generateHospitalId(placeId: string): string {
  return "hp" + crypto.createHash("sha256").update(placeId).digest("hex").slice(0, 22);
}

const hospitalConfig: VenueScraperConfig = {
  logPrefix: "hospital",
  keywords: HOSPITAL_KEYWORDS,
  isLikelyVenue: isLikelyHospital,
  upsertVenue: async (data: VenueUpsertData, searchCity: string, searchState: string) => {
    const id = generateHospitalId(data.placeId);
    const now = new Date();
    await prismaInstance.hospital.upsert({
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

export async function getAllIndiaHospitals(options: HospitalSearchOptions = {}): Promise<VenueScraperResult> {
  return runVenueScraper(hospitalConfig, options);
}
