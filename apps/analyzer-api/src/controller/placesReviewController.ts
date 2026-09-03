import { Request, Response } from "express";
import axios from "axios";
import { prismaInstance } from "@repo/db";

// ── Outscraper API interfaces ──────────────────────────────────────────────────

interface OutscraperReview {
  author_title?: string;
  author_image?: string;
  review_rating?: number;
  review_datetime_utc?: string;
  review_text?: string;
  reviews_id?: string;
}

interface OutscraperPlace {
  name?: string;
  rating?: number;
  reviews?: number;
  reviews_data?: OutscraperReview[];
}

interface OutscraperResponse {
  status?: string;
  data?: OutscraperPlace[][];
}

// ── Google Places fallback interfaces ─────────────────────────────────────────

interface GoogleTextSearchResult {
  place_id?: string;
  name?: string;
  rating?: number;
  user_ratings_total?: number;
  formatted_address?: string;
}

interface GoogleFindPlaceResponse {
  status: string;
  error_message?: string;
  candidates?: GoogleTextSearchResult[];
}

interface GoogleTextSearchResponse {
  status: string;
  error_message?: string;
  results?: GoogleTextSearchResult[];
}

interface GooglePlaceDetailsResponse {
  status: string;
  error_message?: string;
  result?: {
    name?: string;
    rating?: number;
    user_ratings_total?: number;
    reviews?: {
      author_name?: string;
      rating?: number;
      relative_time_description?: string;
      text?: string;
      profile_photo_url?: string;
    }[];
  };
}

// ── Parking keywords ──────────────────────────────────────────────────────────
const PARKING_KEYWORDS = [
  "parking", "car park", "vehicle", "bike", "motorcycle",
  "two wheeler", "four wheeler", "valet", "no parking",
];

const isAboutParking = (text: string): boolean =>
  PARKING_KEYWORDS.some((kw) => text.toLowerCase().includes(kw));

// ── Outscraper helpers ────────────────────────────────────────────────────────

/**
 * Fetch reviews via Outscraper Google Maps Reviews API.
 * Docs: https://outscraper.com/google-maps-reviews-api/
 *
 * Free tier: 25 requests/month — https://outscraper.com/pricing/
 * Sign up at: https://outscraper.com → Dashboard → API Key
 */
async function fetchReviewsViaOutscraper(
  apiKey: string,
  query: string,
  limit: number = 20
): Promise<{ place: OutscraperPlace | null; reviews: OutscraperReview[] }> {
  console.log(`[Outscraper] Fetching reviews for: "${query}", limit: ${limit}`);

  const resp = await axios.get<OutscraperResponse>(
    "https://api.app.outscraper.com/maps/reviews-v3",
    {
      params: {
        query,
        limit,          // number of reviews to fetch
        language: "en",
        async: false,   // wait for result (synchronous)
        sort: "newest", // newest reviews first
      },
      headers: {
        "X-API-KEY": apiKey,
      },
      timeout: 30000,   // Outscraper can be slow on first call
    }
  );

  const place = resp.data?.data?.[0]?.[0] ?? null;
  if (!place) {
    console.warn("[Outscraper] No place data returned");
    return { place: null, reviews: [] };
  }

  const reviews = place.reviews_data ?? [];
  console.log(`[Outscraper] Got ${reviews.length} reviews for "${place.name}"`);
  return { place, reviews };
}

const mapOutscraperReview = (r: OutscraperReview) => ({
  author: r.author_title ?? "Anonymous",
  rating: r.review_rating ?? 0,
  date: r.review_datetime_utc
    ? new Date(r.review_datetime_utc).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    : "",
  text: r.review_text ?? "",
  is_local_guide: false,
  profile_photo_url: r.author_image ?? null,
});

// ── Google Places helpers (fallback) ─────────────────────────────────────────

async function findPlaceIdViaGoogle(
  apiKey: string,
  query: string
): Promise<{ placeId: string | null; topResult: GoogleTextSearchResult | null }> {
  // Try Find Place first
  try {
    const fpResp = await axios.get<GoogleFindPlaceResponse>(
      "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
      {
        params: {
          input: query,
          inputtype: "textquery",
          fields: "place_id,name,rating,user_ratings_total",
          key: apiKey,
          language: "en",
        },
        timeout: 10000,
      }
    );
    if (fpResp.data?.status === "OK" && (fpResp.data?.candidates?.length ?? 0) > 0) {
      const top = fpResp.data.candidates![0]!;
      return { placeId: top.place_id ?? null, topResult: top };
    }
  } catch { /* fall through */ }

  // Fallback: Text Search
  const tsResp = await axios.get<GoogleTextSearchResponse>(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
    {
      params: { query, key: apiKey, region: "in", language: "en", type: "establishment" },
      timeout: 10000,
    }
  );
  const results = tsResp.data?.results ?? [];
  if (results.length === 0) return { placeId: null, topResult: null };
  const top = results[0]!;
  return { placeId: top.place_id ?? null, topResult: top };
}

/**
 * Fetch place details twice — with "newest" and "most_relevant" sort orders —
 * then merge and deduplicate. This gives up to 10 unique reviews using the
 * same free Google API key (Google returns 5 per call).
 */
async function fetchGooglePlaceDetails(apiKey: string, placeId: string) {
  const fetchWithSort = async (sort: "newest" | "most_relevant") => {
    const resp = await axios.get<GooglePlaceDetailsResponse>(
      "https://maps.googleapis.com/maps/api/place/details/json",
      {
        params: {
          place_id: placeId,
          fields: "name,rating,user_ratings_total,reviews",
          key: apiKey,
          language: "en",
          reviews_sort: sort,
        },
        timeout: 10000,
      }
    );
    return resp.data?.result ?? null;
  };

  // Call both sort orders in parallel
  const [newestResult, relevantResult] = await Promise.all([
    fetchWithSort("newest"),
    fetchWithSort("most_relevant"),
  ]);

  // Use the first result for place metadata
  const baseResult = newestResult ?? relevantResult;
  if (!baseResult) return null;

  // Merge reviews from both calls and deduplicate by author + text fingerprint
  const allReviews = [
    ...(newestResult?.reviews ?? []),
    ...(relevantResult?.reviews ?? []),
  ];

  const seen = new Set<string>();
  const uniqueReviews = allReviews.filter((r) => {
    const key = `${r.author_name ?? ""}|${(r.text ?? "").slice(0, 50)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(
    `[GooglePlaces] Merged ${newestResult?.reviews?.length ?? 0} newest + ${relevantResult?.reviews?.length ?? 0} relevant = ${uniqueReviews.length} unique reviews`
  );

  return {
    ...baseResult,
    reviews: uniqueReviews,
  };
}


// ── Controllers ───────────────────────────────────────────────────────────────

const VENUE_TYPES = new Set(["techpark", "coworking", "mall", "hospital", "stadium", "airport"]);

/** Return reviews already collected by the full review scraper. */
export const getStoredVenueReviews = async (req: Request, res: Response): Promise<void> => {
  const venueType = String(req.query.venueType ?? "").toLowerCase();
  const venueId = String(req.query.venueId ?? "");
  const filter = String(req.query.filter ?? "all").toLowerCase();
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(req.query.pageSize ?? "10"), 10) || 10));

  if (!VENUE_TYPES.has(venueType) || !venueId) {
    res.status(400).json({ success: false, message: "Valid 'venueType' and 'venueId' query params are required." });
    return;
  }
  if (!["all", "issues", "parking"].includes(filter)) {
    res.status(400).json({ success: false, message: "Filter must be 'all', 'issues', or 'parking'." });
    return;
  }

  const baseWhere = { venueType, venueId };
  const where = {
    ...baseWhere,
    ...(filter === "issues" ? { issueScore: { gt: 0 } } : {}),
    ...(filter === "parking" ? { isParkingRelated: true } : {}),
  };

  try {
    const [items, totalItems, all, issues, parking] = await Promise.all([
      prismaInstance.venueReview.findMany({ where, orderBy: [{ publishedAt: "desc" }, { fetchedAt: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
      prismaInstance.venueReview.count({ where }),
      prismaInstance.venueReview.count({ where: baseWhere }),
      prismaInstance.venueReview.count({ where: { ...baseWhere, issueScore: { gt: 0 } } }),
      prismaInstance.venueReview.count({ where: { ...baseWhere, isParkingRelated: true } }),
    ]);
    res.json({ success: true, data: { items, page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize), counts: { all, issues, parking } } });
  } catch (error: unknown) {
    console.error("[StoredVenueReviews] Error:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ success: false, message: "Unable to load stored reviews." });
  }
};

/** Return unverified provider/service candidates collected from public search results. */
export const getVenueProviderCandidates = async (req: Request, res: Response): Promise<void> => {
  const venueType = String(req.query.venueType ?? "").toLowerCase();
  const venueId = String(req.query.venueId ?? "");
  const category = String(req.query.category ?? "ALL").toUpperCase();
  const highRelevance = String(req.query.highRelevance ?? "false") === "true";
  if (!VENUE_TYPES.has(venueType) || !venueId) {
    res.status(400).json({ success: false, message: "Valid 'venueType' and 'venueId' query params are required." });
    return;
  }
  try {
    const baseWhere = { venueType, venueId };
    const where = { ...baseWhere, ...(category !== "ALL" ? { category } : {}), ...(highRelevance ? { relevanceScore: { gte: 30 } } : {}) };
    const [items, total, high, categories] = await Promise.all([
      prismaInstance.venueProviderCandidate.findMany({ where, orderBy: [{ relevanceScore: "desc" }, { fetchedAt: "desc" }] }),
      prismaInstance.venueProviderCandidate.count({ where: baseWhere }),
      prismaInstance.venueProviderCandidate.count({ where: { ...baseWhere, relevanceScore: { gte: 30 } } }),
      prismaInstance.venueProviderCandidate.groupBy({ by: ["category"], where: baseWhere, _count: { _all: true } }),
    ]);
    res.json({ success: true, data: { items, counts: { all: total, high, categories: Object.fromEntries(categories.map((entry) => [entry.category, entry._count._all])) } } });
  } catch (error) {
    console.error("[VenueProviderCandidates] Error:", error);
    res.status(500).json({ success: false, message: "Unable to load provider candidates." });
  }
};

/** GET /places-reviews?name=&location=&mapUrl= */
export const getPlaceReviews = async (req: Request, res: Response): Promise<void> => {
  const { name, location, mapUrl } = req.query as {
    name?: string;
    location?: string;
    mapUrl?: string;
  };

  if (!name || !location) {
    res.status(400).json({ success: false, message: "Query params 'name' and 'location' are required." });
    return;
  }

  const outscraperKey = process.env.OUTSCRAPER_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY;

  // Build query — use mapUrl if available (most accurate for Outscraper)
  const query = mapUrl ? mapUrl : `${name.trim()} ${location.trim()}`;

  try {
    // ── Primary: Outscraper ──────────────────────────────────────────────────
    if (outscraperKey) {
      const { place, reviews } = await fetchReviewsViaOutscraper(outscraperKey, query, 20);

      res.json({
        success: true,
        data: {
          name: place?.name ?? name,
          rating: place?.rating ?? null,
          total_ratings: place?.reviews ?? 0,
          reviews: reviews.map(mapOutscraperReview),
        },
      });
      return;
    }

    // ── Fallback: Google Places ──────────────────────────────────────────────
    if (googleKey) {
      console.log("[PlacesReview] OUTSCRAPER_API_KEY not set, falling back to Google Places");
      const searchQuery = `${name.trim()} ${location.trim()}`;
      const { placeId, topResult } = await findPlaceIdViaGoogle(googleKey, searchQuery);

      if (!placeId || !topResult) {
        res.json({ success: true, data: { rating: null, total_ratings: 0, reviews: [] } });
        return;
      }

      const details = await fetchGooglePlaceDetails(googleKey, placeId);
      const reviews = (details?.reviews ?? []).map((r) => ({
        author: r.author_name ?? "Anonymous",
        rating: r.rating ?? 0,
        date: r.relative_time_description ?? "",
        text: r.text ?? "",
        is_local_guide: false,
        profile_photo_url: r.profile_photo_url ?? null,
      }));

      res.json({
        success: true,
        data: {
          name: details?.name ?? topResult.name,
          rating: details?.rating ?? topResult.rating ?? null,
          total_ratings: details?.user_ratings_total ?? topResult.user_ratings_total ?? 0,
          reviews,
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "No review API configured. Set OUTSCRAPER_API_KEY or GOOGLE_API_KEY in .env",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[PlacesReview] Error:", message);
    res.status(502).json({ success: false, message, error: message });
  }
};

/** GET /places-reviews/parking-complaints?name=&location=&mapUrl= */
export const getParkingComplaints = async (req: Request, res: Response): Promise<void> => {
  const { name, location, mapUrl } = req.query as {
    name?: string;
    location?: string;
    mapUrl?: string;
  };

  if (!name || !location) {
    res.status(400).json({ success: false, message: "Query params 'name' and 'location' are required." });
    return;
  }

  const outscraperKey = process.env.OUTSCRAPER_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY;
  const query = mapUrl ? mapUrl : `${name.trim()} ${location.trim()}`;

  try {
    let allReviews: ReturnType<typeof mapOutscraperReview>[] = [];
    let placeName = name;
    let overallRating: number | null = null;

    // ── Primary: Outscraper ──────────────────────────────────────────────────
    if (outscraperKey) {
      const { place, reviews } = await fetchReviewsViaOutscraper(outscraperKey, query, 30);
      allReviews = reviews.map(mapOutscraperReview);
      placeName = place?.name ?? name;
      overallRating = place?.rating ?? null;
    }
    // ── Fallback: Google Places ──────────────────────────────────────────────
    else if (googleKey) {
      const searchQuery = `${name.trim()} ${location.trim()}`;
      const { placeId, topResult } = await findPlaceIdViaGoogle(googleKey, searchQuery);
      if (placeId) {
        const details = await fetchGooglePlaceDetails(googleKey, placeId);
        allReviews = (details?.reviews ?? []).map((r) => ({
          author: r.author_name ?? "Anonymous",
          rating: r.rating ?? 0,
          date: r.relative_time_description ?? "",
          text: r.text ?? "",
          is_local_guide: false,
          profile_photo_url: r.profile_photo_url ?? null,
        }));
        placeName = details?.name ?? topResult?.name ?? name;
        overallRating = details?.rating ?? topResult?.rating ?? null;
      }
    }

    const complaints = allReviews.filter((r) => isAboutParking(r.text));

    res.json({
      success: true,
      data: {
        place: placeName,
        overall_rating: overallRating,
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
