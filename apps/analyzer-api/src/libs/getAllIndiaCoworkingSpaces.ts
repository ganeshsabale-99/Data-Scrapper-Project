import crypto from "crypto";
import { prismaInstance } from "@repo/db";
import { logOperationalEvent } from "./serviceHealthLogger";
import { normalizeStateName } from "../utils/indiaStates";
import axios from "axios";

const API_KEY = process.env.GOOGLE_API_KEY!;

const COWORKING_KEYWORDS = [
  "coworking space",
  "co-working space",
  "shared office space",
  "flexible workspace",
  "managed office space",
  "WeWork",
  "Awfis",
  "BHIVE workspace",
  "Smartworks coworking",
  "Innov8 coworking",
  "Regus office",
  "91Springboard",
  "IndiQube",
  "CoWrks",
  "myHQ workspace",
  "iKeva",
  "Workafella",
  "Incuspaze",
  "AltF coworking",
];

const CITIES_WITH_LOCALITIES = [
  { city: "Bengaluru", state: "Karnataka", localities: ["Koramangala", "Whitefield", "HSR Layout", "Indiranagar", "Electronic City", "MG Road", "Marathahalli"] },
  { city: "Mumbai", state: "Maharashtra", localities: ["Andheri", "BKC", "Lower Parel", "Powai", "Goregaon", "Malad"] },
  { city: "Hyderabad", state: "Telangana", localities: ["Hitech City", "Banjara Hills", "Jubilee Hills", "Gachibowli", "Madhapur", "Kondapur"] },
  { city: "Pune", state: "Maharashtra", localities: ["Koregaon Park", "Baner", "Kharadi", "Hinjewadi", "Viman Nagar"] },
  { city: "Delhi", state: "Delhi", localities: ["Connaught Place", "Nehru Place", "Okhla", "Saket"] },
  { city: "Gurugram", state: "Haryana", localities: ["Cyber City", "Sector 44", "Golf Course Road", "MG Road", "Udyog Vihar"] },
  { city: "Noida", state: "Uttar Pradesh", localities: ["Sector 62", "Sector 18", "Sector 63", "Sector 132"] },
  { city: "Chennai", state: "Tamil Nadu", localities: ["Nungambakkam", "Perungudi", "OMR", "T Nagar", "Guindy"] },
  { city: "Ahmedabad", state: "Gujarat", localities: ["SG Road", "Prahlad Nagar", "CG Road", "Navrangpura"] },
  { city: "Kolkata", state: "West Bengal", localities: ["Salt Lake", "Park Street", "Rajarhat", "New Town"] },
  { city: "Jaipur", state: "Rajasthan", localities: ["Malviya Nagar", "Vaishali Nagar", "C-Scheme"] },
  { city: "Kochi", state: "Kerala", localities: ["Kakkanad", "Edapally", "MG Road"] },
  { city: "Chandigarh", state: "Chandigarh", localities: ["Sector 17", "Sector 34", "IT Park Chandigarh"] },
  { city: "Indore", state: "Madhya Pradesh", localities: ["Vijay Nagar", "Palasia", "South Tukoganj"] },
  { city: "Coimbatore", state: "Tamil Nadu", localities: ["Gandhipuram", "RS Puram", "Peelamedu"] },
  { city: "Nagpur", state: "Maharashtra", localities: ["Dharampeth", "Sitabuldi", "Wardha Road"] },
  { city: "Surat", state: "Gujarat", localities: ["Ring Road", "Vesu", "Adajan"] },
  { city: "Vadodara", state: "Gujarat", localities: ["Alkapuri", "Fatehgunj", "Karelibaug"] },
  { city: "Visakhapatnam", state: "Andhra Pradesh", localities: ["Gajuwaka", "Madhurawada", "Yendada"] },
  { city: "Bhubaneswar", state: "Odisha", localities: ["Saheed Nagar", "Jaydev Vihar", "Nayapalli"] },
  { city: "Lucknow", state: "Uttar Pradesh", localities: ["Hazratganj", "Gomti Nagar", "Vibhuti Khand"] },
  { city: "Mysuru", state: "Karnataka", localities: ["Vijayanagar", "Kuvempunagar", "Hebbal"] },
  { city: "Thiruvananthapuram", state: "Kerala", localities: ["Technopark", "Vazhuthacaud", "Pattom"] },
  { city: "Guwahati", state: "Assam", localities: ["GS Road", "Bhangagarh", "Rukminigaon"] },
  { city: "Dehradun", state: "Uttarakhand", localities: ["Rajpur Road", "Paltan Bazaar", "IT Park"] },
  { city: "Navi Mumbai", state: "Maharashtra", localities: ["Vashi", "Belapur", "Kharghar", "Turbhe"] },
  { city: "Thane", state: "Maharashtra", localities: ["Wagle Estate", "Ghodbunder Road", "Majiwada"] },
  { city: "Faridabad", state: "Haryana", localities: ["Sector 16", "Sector 21", "Neelam Bata Road"] },
  { city: "Ghaziabad", state: "Uttar Pradesh", localities: ["Indirapuram", "Vaishali", "Raj Nagar"] },
  { city: "Mangaluru", state: "Karnataka", localities: ["Deralakatte", "Kankanady", "Attavar"] },
  { city: "Nashik", state: "Maharashtra", localities: ["Gangapur Road", "Cidco", "Satpur"] },
  { city: "Rajkot", state: "Gujarat", localities: ["Kalawad Road", "Mavdi", "Metoda"] },
  { city: "Madurai", state: "Tamil Nadu", localities: ["Alagar Koil Road", "Bypass Road", "Anna Nagar"] },
  { city: "Patna", state: "Bihar", localities: ["Boring Road", "Fraser Road", "Bailey Road"] },
  { city: "Ranchi", state: "Jharkhand", localities: ["Main Road", "HEC", "Dhurwa"] },
  { city: "Raipur", state: "Chhattisgarh", localities: ["Pandri", "GE Road", "Telibandha"] },
  { city: "Bhopal", state: "Madhya Pradesh", localities: ["MP Nagar", "New Market", "Arera Colony"] },
];

const KNOWN_BRANDS: Array<{ brand: string; pattern: RegExp }> = [
  { brand: "WeWork", pattern: /wework/i },
  { brand: "Awfis", pattern: /awfis/i },
  { brand: "BHIVE", pattern: /bhive/i },
  { brand: "Smartworks", pattern: /smartworks/i },
  { brand: "Innov8", pattern: /innov8/i },
  { brand: "Regus", pattern: /regus/i },
  { brand: "91Springboard", pattern: /91springboard|springboard/i },
  { brand: "IndiQube", pattern: /indiqube/i },
  { brand: "CoWrks", pattern: /cowrks/i },
  { brand: "myHQ", pattern: /myhq/i },
  { brand: "iKeva", pattern: /ikeva/i },
  { brand: "Workafella", pattern: /workafella/i },
  { brand: "Incuspaze", pattern: /incuspaze/i },
  { brand: "AltF", pattern: /altf/i },
  { brand: "Spaces", pattern: /\bspaces\b/i },
  { brand: "The Executive Centre", pattern: /executive centre/i },
  { brand: "The Office Pass", pattern: /office pass/i },
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

const NON_COWORKING_TYPES = new Set([
  "restaurant",
  "food",
  "gym",
  "hospital",
  "school",
  "lodging",
  "hotel",
  "bar",
  "cafe",
  "shopping_mall",
  "grocery_or_supermarket",
  "supermarket",
]);

type ParkingScore = "HIGH" | "MEDIUM" | "LOW";
type LeadScore = "P1_HOT" | "P2_WARM" | "P3_NURTURE" | "P4_WATCH";

export interface CoworkingSearchOptions {
  testMode?: boolean;
  cityFilter?: string;
}

function isLikelyCoworking(types: string[], name: string): boolean {
  if (types.some((t) => NON_COWORKING_TYPES.has(t))) return false;
  const nameLower = name.toLowerCase();
  const coworkingTerms = [
    "cowork",
    "co-work",
    "shared office",
    "workspace",
    "work space",
    "serviced office",
    "flexible office",
    "managed office",
  ];
  const brandMatch = KNOWN_BRANDS.some((b) => b.pattern.test(name));
  const termMatch = coworkingTerms.some((t) => nameLower.includes(t));
  return brandMatch || termMatch;
}

function detectBrand(name: string): string | null {
  for (const { brand, pattern } of KNOWN_BRANDS) {
    if (pattern.test(name)) return brand;
  }
  return null;
}

function scoreParkingOpportunity(reviews: Array<{ text: string }>): ParkingScore {
  if (!reviews || reviews.length === 0) return "LOW";
  const combinedText = reviews.map((r) => r.text).join(" ").toLowerCase();
  const complaintCount = PARKING_COMPLAINT_KEYWORDS.filter((kw) =>
    combinedText.includes(kw)
  ).length;
  if (complaintCount >= 3) return "HIGH";
  if (complaintCount >= 1) return "MEDIUM";
  return "LOW";
}

function computeLeadScore(
  totalRatings: number | null,
  rating: number | null,
  hasPhone: boolean,
  hasWebsite: boolean,
  parkingScore: ParkingScore,
): LeadScore {
  const ratingCount = totalRatings ?? 0;
  const ratingValue = rating ?? 0;
  const parkingBonus = parkingScore === "HIGH" ? 3 : parkingScore === "MEDIUM" ? 1 : 0;

  if (ratingCount >= 100 && ratingValue >= 4.0 && hasPhone && parkingScore !== "LOW") {
    return "P1_HOT";
  }
  if (ratingCount >= 20 && ratingValue >= 3.5 && (hasPhone || hasWebsite) && parkingBonus > 0) {
    return "P2_WARM";
  }
  if (ratingCount >= 20 && ratingValue >= 3.5 && (hasPhone || hasWebsite)) {
    return "P2_WARM";
  }
  if (ratingCount >= 5 || (ratingValue >= 3.0 && (hasPhone || hasWebsite))) {
    return "P3_NURTURE";
  }
  return "P4_WATCH";
}

function extractAddressComponents(
  addressComponents: Array<{ long_name: string; short_name?: string; types: string[] }>,
): { district: string; state: string; pincode: string; country: string; countryCode: string } {
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
    } else if (
      component.types.includes("administrative_area_level_3") &&
      !district
    ) {
      district = component.long_name;
    } else if (
      component.types.includes("administrative_area_level_2") &&
      !district
    ) {
      district = component.long_name;
    }
  }

  return { district, state, pincode, country, countryCode };
}

function generateCoworkingId(placeId: string): string {
  return "cs" + crypto.createHash("sha256").update(placeId).digest("hex").slice(0, 22);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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

export async function getAllIndiaCoworkingSpaces(
  options: CoworkingSearchOptions = {},
): Promise<void> {
  const { testMode = false, cityFilter } = options;

  const citiesToSearch = testMode
    ? [{ city: "Bengaluru", state: "Karnataka", localities: ["Koramangala"] }]
    : cityFilter
    ? CITIES_WITH_LOCALITIES.filter(
        (c) => c.city.toLowerCase() === cityFilter.toLowerCase(),
      )
    : CITIES_WITH_LOCALITIES;

  if (citiesToSearch.length === 0) {
    console.error(`No matching city found for filter: "${cityFilter}"`);
    return;
  }

  const allPlacesMap = new Map<string, { place: any; searchCity: string; searchState: string }>();

  logOperationalEvent("coworking.search.started", {
    scope: testMode ? "test" : cityFilter ? "single_city" : "india",
    cities: citiesToSearch.length,
  });

  for (const cityDef of citiesToSearch) {
    const { city, state, localities } = cityDef;
    console.log(`\n[${city}, ${state}] Starting locality-level search...`);
    const cityPlacesMap = new Map<string, any>();

    for (const locality of localities) {
      for (const keyword of COWORKING_KEYWORDS) {
        const query = `${keyword} in ${locality}, ${city}`;
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
    }

    for (const keyword of COWORKING_KEYWORDS) {
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
    logOperationalEvent("coworking.city.found", { city, state, count: cityPlacesMap.size });

    cityPlacesMap.forEach((place, placeId) => {
      if (!allPlacesMap.has(placeId)) {
        allPlacesMap.set(placeId, { place, searchCity: city, searchState: state });
      }
    });
  }

  logOperationalEvent("coworking.search.deduped", { total: allPlacesMap.size });
  console.log(`\nTotal unique places across all searched cities: ${allPlacesMap.size}`);
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
              "reviews",
            ].join(","),
          },
        },
      );

      const details = detailsResp.data.result;
      if (!details) {
        skipped++;
        continue;
      }

      const types: string[] = details.types ?? [];
      if (!isLikelyCoworking(types, details.name)) {
        skipped++;
        continue;
      }

      const addrComponents = extractAddressComponents(details.address_components ?? []);
      if (addrComponents.countryCode && addrComponents.countryCode !== "IN") {
        // Text search has no hard India restriction, so a brand-name match
        // abroad (e.g. "Innov8 coworking" matching a Dubai listing) can slip
        // through and get tagged with the wrong city/state.
        skipped++;
        continue;
      }
      const reviews: Array<{ text: string }> = details.reviews ?? [];
      const parkingScore = scoreParkingOpportunity(reviews);
      const hasPhone = Boolean(details.formatted_phone_number);
      const hasWebsite = Boolean(details.website);
      const leadScore = computeLeadScore(
        details.user_ratings_total ?? null,
        details.rating ?? null,
        hasPhone,
        hasWebsite,
        parkingScore,
      );
      const brand = detectBrand(details.name);
      const coworkingId = generateCoworkingId(placeId);

      await prismaInstance.coworkingSpace.upsert({
        where: { id: coworkingId },
        update: {
          name: details.name,
          city: searchCity,
          state: normalizeStateName(addrComponents.state) || searchState,
          district: addrComponents.district || null,
          pincode: addrComponents.pincode || null,
          country: addrComponents.country || "India",
          address: details.formatted_address || null,
          lat: details.geometry?.location.lat ?? null,
          lng: details.geometry?.location.lng ?? null,
          map_url: details.url || null,
          website: hasWebsite ? details.website : null,
          contact_phone: details.formatted_phone_number || null,
          international_phone: details.international_phone_number || null,
          rating: details.rating ?? null,
          total_ratings: details.user_ratings_total ?? null,
          campus_brand: brand,
          operator_name: brand,
          // challenges and campus_size_hint intentionally omitted here so that
          // manual values set by the team are not overwritten on re-scrape
        },
        create: {
          id: coworkingId,
          name: details.name,
          city: searchCity,
          state: normalizeStateName(addrComponents.state) || searchState,
          district: addrComponents.district || null,
          pincode: addrComponents.pincode || null,
          country: addrComponents.country || "India",
          address: details.formatted_address || null,
          lat: details.geometry?.location.lat ?? null,
          lng: details.geometry?.location.lng ?? null,
          map_url: details.url || null,
          website: hasWebsite ? details.website : null,
          contact_phone: details.formatted_phone_number || null,
          international_phone: details.international_phone_number || null,
          rating: details.rating ?? null,
          total_ratings: details.user_ratings_total ?? null,
          campus_brand: brand,
          operator_name: brand,
          campus_size_hint: leadScore,
          challenges: parkingScore,
          exterior_media_urls: [],
          isVerified: false,
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

  logOperationalEvent("coworking.search.completed", {
    total: allPlacesMap.size,
    saved,
    skipped,
    failed,
  });

  console.log("\n=== Coworking spaces scrape complete ===");
  console.log(`  Total unique: ${allPlacesMap.size}`);
  console.log(`  Saved:        ${saved}`);
  console.log(`  Skipped:      ${skipped}`);
  console.log(`  Failed:       ${failed}`);
}
