import crypto from "crypto";
import { prismaInstance } from "@repo/db";
import { logOperationalEvent } from "./serviceHealthLogger";
import { normalizeStateName } from "../utils/indiaStates";
import { fetchGooglePlaces, GooglePlacesRequestError } from "./googlePlacesClient";
import {
  buildDedupeKey,
  extractCityFromAddress,
  flagPossibleDuplicatesByKey,
  isClosedBusinessStatus,
  isPlaceholderVenue,
  logToReviewQueue,
  resolveVenueCity,
} from "../utils/venueDataQuality";
import { scoreReviewIssues } from "../utils/reviewIssuePriority";

const API_KEY = process.env.GOOGLE_API_KEY!;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const TECH_PARK_KEYWORDS = [
  "tech park",
  "IT park",
  "SEZ",
  "software park",
  "business park",
  "IT hub",
  "technology park",
  "IT campus",
  "cyber park",
  "info park",
  "ITPL",
  "tech city",
  // Broadened so text search surfaces well-known campuses branded without
  // the literal "tech park" phrase, e.g. Technopark or DLF Cyber City.
  "technopark",
  "cyber city",
  "corporate park",
  "knowledge park",
  "IT SEZ",
  "software campus",
];

const CITIES_TO_SEARCH = [
  { city: "Bengaluru", state: "Karnataka" },
  { city: "Mumbai", state: "Maharashtra" },
  { city: "Hyderabad", state: "Telangana" },
  { city: "Pune", state: "Maharashtra" },
  { city: "Delhi", state: "Delhi" },
  { city: "Gurugram", state: "Haryana" },
  { city: "Noida", state: "Uttar Pradesh" },
  { city: "Chennai", state: "Tamil Nadu" },
  { city: "Ahmedabad", state: "Gujarat" },
  { city: "Kolkata", state: "West Bengal" },
  { city: "Kochi", state: "Kerala" },
  { city: "Chandigarh", state: "Chandigarh" },
  { city: "Coimbatore", state: "Tamil Nadu" },
  { city: "Visakhapatnam", state: "Andhra Pradesh" },
  { city: "Thiruvananthapuram", state: "Kerala" },
  { city: "Jaipur", state: "Rajasthan" },
  { city: "Bhubaneswar", state: "Odisha" },
  { city: "Nagpur", state: "Maharashtra" },
  { city: "Lucknow", state: "Uttar Pradesh" },
  { city: "Indore", state: "Madhya Pradesh" },
  { city: "Mysuru", state: "Karnataka" },
  { city: "Navi Mumbai", state: "Maharashtra" },
  { city: "Thane", state: "Maharashtra" },
  { city: "Surat", state: "Gujarat" },
  { city: "Vadodara", state: "Gujarat" },
];

const NON_TECHPARK_TYPES = new Set([
  "restaurant", "food", "gym", "hospital", "school", "lodging", "hotel",
  "bar", "cafe", "shopping_mall", "grocery_or_supermarket", "supermarket",
  "park", "stadium", "amusement_park",
]);

// Real Indian office/IT campuses are branded in ways that rarely contain a
// literal "tech park" / "IT park" phrase (e.g. "Technopark", "DLF Cyber
// City", "RMZ Ecoworld", "Embassy TechVillage", "Salarpuria Sattva
// Knowledge City") — the original TECH_TERMS-only allowlist silently
// dropped most flagship campuses in the country. This list is broadened
// with the common branding vocabulary those campuses actually use.
const TECHPARK_NAME_TERMS = [
  "tech park", "techpark", "technopark", "it park", "itpark",
  "software park", "business park", "technology park", "cyber park",
  "cybercity", "cyber city", "cyber towers", "cyber hub", "info park",
  "infopark", "it hub", "it campus", "sez", "special economic zone",
  "knowledge park", "knowledge city", "innovation hub", "it city",
  "tech city", "techvillage", "tech village", "ecoworld", "corporate park",
  "corporate towers", "business district", "business hub",
  "world trade center", "world trade centre", "infotech park", "commerz",
  "biz park", "office park", "it economic zone",
];

// Names that signal a place is clearly not an office/tech campus even
// though it matched a tech-park search query — a text search for
// "IT hub" or "business park" can still surface an unrelated small business.
const TECHPARK_NEGATIVE_NAME_TERMS = [
  "apartment", "residency", "residence", "flats", "housing society",
  "hostel", "paying guest",
  "temple", "church", "mosque", "gurudwara",
  "school", "college", "university", "coaching",
  "hospital", "clinic", "diagnostic", "pharmacy",
  "hotel", "resort", "guest house", "restaurant", "dhaba",
  "cinema", "multiplex",
  "petrol pump", "fuel station", "gas station",
  "bus stand", "bus depot", "railway station", "metro station",
  "police station", "post office",
  "cyber cafe", "internet cafe", "mobile repair", "computer repair",
];

export interface TechParkSearchOptions {
  testMode?: boolean;
  cityFilter?: string;
}

function isLikelyTechPark(types: string[], name: string): boolean {
  if (types.some((t) => NON_TECHPARK_TYPES.has(t))) return false;
  const nameLower = name.toLowerCase();
  if (TECHPARK_NEGATIVE_NAME_TERMS.some((t) => nameLower.includes(t))) return false;
  return TECHPARK_NAME_TERMS.some((t) => nameLower.includes(t));
}

function extractAddressComponents(
  addressComponents: Array<{ long_name: string; short_name?: string; types: string[] }>,
): { locality: string; district: string; state: string; pincode: string; country: string; countryCode: string } {
  let locality = "";
  let district = "";
  let state = "";
  let pincode = "";
  let country = "";
  let countryCode = "";

  for (const component of addressComponents) {
    if (component.types.includes("postal_code")) {
      pincode = component.long_name;
    } else if (component.types.includes("country")) {
      country = component.long_name;
      countryCode = component.short_name ?? "";
    } else if (component.types.includes("administrative_area_level_1")) {
      state = component.long_name;
    } else if (component.types.includes("administrative_area_level_2") && !district) {
      district = component.long_name;
    } else if (component.types.includes("administrative_area_level_3") && !district) {
      district = component.long_name;
    } else if (component.types.includes("locality") && !locality) {
      locality = component.long_name;
    } else if (component.types.includes("sublocality_level_1") && !locality) {
      locality = component.long_name;
    }
  }

  return { locality, district, state, pincode, country, countryCode };
}

function generateTechParkId(placeId: string): string {
  return "tp" + crypto.createHash("sha256").update(placeId).digest("hex").slice(0, 22);
}

async function fetchAllPlacesForQuery(query: string): Promise<any[]> {
  const results: any[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = { key: API_KEY, query, language: "en", region: "in" };
    if (pageToken) params.pagetoken = pageToken;

    const data = await fetchGooglePlaces(
      "https://maps.googleapis.com/maps/api/place/textsearch/json",
      params,
    );

    if (data.results) results.push(...data.results);
    pageToken = data.next_page_token;
    // Google requires ~2 s before a next_page_token becomes valid
    if (pageToken) await sleep(2000);
  } while (pageToken);

  return results;
}

export async function getAllIndiaTechParks(options: TechParkSearchOptions = {}): Promise<void> {
  const { testMode = false, cityFilter } = options;

  const citiesToSearch = testMode
    ? [{ city: "Bengaluru", state: "Karnataka" }]
    : cityFilter
    ? CITIES_TO_SEARCH.filter((c) => c.city.toLowerCase() === cityFilter.toLowerCase())
    : CITIES_TO_SEARCH;

  if (cityFilter && citiesToSearch.length === 0) {
    console.error(`No matching city found for filter: "${cityFilter}"`);
    return;
  }

  const allPlacesMap = new Map<string, { place: any; searchCity: string; searchState: string }>();

  logOperationalEvent("techpark.search.started", {
    scope: testMode ? "test" : cityFilter ? "single_city" : "india",
    cities: citiesToSearch.length,
  });

  // City-level searches for better locality coverage
  for (const { city, state } of citiesToSearch) {
    console.log(`\n[${city}, ${state}] Searching...`);
    const cityPlacesMap = new Map<string, any>();

    for (const keyword of TECH_PARK_KEYWORDS) {
      const query = `${keyword} in ${city}, ${state}`;
      try {
        const places = await fetchAllPlacesForQuery(query);
        for (const place of places) {
          if (!cityPlacesMap.has(place.place_id)) {
            cityPlacesMap.set(place.place_id, place);
          }
        }
      } catch (error) {
        if (error instanceof GooglePlacesRequestError) throw error;
        console.error(`Error searching "${query}":`, error);
      }
      await sleep(300);
    }

    console.log(`  [${city}] Found ${cityPlacesMap.size} unique results`);
    logOperationalEvent("techpark.city.found", { city, state, count: cityPlacesMap.size });

    cityPlacesMap.forEach((place, placeId) => {
      if (!allPlacesMap.has(placeId)) {
        allPlacesMap.set(placeId, { place, searchCity: city, searchState: state });
      }
    });
  }

  // National keyword searches catch well-known parks missed at city level
  if (!testMode && !cityFilter) {
    console.log("\n[National] Running keyword searches...");
    for (const keyword of TECH_PARK_KEYWORDS) {
      const query = `${keyword} India`;
      try {
        const places = await fetchAllPlacesForQuery(query);
        for (const place of places) {
          if (!allPlacesMap.has(place.place_id)) {
            allPlacesMap.set(place.place_id, { place, searchCity: "", searchState: "" });
          }
        }
      } catch (error) {
        if (error instanceof GooglePlacesRequestError) throw error;
        console.error(`Error in national search for "${keyword}":`, error);
      }
      await sleep(300);
    }
  }

  logOperationalEvent("techpark.search.deduped", { total: allPlacesMap.size });
  console.log(`\nTotal unique places across all searches: ${allPlacesMap.size}`);
  console.log("Fetching place details and saving to database...\n");

  let saved = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;

  for (const [placeId, { place, searchCity, searchState }] of allPlacesMap) {
    processed++;
    try {
      const detailsData = await fetchGooglePlaces(
        "https://maps.googleapis.com/maps/api/place/details/json",
        {
            key: API_KEY,
            place_id: placeId,
            fields: [
              "name",
              "formatted_address",
              "geometry",
              "website",
              "formatted_phone_number",
              "international_phone_number",
              "opening_hours",
              "rating",
              "user_ratings_total",
              "types",
              "business_status",
              "url",
              "address_components",
              "photos",
              "reviews",
            ].join(","),
        },
      );

      const details = detailsData.result;
      if (!details) {
        skipped++;
        await sleep(300);
        continue;
      }

      const types: string[] = details.types ?? [];
      if (!isLikelyTechPark(types, details.name)) {
        skipped++;
        await sleep(300);
        continue;
      }

      const addr = extractAddressComponents(details.address_components ?? []);
      if (addr.countryCode && addr.countryCode !== "IN") {
        // Text search has no hard India restriction, so a same-name match
        // abroad (e.g. "Tech Park" in another country) can slip through.
        skipped++;
        await sleep(300);
        continue;
      }

      const lat: number | null = details.geometry?.location?.lat ?? null;
      const lng: number | null = details.geometry?.location?.lng ?? null;
      const address: string | null = details.formatted_address || null;

      // A test/placeholder Place ID, or a record missing Lat, Lng, AND Address
      // together, is not a real Google Places result — never write it.
      if (isPlaceholderVenue({ placeId, lat, lng, address })) {
        skipped++;
        await sleep(300);
        continue;
      }

      // Text Search is biased, not geographically restricted. Prefer the
      // returned address over the city that happened to find this result.
      const apiCity = extractCityFromAddress(address)
        || addr.locality
        || addr.district
        || searchCity
        || null;
      const { city: resolvedCity, source: citySource } = resolveVenueCity(apiCity, address);
      if (!resolvedCity) {
        await logToReviewQueue("techpark", placeId, details.name, "missing_city", {
          address,
          searchCity,
          searchState,
          addr,
        });
        skipped++;
        await sleep(300);
        continue;
      }
      if (citySource === "address_fallback") {
        logOperationalEvent("techpark.city.address_fallback", { placeId, city: resolvedCity });
      }

      const resolvedState = normalizeStateName(addr.state) || searchState || null;
      const businessStatus: string | null = details.business_status || null;
      const dedupeKey = buildDedupeKey(details.name, resolvedCity);
      const doNotCall = isClosedBusinessStatus(businessStatus);
      const reviewIssues = scoreReviewIssues(details.reviews ?? []);
      const now = new Date();

      await prismaInstance.newTechPark.upsert({
        where: { place_id: placeId },
        update: {
          name: details.name,
          address_line1: address,
          locality: addr.locality || null,
          district: addr.district || null,
          city: resolvedCity,
          state: resolvedState,
          pincode: addr.pincode || null,
          country: addr.country || "India",
          lat,
          lng,
          map_url: details.url || null,
          website: details.website || null,
          reception_phone: details.formatted_phone_number || null,
          international_phone: details.international_phone_number || null,
          rating: details.rating ?? null,
          total_ratings: details.user_ratings_total ?? null,
          types,
          business_status: businessStatus,
          photo_url: details.photos?.[0]?.photo_reference || null,
          dedupe_key: dedupeKey,
          do_not_call: doNotCall,
          review_issue_score: reviewIssues.score,
          review_priority: reviewIssues.priority,
          review_issue_categories: reviewIssues.categories,
          review_issue_summary: reviewIssues.summary,
          review_evidence: reviewIssues.evidence,
          reviews_analyzed: reviewIssues.reviewsAnalyzed,
          issue_review_count: reviewIssues.issueReviewCount,
          parking_review_count: reviewIssues.parkingReviewCount,
          review_analyzed_at: now,
          last_seen_at: now,
          // challenges, builder_name, and verification fields are intentionally
          // omitted here so manual values are not overwritten on re-scrape
        },
        create: {
          id: generateTechParkId(placeId),
          place_id: placeId,
          name: details.name,
          address_line1: address,
          locality: addr.locality || null,
          district: addr.district || null,
          city: resolvedCity,
          state: resolvedState,
          pincode: addr.pincode || null,
          country: addr.country || "India",
          lat,
          lng,
          map_url: details.url || null,
          website: details.website || null,
          reception_phone: details.formatted_phone_number || null,
          international_phone: details.international_phone_number || null,
          rating: details.rating ?? null,
          total_ratings: details.user_ratings_total ?? null,
          types,
          business_status: businessStatus,
          photo_url: details.photos?.[0]?.photo_reference || null,
          dedupe_key: dedupeKey,
          do_not_call: doNotCall,
          review_issue_score: reviewIssues.score,
          review_priority: reviewIssues.priority,
          review_issue_categories: reviewIssues.categories,
          review_issue_summary: reviewIssues.summary,
          review_evidence: reviewIssues.evidence,
          reviews_analyzed: reviewIssues.reviewsAnalyzed,
          issue_review_count: reviewIssues.issueReviewCount,
          parking_review_count: reviewIssues.parkingReviewCount,
          review_analyzed_at: now,
          is_active: true,
          isVerified: false,
          exterior_media_urls: [],
          first_seen_at: now,
          last_seen_at: now,
        },
      });
      await flagPossibleDuplicatesByKey(prismaInstance.newTechPark, dedupeKey);

      saved++;
    } catch (error) {
      if (error instanceof GooglePlacesRequestError) throw error;
      failed++;
      console.error(`Failed to process place ${placeId}:`, error);
    }

    if (processed % 20 === 0) {
      console.log(
        `  Progress: ${processed}/${allPlacesMap.size} — saved: ${saved}, skipped: ${skipped}, failed: ${failed}`,
      );
    }

    await sleep(300);
  }

  logOperationalEvent("techpark.search.completed", {
    total: allPlacesMap.size,
    saved,
    skipped,
    failed,
  });

  console.log("\n=== Tech parks scrape complete ===");
  console.log(`  Total unique: ${allPlacesMap.size}`);
  console.log(`  Saved:        ${saved}`);
  console.log(`  Skipped:      ${skipped}`);
  console.log(`  Failed:       ${failed}`);
}
