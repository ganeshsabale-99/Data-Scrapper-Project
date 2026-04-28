import { Request, Response } from "express";
import axios from "axios";

interface SerpApiLocalResult {
  title?: string;
  rating?: number;
  reviews?: number;
  place_id?: string;
  data_id?: string;            // SerpAPI internal hex ID (alternative to place_id)
}

interface SerpApiReviewResult {
  user?: {
    name?: string;
    local_guide?: boolean;
  };
  rating?: number;
  date?: string;
  snippet?: string;
}

interface SerpApiSearchResponse {
  error?: string;
  local_results?: SerpApiLocalResult[];
  place_results?: SerpApiLocalResult;   // single place result
}

interface SerpApiReviewsResponse {
  error?: string;
  reviews?: SerpApiReviewResult[];
  serpapi_pagination?: { next_page_token?: string };
}

// ── Parking keyword list ──────────────────────────────────────────────────────
const PARKING_KEYWORDS = [
  "parking", "car park", "vehicle", "bike", "motorcycle",
  "two wheeler", "four wheeler", "valet", "no parking",
];

const isAboutParking = (text: string): boolean =>
  PARKING_KEYWORDS.some((kw) => text.toLowerCase().includes(kw));

// ── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Resolve place details (place_id / data_id) from a free-text query.
 * SerpAPI google_maps engine: https://serpapi.com/google-maps-api
 */
async function resolvePlaceId(
  apiKey: string,
  query: string
): Promise<{ placeId: string | null; topPlace: SerpApiLocalResult | null }> {
  const resp = await axios.get<SerpApiSearchResponse>(
    "https://serpapi.com/search.json",
    {
      params: {
        engine: "google_maps",
        q: query,
        type: "search",
        api_key: apiKey,
        hl: "en",
        gl: "in",            // country = India
      },
      timeout: 12000,
    }
  );

  // SerpAPI returns error in response body with HTTP 200
  if (resp.data?.error) {
    console.error("[SerpAPI] google_maps error:", resp.data.error);
    throw new Error(`SerpAPI: ${resp.data.error}`);
  }

  const results = resp.data?.local_results ?? [];
  console.log(`[SerpAPI] google_maps results count: ${results.length} for query: "${query}"`);

  if (results.length === 0) return { placeId: null, topPlace: null };

  const top = results[0] ?? null;
  if (!top) return { placeId: null, topPlace: null };

  // Prefer data_id (hex format) over place_id (ChIJ format) — either works for reviews
  const placeId = top.data_id ?? top.place_id ?? null;
  console.log(`[SerpAPI] Place found: "${top.title}", placeId: ${placeId}`);

  return { placeId, topPlace: top };
}

/**
 * Fetch pages of reviews sorted by sortBy code.
 * SerpAPI sort_by codes: "1"=relevant, "2"=newest, "3"=highest, "4"=lowest
 */
async function fetchReviews(
  apiKey: string,
  placeId: string,
  maxPages: number,
  sortBy: string = "1"
): Promise<SerpApiReviewResult[]> {
  const all: SerpApiReviewResult[] = [];
  let nextPageToken: string | undefined;

  for (let p = 0; p < maxPages; p++) {
    const params: Record<string, string> = {
      engine: "google_maps_reviews",
      place_id: placeId,
      api_key: apiKey,
      hl: "en",
      sort_by: sortBy,
    };
    if (nextPageToken) params.next_page_token = nextPageToken;

    const resp = await axios.get<SerpApiReviewsResponse>(
      "https://serpapi.com/search.json",
      { params, timeout: 15000 }
    );

    if (resp.data?.error) {
      console.error("[SerpAPI] google_maps_reviews error:", resp.data.error);
      throw new Error(`SerpAPI reviews: ${resp.data.error}`);
    }

    const batch = resp.data?.reviews ?? [];
    console.log(`[SerpAPI] Reviews page ${p + 1}: ${batch.length} reviews`);
    all.push(...batch);

    nextPageToken = resp.data?.serpapi_pagination?.next_page_token;
    if (!nextPageToken || batch.length === 0) break;
  }

  return all;
}

const mapReview = (r: SerpApiReviewResult) => ({
  author: r.user?.name ?? "Anonymous",
  rating: r.rating ?? 0,
  date: r.date ?? "",
  text: r.snippet ?? "",
  is_local_guide: r.user?.local_guide ?? false,
});

// ── Controllers ───────────────────────────────────────────────────────────────

/** GET /places-reviews?name=&location= */
export const getPlaceReviews = async (req: Request, res: Response): Promise<void> => {
  const { name, location } = req.query as { name?: string; location?: string };

  if (!name || !location) {
    res.status(400).json({ success: false, message: "Query params 'name' and 'location' are required." });
    return;
  }

  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    res.status(500).json({ success: false, message: "SerpAPI key is not configured." });
    return;
  }

  try {
    const query = `${name.trim()} ${location.trim()}`;
    const { placeId, topPlace } = await resolvePlaceId(apiKey, query);

    if (!topPlace) {
      console.warn(`[PlacesReview] No place found for query: "${query}"`);
      res.json({ success: true, data: { rating: null, total_ratings: 0, reviews: [] } });
      return;
    }

    let reviews: SerpApiReviewResult[] = [];
    if (placeId) {
      try {
        reviews = await fetchReviews(apiKey, placeId, 1, "2"); // newest first
      } catch (e) {
        console.error("[PlacesReview] fetchReviews failed:", e instanceof Error ? e.message : e);
        reviews = [];
      }
    }

    res.json({
      success: true,
      data: {
        name: topPlace.title,
        rating: topPlace.rating ?? null,
        total_ratings: topPlace.reviews ?? 0,
        reviews: reviews.slice(0, 10).map(mapReview),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[PlacesReview] Error:", message);
    res.status(502).json({ success: false, message, error: message });
  }
};

/**
 * GET /places-reviews/parking-complaints?name=&location=
 * Returns low-rated (≤ 2 stars) reviews mentioning parking keywords.
 */
export const getParkingComplaints = async (req: Request, res: Response): Promise<void> => {
  const { name, location } = req.query as { name?: string; location?: string };

  if (!name || !location) {
    res.status(400).json({ success: false, message: "Query params 'name' and 'location' are required." });
    return;
  }

  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    res.status(500).json({ success: false, message: "SerpAPI key is not configured." });
    return;
  }

  try {
    const query = `${name.trim()} ${location.trim()}`;
    const { placeId, topPlace } = await resolvePlaceId(apiKey, query);

    if (!topPlace || !placeId) {
      console.warn(`[ParkingComplaints] No place found for query: "${query}"`);
      res.json({ success: true, data: { place: null, complaints: [], total_reviews_scanned: 0 } });
      return;
    }

    // Fetch up to 2 pages sorted by lowest rating
    const allReviews = await fetchReviews(apiKey, placeId, 2, "4"); // lowest rating first

    const complaints = allReviews
      .filter((r) => (r.rating ?? 5) <= 2 && isAboutParking(r.snippet ?? ""))
      .map(mapReview);

    res.json({
      success: true,
      data: {
        place: topPlace.title,
        overall_rating: topPlace.rating ?? null,
        total_reviews_scanned: allReviews.length,
        complaints,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ParkingComplaints] Error:", message);
    res.status(502).json({ success: false, message, error: message });
  }
};
