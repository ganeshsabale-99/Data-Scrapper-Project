import { fetchGooglePlaces, GooglePlacesRequestError } from "./googlePlacesClient";

type DiscoverableTechPark = {
  place_id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  locality?: string | null;
  address_line1?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type DiscoveredTechParkCompany = {
  place_id: string;
  name: string;
  address: string;
  city: string;
  locationLat: number;
  locationLng: number;
  website: string | null;
  description: string | null;
  operator: string | null;
  rating: number | null;
  total_ratings: number;
  types: string[];
  business_status: string;
  plus_code: string | null;
  opening_hours: string[];
  map_url: string | null;
  photo_reference: string | null;
  contact_phone: string | null;
  contact_international_phone: string | null;
  contact_email: string | null;
};

const GOOGLE_PLACES_TEXT_SEARCH_URL =
  "https://maps.googleapis.com/maps/api/place/textsearch/json";
const GOOGLE_PLACES_DETAILS_URL =
  "https://maps.googleapis.com/maps/api/place/details/json";

const HIGH_CONFIDENCE_TYPES = new Set([
  "corporate_office",
]);

const EXCLUDED_TYPES = new Set([
  "restaurant",
  "cafe",
  "bakery",
  "meal_delivery",
  "meal_takeaway",
  "shopping_mall",
  "supermarket",
  "department_store",
  "clothing_store",
  "convenience_store",
  "store",
  "lodging",
  "apartment_building",
  "hospital",
  "school",
  "university",
  "gym",
  "parking",
  "bus_station",
  "subway_station",
  "train_station",
  "tourist_attraction",
  "place_of_worship",
  "bank",
  "atm",
  "police",
  "pharmacy",
  "spa",
  "beauty_salon",
]);

const normalizeText = (value: string | null | undefined): string =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(private|limited|pvt|ltd|llp|inc|corp|corporation|technologies|technology|solutions|services)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value: string | null | undefined): string[] =>
  normalizeText(value)
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);

const toSentenceCase = (value: string | null | undefined): string =>
  String(value || "").trim();

const distanceInMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) => {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
};

const extractCity = (
  formattedAddress: string | null | undefined,
  fallbackCity: string | null | undefined,
): string => {
  if (fallbackCity && fallbackCity.trim()) {
    return fallbackCity.trim();
  }

  const parts = String(formattedAddress || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length >= 2 ? parts[parts.length - 2] ?? "" : "";
};

const sharesEnoughTokens = (candidate: string, reference: string): boolean => {
  const candidateTokens = new Set(tokenize(candidate));
  const referenceTokens = tokenize(reference);
  if (!candidateTokens.size || !referenceTokens.length) return false;

  const overlappingCount = referenceTokens.filter((token) => candidateTokens.has(token)).length;
  return overlappingCount >= Math.min(2, referenceTokens.length);
};

const isLikelyTenantResult = (
  park: DiscoverableTechPark,
  place: {
    name?: string;
    formatted_address?: string;
    types?: string[];
    geometry?: { location?: { lat?: number; lng?: number } };
  },
): boolean => {
  const candidateName = normalizeText(place.name);
  const parkName = normalizeText(park.name);
  if (!candidateName || candidateName === parkName) {
    return false;
  }

  const types = Array.isArray(place.types) ? place.types : [];
  if (types.some((type) => EXCLUDED_TYPES.has(type))) {
    return false;
  }

  const address = normalizeText(place.formatted_address);
  const parkLocality = normalizeText(park.locality);
  const parkAddress = normalizeText(park.address_line1);
  const hasParkNameMatch =
    address.includes(parkName) ||
    sharesEnoughTokens(address, park.name) ||
    sharesEnoughTokens(candidateName, park.name);
  const hasLocalityMatch =
    (parkLocality && address.includes(parkLocality)) ||
    (parkAddress && sharesEnoughTokens(address, park.address_line1 || ""));
  const hasCorporateType = types.some((type) => HIGH_CONFIDENCE_TYPES.has(type));

  const candidateLat = place.geometry?.location?.lat;
  const candidateLng = place.geometry?.location?.lng;
  const parkLat = park.lat;
  const parkLng = park.lng;
  const isWithinCampusRadius =
    typeof candidateLat === "number" &&
    typeof candidateLng === "number" &&
    typeof parkLat === "number" &&
    typeof parkLng === "number" &&
    distanceInMeters(parkLat, parkLng, candidateLat, candidateLng) <= 250;

  return Boolean(
    hasCorporateType ||
      (hasParkNameMatch && (hasLocalityMatch || isWithinCampusRadius)) ||
      (isWithinCampusRadius && hasLocalityMatch),
  );
};

export async function discoverTechParkCompanies(
  park: DiscoverableTechPark,
): Promise<DiscoveredTechParkCompany[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is required to discover tech park companies.");
  }

  const queries = [
    `${park.name} companies`,
    `${park.name} offices`,
    `${park.name} corporate office`,
  ];

  const candidateMap = new Map<string, any>();
  let nonRetryableError: GooglePlacesRequestError | null = null;
  let anyQuerySucceeded = false;

  for (const query of queries) {
    try {
      const params: Record<string, string> = { key: apiKey, query };
      if (typeof park.lat === "number" && typeof park.lng === "number") {
        params.location = `${park.lat},${park.lng}`;
        params.radius = "1500";
      }

      const data = await fetchGooglePlaces(GOOGLE_PLACES_TEXT_SEARCH_URL, params);
      anyQuerySucceeded = true;
      const results = Array.isArray(data?.results) ? data.results : [];

      for (const result of results) {
        if (!result?.place_id || result.place_id === park.place_id) {
          continue;
        }
        if (!isLikelyTenantResult(park, result)) {
          continue;
        }
        if (!candidateMap.has(result.place_id)) {
          candidateMap.set(result.place_id, result);
        }
      }
    } catch (error) {
      if (error instanceof GooglePlacesRequestError) {
        nonRetryableError = error;
      }
      continue;
    }
  }

  // If every single query failed with a non-retryable error (bad key, malformed
  // request), this is NOT "zero companies found" — it's a broken search. Throwing
  // here matters: the caller uses an empty result to mark previously-discovered
  // companies as no-longer-present, and doing that off a failed search would
  // wrongly flag every real company at once.
  if (!anyQuerySucceeded && nonRetryableError) {
    throw nonRetryableError;
  }

  const discoveredCompanies = await Promise.all(
    Array.from(candidateMap.values()).map(async (candidate): Promise<DiscoveredTechParkCompany | null> => {
      try {
        const detailsData = await fetchGooglePlaces(GOOGLE_PLACES_DETAILS_URL, {
          key: apiKey,
          place_id: candidate.place_id,
          fields: [
            "place_id",
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
            "plus_code",
            "url",
            "photos",
          ].join(","),
        });

        const details = detailsData?.result;
        if (!details || !isLikelyTenantResult(park, details)) {
          return null;
        }

        return {
          place_id: String(details.place_id),
          name: toSentenceCase(details.name),
          address: toSentenceCase(details.formatted_address),
          city: extractCity(details.formatted_address, park.city),
          locationLat: Number(details.geometry?.location?.lat || 0),
          locationLng: Number(details.geometry?.location?.lng || 0),
          website: details.website || null,
          description: null,
          operator: null,
          rating: typeof details.rating === "number" ? details.rating : null,
          total_ratings: Number(details.user_ratings_total || 0),
          types: Array.isArray(details.types) ? details.types : [],
          business_status: String(details.business_status || "NOT_CONTACTED"),
          plus_code: details.plus_code?.global_code || null,
          opening_hours: Array.isArray(details.opening_hours?.weekday_text)
            ? details.opening_hours.weekday_text
            : [],
          map_url: details.url || null,
          photo_reference: details.photos?.[0]?.photo_reference || null,
          contact_phone: details.formatted_phone_number || null,
          contact_international_phone: details.international_phone_number || null,
          contact_email: null,
        } satisfies DiscoveredTechParkCompany;
      } catch {
        return null;
      }
    }),
  );

  return discoveredCompanies.filter(
    (company): company is DiscoveredTechParkCompany =>
      Boolean(company?.name && company.address),
  );
}
