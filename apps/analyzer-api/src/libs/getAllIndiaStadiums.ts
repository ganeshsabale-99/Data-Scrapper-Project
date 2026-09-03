import crypto from "crypto";
import { prismaInstance } from "@repo/db";
import { runVenueScraper, VenueScraperConfig, VenueScraperResult, VenueSearchOptions, VenueUpsertData } from "./venueScraperCore";
import { flagPossibleDuplicatesByKey } from "../utils/venueDataQuality";

export type StadiumSearchOptions = VenueSearchOptions;

const STADIUM_KEYWORDS = [
  "stadium",
  "cricket stadium",
  "football stadium",
  "sports complex",
  "sports arena",
  "convention centre",
  "auditorium",
  "indoor stadium",
];

function isLikelyStadium(_types: string[], name: string): boolean {
  const nameLower = name.toLowerCase();
  return (
    nameLower.includes("stadium") ||
    nameLower.includes("arena") ||
    nameLower.includes("ground") ||
    nameLower.includes("auditorium") ||
    nameLower.includes("convention") ||
    nameLower.includes("sports complex")
  );
}

function generateStadiumId(placeId: string): string {
  return "st" + crypto.createHash("sha256").update(placeId).digest("hex").slice(0, 22);
}

const stadiumConfig: VenueScraperConfig = {
  logPrefix: "stadium",
  keywords: STADIUM_KEYWORDS,
  isLikelyVenue: isLikelyStadium,
  upsertVenue: async (data: VenueUpsertData, searchCity: string, searchState: string) => {
    const id = generateStadiumId(data.placeId);
    const now = new Date();
    await prismaInstance.stadium.upsert({
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
        parking_priority: data.parkingPriority,
        dedupe_key: data.dedupeKey,
        do_not_call: data.doNotCall,
        review_issue_score: data.reviewIssueScore,
        review_priority: data.reviewPriority,
        review_issue_categories: data.reviewIssueCategories,
        review_issue_summary: data.reviewIssueSummary,
        review_evidence: data.reviewEvidence,
        reviews_analyzed: data.reviewsAnalyzed,
        issue_review_count: data.issueReviewCount,
        parking_review_count: data.parkingReviewCount,
        review_analyzed_at: now,
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
        parking_priority: data.parkingPriority,
        dedupe_key: data.dedupeKey,
        do_not_call: data.doNotCall,
        review_issue_score: data.reviewIssueScore,
        review_priority: data.reviewPriority,
        review_issue_categories: data.reviewIssueCategories,
        review_issue_summary: data.reviewIssueSummary,
        review_evidence: data.reviewEvidence,
        reviews_analyzed: data.reviewsAnalyzed,
        issue_review_count: data.issueReviewCount,
        parking_review_count: data.parkingReviewCount,
        review_analyzed_at: now,
        first_seen_at: now,
        last_seen_at: now,
      },
    });
    await flagPossibleDuplicatesByKey(prismaInstance.stadium, data.dedupeKey);
  },
};

export async function getAllIndiaStadiums(options: StadiumSearchOptions = {}): Promise<VenueScraperResult> {
  return runVenueScraper(stadiumConfig, options);
}
