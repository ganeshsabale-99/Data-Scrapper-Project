import crypto from "crypto";
import { prismaInstance } from "@repo/db";
import { logOperationalEvent } from "./serviceHealthLogger";
import { normalizeStateName } from "../utils/indiaStates";
import axios from "axios";

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

export interface TechParkSearchOptions {
  testMode?: boolean;
  cityFilter?: string;
}

function isLikelyTechPark(types: string[], name: string): boolean {
  if (types.some((t) => NON_TECHPARK_TYPES.has(t))) return false;
  const nameLower = name.toLowerCase();
  const techTerms = [
    "tech park", "techpark", "it park", "itpark", "software park",
    "business park", "technology park", "cyber park", "info park",
    "it hub", "it campus", "sez", "special economic zone",
    "knowledge park", "innovation hub", "it city", "tech city",
  ];
  return techTerms.some((t) => nameLower.includes(t));
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

    const resp = await axios.get(
      "https://maps.googleapis.com/maps/api/place/textsearch/json",
      { params },
    );

    if (resp.data.results) results.push(...resp.data.results);
    pageToken = resp.data.next_page_token;
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
  if (!testMode) {
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
      const detailsResp = await axios.get(
        "https://maps.googleapis.com/maps/api/place/details/json",
        {
          params: {
            key: API_KEY,
            place_id: placeId,
            language: "en",
            region: "in",
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
            ].join(","),
          },
        },
      );

      const details = detailsResp.data.result;
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
      const resolvedCity = addr.locality || searchCity || addr.district || null;
      const resolvedState = normalizeStateName(addr.state) || searchState || null;
      const now = new Date();

      await prismaInstance.newTechPark.upsert({
        where: { place_id: placeId },
        update: {
          name: details.name,
          address_line1: details.formatted_address || null,
          locality: addr.locality || null,
          district: addr.district || null,
          city: resolvedCity,
          state: resolvedState,
          pincode: addr.pincode || null,
          country: addr.country || "India",
          lat: details.geometry?.location.lat ?? null,
          lng: details.geometry?.location.lng ?? null,
          map_url: details.url || null,
          website: details.website || null,
          reception_phone: details.formatted_phone_number || null,
          international_phone: details.international_phone_number || null,
          rating: details.rating ?? null,
          total_ratings: details.user_ratings_total ?? null,
          types,
          business_status: details.business_status || null,
          photo_url: details.photos?.[0]?.photo_reference || null,
          last_seen_at: now,
          // challenges, builder_name, and verification fields are intentionally
          // omitted here so manual values are not overwritten on re-scrape
        },
        create: {
          id: generateTechParkId(placeId),
          place_id: placeId,
          name: details.name,
          address_line1: details.formatted_address || null,
          locality: addr.locality || null,
          district: addr.district || null,
          city: resolvedCity,
          state: resolvedState,
          pincode: addr.pincode || null,
          country: addr.country || "India",
          lat: details.geometry?.location.lat ?? null,
          lng: details.geometry?.location.lng ?? null,
          map_url: details.url || null,
          website: details.website || null,
          reception_phone: details.formatted_phone_number || null,
          international_phone: details.international_phone_number || null,
          rating: details.rating ?? null,
          total_ratings: details.user_ratings_total ?? null,
          types,
          business_status: details.business_status || null,
          photo_url: details.photos?.[0]?.photo_reference || null,
          is_active: true,
          isVerified: false,
          exterior_media_urls: [],
          first_seen_at: now,
          last_seen_at: now,
        },
      });

      saved++;
    } catch (error) {
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
