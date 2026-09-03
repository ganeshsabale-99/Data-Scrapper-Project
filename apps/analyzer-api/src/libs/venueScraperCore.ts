import { logOperationalEvent } from "./serviceHealthLogger";
import { fetchGooglePlaces, GooglePlacesRequestError } from "./googlePlacesClient";
import { normalizeStateName } from "../utils/indiaStates";
import {
  buildDedupeKey,
  isClosedBusinessStatus,
  isPlaceholderVenue,
  logToReviewQueue,
  parkingScoreToPriority,
  resolveVenueCity,
} from "../utils/venueDataQuality";

const API_KEY = process.env.GOOGLE_API_KEY!;

const CITIES_WITH_LOCALITIES = [
  { city: "Bengaluru", state: "Karnataka", localities: ["Koramangala", "Whitefield", "HSR Layout", "Indiranagar", "Electronic City"] },
  { city: "Mumbai", state: "Maharashtra", localities: ["Andheri", "BKC", "Lower Parel", "Powai", "Goregaon"] },
  { city: "Hyderabad", state: "Telangana", localities: ["Hitech City", "Banjara Hills", "Jubilee Hills", "Gachibowli"] },
  { city: "Pune", state: "Maharashtra", localities: ["Koregaon Park", "Baner", "Kharadi", "Hinjewadi"] },
  { city: "Delhi", state: "Delhi", localities: ["Connaught Place", "Nehru Place", "Okhla", "Saket"] },
  { city: "Gurugram", state: "Haryana", localities: ["Cyber City", "Sector 44", "Golf Course Road", "MG Road"] },
  { city: "Noida", state: "Uttar Pradesh", localities: ["Sector 62", "Sector 18", "Sector 63", "Sector 132"] },
  { city: "Chennai", state: "Tamil Nadu", localities: ["Nungambakkam", "Perungudi", "OMR", "T Nagar"] },
  { city: "Ahmedabad", state: "Gujarat", localities: ["SG Road", "Prahlad Nagar", "CG Road", "Navrangpura"] },
  { city: "Kolkata", state: "West Bengal", localities: ["Salt Lake", "Park Street", "Rajarhat", "New Town"] },
  { city: "Kochi", state: "Kerala", localities: ["Kakkanad", "Edapally", "MG Road"] },
  { city: "Chandigarh", state: "Chandigarh", localities: ["Sector 17", "Sector 34", "IT Park Chandigarh"] },
  { city: "Coimbatore", state: "Tamil Nadu", localities: ["Gandhipuram", "RS Puram", "Peelamedu"] },
  { city: "Visakhapatnam", state: "Andhra Pradesh", localities: ["Gajuwaka", "Madhurawada", "Yendada"] },
  { city: "Thiruvananthapuram", state: "Kerala", localities: ["Technopark", "Vazhuthacaud", "Pattom"] },
  { city: "Jaipur", state: "Rajasthan", localities: ["Malviya Nagar", "Vaishali Nagar", "C-Scheme"] },
  { city: "Bhubaneswar", state: "Odisha", localities: ["Saheed Nagar", "Jaydev Vihar", "Nayapalli"] },
  { city: "Nagpur", state: "Maharashtra", localities: ["Dharampeth", "Sitabuldi", "Wardha Road"] },
  { city: "Lucknow", state: "Uttar Pradesh", localities: ["Hazratganj", "Gomti Nagar", "Vibhuti Khand"] },
  { city: "Indore", state: "Madhya Pradesh", localities: ["Vijay Nagar", "Palasia", "South Tukoganj"] },
  { city: "Mysuru", state: "Karnataka", localities: ["Vijayanagar", "Kuvempunagar", "Hebbal"] },
  { city: "Navi Mumbai", state: "Maharashtra", localities: ["Vashi", "Belapur", "Kharghar", "Turbhe"] },
  { city: "Thane", state: "Maharashtra", localities: ["Wagle Estate", "Ghodbunder Road", "Majiwada"] },
  { city: "Surat", state: "Gujarat", localities: ["Ring Road", "Vesu", "Adajan"] },
  { city: "Vadodara", state: "Gujarat", localities: ["Alkapuri", "Fatehgunj", "Karelibaug"] },
];

const PARKING_COMPLAINT_KEYWORDS = [
  "no parking",
  "parking problem",
  "parking full",
  "towing",
  "congestion",
  "paid parking only",
  "nowhere to park",
];

export interface VenueSearchOptions {
  testMode?: boolean;
  cityFilter?: string;
}

export interface VenueUpsertData {
  placeId: string;
  name: string;
  address: string | null;
  locality: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  mapUrl: string | null;
  website: string | null;
  phone: string | null;
  intlPhone: string | null;
  rating: number | null;
  totalRatings: number | null;
  types: string[];
  businessStatus: string | null;
  photoRef: string | null;
  parkingScore: "HIGH" | "MEDIUM" | "LOW";
  parkingPriority: number;
  dedupeKey: string | null;
  doNotCall: boolean;
}

export interface VenueScraperConfig {
  logPrefix: string;
  keywords: string[];
  isLikelyVenue: (types: string[], name: string) => boolean;
  upsertVenue: (data: VenueUpsertData, searchCity: string, searchState: string) => Promise<void>;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function scoreParkingOpportunity(reviews: Array<{ text: string }>): "HIGH" | "MEDIUM" | "LOW" {
  if (!reviews || reviews.length === 0) return "LOW";
  const combinedText = reviews.map((r) => r.text).join(" ").toLowerCase();
  const complaintCount = PARKING_COMPLAINT_KEYWORDS.filter((kw) => combinedText.includes(kw)).length;
  if (complaintCount >= 3) return "HIGH";
  if (complaintCount >= 1) return "MEDIUM";
  return "LOW";
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
    } else if (component.types.includes("administrative_area_level_3") && !district) {
      district = component.long_name;
    } else if (component.types.includes("administrative_area_level_2") && !district) {
      district = component.long_name;
    } else if (component.types.includes("sublocality_level_1") && !locality) {
      locality = component.long_name;
    } else if (component.types.includes("locality") && !locality) {
      locality = component.long_name;
    }
  }

  return { locality, district, state, pincode, country, countryCode };
}

async function fetchAllPlacesForQuery(query: string): Promise<any[]> {
  const results: any[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = { key: API_KEY, query };
    if (pageToken) params.pagetoken = pageToken;

    const data = await fetchGooglePlaces(
      "https://maps.googleapis.com/maps/api/place/textsearch/json",
      params,
    );

    if (data.results) results.push(...data.results);
    pageToken = data.next_page_token;
    // Google requires ~2 s before next_page_token becomes valid
    if (pageToken) await sleep(2000);
  } while (pageToken);

  return results;
}

export interface VenueScraperResult {
  totalFound: number;
  saved: number;
  skipped: number;
  failed: number;
}

export async function runVenueScraper(
  config: VenueScraperConfig,
  options: VenueSearchOptions,
): Promise<VenueScraperResult> {
  const { testMode = false, cityFilter } = options;
  const { logPrefix, keywords, isLikelyVenue, upsertVenue } = config;

  const citiesToSearch = testMode
    ? [{ city: "Bengaluru", state: "Karnataka", localities: ["Koramangala"] }]
    : cityFilter
    ? CITIES_WITH_LOCALITIES.filter((c) => c.city.toLowerCase() === cityFilter.toLowerCase())
    : CITIES_WITH_LOCALITIES;

  if (citiesToSearch.length === 0) {
    console.error(`No matching city found for filter: "${cityFilter}"`);
    return { totalFound: 0, saved: 0, skipped: 0, failed: 0 };
  }

  const allPlacesMap = new Map<string, { place: any; searchCity: string; searchState: string }>();

  logOperationalEvent(`${logPrefix}.search.started`, {
    scope: testMode ? "test" : cityFilter ? "single_city" : "india",
    cities: citiesToSearch.length,
  });

  for (const cityDef of citiesToSearch) {
    const { city, state, localities } = cityDef;
    console.log(`\n[${city}, ${state}] Starting search...`);
    const cityPlacesMap = new Map<string, any>();

    for (const locality of localities) {
      for (const keyword of keywords) {
        const query = `${keyword} in ${locality}, ${city}`;
        try {
          const places = await fetchAllPlacesForQuery(query);
          for (const place of places) {
            if (!cityPlacesMap.has(place.place_id)) {
              cityPlacesMap.set(place.place_id, place);
            }
          }
        } catch (error) {
          // A non-retryable Google error (bad key, malformed request) fails
          // identically for every remaining query in this scrape — abort now
          // instead of burning through hundreds of doomed requests.
          if (error instanceof GooglePlacesRequestError) throw error;
          console.error(`Error searching "${query}":`, error);
        }
        await sleep(300);
      }
    }

    if (!testMode) {
      for (const keyword of keywords) {
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
    }

    console.log(`  [${city}] Found ${cityPlacesMap.size} unique results`);
    logOperationalEvent(`${logPrefix}.city.found`, { city, state, count: cityPlacesMap.size });

    cityPlacesMap.forEach((place, placeId) => {
      if (!allPlacesMap.has(placeId)) {
        allPlacesMap.set(placeId, { place, searchCity: city, searchState: state });
      }
    });
  }

  if (!testMode && !cityFilter) {
    for (const keyword of keywords) {
      const query = `${keyword} in India`;
      try {
        const places = await fetchAllPlacesForQuery(query);
        for (const place of places) {
          if (!allPlacesMap.has(place.place_id)) {
            allPlacesMap.set(place.place_id, { place, searchCity: "", searchState: "" });
          }
        }
      } catch (error) {
        if (error instanceof GooglePlacesRequestError) throw error;
        console.error(`Error in national pass "${query}":`, error);
      }
      await sleep(300);
    }
  }

  logOperationalEvent(`${logPrefix}.search.deduped`, { total: allPlacesMap.size });
  console.log(`\nTotal unique places: ${allPlacesMap.size}`);
  console.log("Fetching place details and saving to database...\n");

  let saved = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;

  for (const [placeId, { place: _place, searchCity, searchState }] of allPlacesMap) {
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
        continue;
      }

      const types: string[] = details.types ?? [];
      if (!isLikelyVenue(types, details.name ?? "")) {
        skipped++;
        continue;
      }

      const addrComponents = extractAddressComponents(details.address_components ?? []);
      if (addrComponents.countryCode && addrComponents.countryCode !== "IN") {
        // Text search has no hard India restriction, so a same-name match
        // abroad (e.g. a locality named "Salt Lake" matching Salt Lake City,
        // Utah) can slip through and get tagged with the wrong city/state.
        skipped++;
        continue;
      }

      const lat: number | null = details.geometry?.location?.lat ?? null;
      const lng: number | null = details.geometry?.location?.lng ?? null;
      const address: string | null = details.formatted_address ?? null;

      // A test/placeholder Place ID, or a record missing Lat, Lng, AND Address
      // together, is not a real Google Places result — never write it.
      if (isPlaceholderVenue({ placeId, lat, lng, address })) {
        skipped++;
        continue;
      }

      const apiCity = addrComponents.locality || searchCity || addrComponents.district || null;
      const { city: resolvedCity, source: citySource } = resolveVenueCity(apiCity, address);
      if (!resolvedCity) {
        await logToReviewQueue(logPrefix, placeId, details.name, "missing_city", {
          address,
          searchCity,
          searchState,
          addrComponents,
        });
        skipped++;
        continue;
      }
      if (citySource === "address_fallback") {
        logOperationalEvent(`${logPrefix}.city.address_fallback`, { placeId, city: resolvedCity });
      }

      const reviews: Array<{ text: string }> = details.reviews ?? [];
      const parkingScore = scoreParkingOpportunity(reviews);
      const photoRef: string | null = details.photos?.[0]?.photo_reference ?? null;
      const businessStatus: string | null = details.business_status ?? null;

      const data: VenueUpsertData = {
        placeId,
        name: details.name,
        address,
        locality: addrComponents.locality || null,
        district: addrComponents.district || null,
        city: resolvedCity,
        state: normalizeStateName(addrComponents.state) || searchState || null,
        pincode: addrComponents.pincode || null,
        country: addrComponents.country || null,
        lat,
        lng,
        mapUrl: details.url ?? null,
        website: details.website ?? null,
        phone: details.formatted_phone_number ?? null,
        intlPhone: details.international_phone_number ?? null,
        rating: details.rating ?? null,
        totalRatings: details.user_ratings_total ?? null,
        types,
        businessStatus,
        photoRef,
        parkingScore,
        parkingPriority: parkingScoreToPriority(parkingScore),
        dedupeKey: buildDedupeKey(details.name, resolvedCity),
        doNotCall: isClosedBusinessStatus(businessStatus),
      };

      await upsertVenue(data, searchCity, addrComponents.state || searchState);
      saved++;
    } catch (error) {
      // Same reasoning as the search phase: a non-retryable Google error will
      // fail identically for every remaining place — abort instead of grinding
      // through the whole list logging the same failure hundreds of times.
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

  logOperationalEvent(`${logPrefix}.search.completed`, {
    total: allPlacesMap.size,
    saved,
    skipped,
    failed,
  });

  console.log(`\n=== ${logPrefix} scrape complete ===`);
  console.log(`  Total unique: ${allPlacesMap.size}`);
  console.log(`  Saved:        ${saved}`);
  console.log(`  Skipped:      ${skipped}`);
  console.log(`  Failed:       ${failed}`);

  return { totalFound: allPlacesMap.size, saved, skipped, failed };
}
