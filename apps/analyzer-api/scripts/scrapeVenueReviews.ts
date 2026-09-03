import crypto from "crypto";
import dotenv from "dotenv";
import path from "path";
import axios from "axios";
import { scoreReviewIssues } from "../src/utils/reviewIssuePriority";

dotenv.config();
if (!process.env.DATABASE_URL) dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

type VenueType = "techpark" | "coworking" | "mall" | "hospital" | "stadium" | "airport";
type Target = { venueType: VenueType; venueId: string; placeId: string | null; name: string; city: string | null; state: string | null; mapUrl: string | null; totalRatings: number };
type CollectedReview = { id?: string; author?: string; authorImage?: string; rating?: number; text?: string; publishedAt?: string; relativeTime?: string };

const args = process.argv.slice(2);
const arg = (name: string) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const requestedType = (arg("--type") ?? "all").toLowerCase();
const city = arg("--city");
const venueLimit = Math.max(0, Number(arg("--venue-limit") ?? 0));
const globalVenueLimit = Math.max(0, Number(arg("--global-venue-limit") ?? 0));
const maxApiRequests = Math.max(1, Number(arg("--max-api-requests") ?? 200));
const skipExisting = args.includes("--skip-existing");
const reviewsLimit = Math.max(1, Number(arg("--reviews-limit") ?? 100));
const delayMs = Math.max(100, Number(arg("--delay-ms") ?? 500));
const validTypes = new Set(["all", "techpark", "coworking", "mall", "hospital", "stadium", "airport"]);
if (!validTypes.has(requestedType)) throw new Error(`Invalid --type "${requestedType}"`);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const hash = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
let apiRequestsUsed = 0;

async function resolveGooglePlaceId(query: string): Promise<string | null> {
  const key = process.env.GOOGLE_API_KEY?.trim();
  if (!key) return null;
  const response = await axios.get("https://maps.googleapis.com/maps/api/place/findplacefromtext/json", {
    params: { input: query, inputtype: "textquery", fields: "place_id", key },
    timeout: 15_000,
  });
  return response.data?.candidates?.[0]?.place_id ?? null;
}

async function collectSerpApi(placeId: string): Promise<CollectedReview[]> {
  const key = process.env.SERPAPI_API_KEY?.trim();
  if (!key) throw new Error("SERPAPI_API_KEY is required for review collection");

  const collected: CollectedReview[] = [];
  let nextPageToken: string | undefined;
  do {
    if (apiRequestsUsed >= maxApiRequests) break;
    const response = await axios.get("https://serpapi.com/search.json", {
      params: {
        engine: "google_maps_reviews",
        place_id: placeId,
        api_key: key,
        hl: "en",
        sort_by: "newestFirst",
        ...(nextPageToken ? { next_page_token: nextPageToken, num: Math.min(20, reviewsLimit - collected.length) } : {}),
      },
      timeout: 60_000,
    });
    apiRequestsUsed++;
    const reviews = Array.isArray(response.data?.reviews) ? response.data.reviews : [];
    for (const review of reviews) {
      if (collected.length >= reviewsLimit) break;
      collected.push({
        id: review.review_id,
        author: review.user?.name,
        authorImage: review.user?.thumbnail,
        rating: review.rating,
        text: review.snippet,
        publishedAt: review.iso_date,
        relativeTime: review.date,
      });
    }
    nextPageToken = response.data?.serpapi_pagination?.next_page_token;
    if (nextPageToken && collected.length < reviewsLimit) await sleep(delayMs);
  } while (nextPageToken && collected.length < reviewsLimit);

  return collected;
}

async function main() {
  if (!process.env.SERPAPI_API_KEY?.trim()) {
    throw new Error("SERPAPI_API_KEY is required for review collection");
  }
  const { prismaInstance: prisma } = await import("@repo/db");
  const cityWhere = city ? { city: { equals: city, mode: "insensitive" as const } } : {};
  const specs = [
    { type: "techpark" as const, model: prisma.newTechPark, placeField: "place_id" },
    { type: "coworking" as const, model: prisma.coworkingSpace, placeField: null },
    { type: "mall" as const, model: prisma.mall, placeField: "place_id" },
    { type: "hospital" as const, model: prisma.hospital, placeField: "place_id" },
    { type: "stadium" as const, model: prisma.stadium, placeField: "place_id" },
    { type: "airport" as const, model: prisma.airport, placeField: "place_id" },
  ].filter((spec) => requestedType === "all" || spec.type === requestedType);

  const targets: Target[] = [];
  for (const spec of specs) {
    const rows = await spec.model.findMany({
      where: { is_active: true, do_not_call: false, ...cityWhere },
      select: { id: true, name: true, city: true, state: true, map_url: true, total_ratings: true, ...(spec.placeField ? { [spec.placeField]: true } : {}) },
      orderBy: [{ total_ratings: "desc" }, { name: "asc" }],
      ...(venueLimit ? { take: venueLimit } : {}),
    });
    for (const row of rows) targets.push({ venueType: spec.type, venueId: row.id, placeId: spec.placeField ? row[spec.placeField] : null, name: row.name, city: row.city, state: row.state, mapUrl: row.map_url, totalRatings: row.total_ratings ?? 0 });
  }

  let selectedTargets = targets.sort((a, b) => b.totalRatings - a.totalRatings);
  if (skipExisting && selectedTargets.length) {
    const existing = await prisma.venueReview.findMany({
      where: { provider: "SERPAPI" },
      select: { venueType: true, venueId: true },
      distinct: ["venueType", "venueId"],
    });
    const collected = new Set(existing.map((row) => `${row.venueType}:${row.venueId}`));
    selectedTargets = selectedTargets.filter((target) => !collected.has(`${target.venueType}:${target.venueId}`));
  }
  if (globalVenueLimit) selectedTargets = selectedTargets.slice(0, globalVenueLimit);

  console.log(`Review scraper: ${selectedTargets.length} venue(s), provider=SerpApi, review limit=${reviewsLimit}, API budget=${maxApiRequests}`);
  let completed = 0, failed = 0, reviewsFetched = 0, reviewsSaved = 0;

  for (const target of selectedTargets) {
    if (apiRequestsUsed >= maxApiRequests) break;
    try {
      const query = target.mapUrl || `${target.name}, ${target.city ?? ""}, ${target.state ?? ""}`;
      const placeId = target.placeId || await resolveGooglePlaceId(query);
      if (!placeId) throw new Error("Unable to resolve a Google Place ID");
      const reviews = await collectSerpApi(placeId);
      reviewsFetched += reviews.length;
      const fetchedAt = new Date();

      for (const review of reviews) {
        const sourceReviewId = review.id || hash(`${target.venueType}|${target.venueId}|${review.author ?? ""}|${review.publishedAt ?? ""}|${review.text ?? ""}`);
        const analysis = scoreReviewIssues([{ text: review.text, rating: review.rating, time: review.publishedAt ? Date.parse(review.publishedAt) / 1000 : undefined }]);
        await prisma.venueReview.upsert({
          where: { provider_sourceReviewId: { provider: "SERPAPI", sourceReviewId } },
          update: { venueType: target.venueType, venueId: target.venueId, placeId, authorName: review.author, authorImageUrl: review.authorImage, rating: review.rating, text: review.text, publishedAt: review.publishedAt ? new Date(review.publishedAt) : null, relativeTime: review.relativeTime, issueScore: analysis.score, issueCategories: analysis.categories, isParkingRelated: analysis.parkingReviewCount > 0, fetchedAt },
          create: { venueType: target.venueType, venueId: target.venueId, placeId, provider: "SERPAPI", sourceReviewId, authorName: review.author, authorImageUrl: review.authorImage, rating: review.rating, text: review.text, publishedAt: review.publishedAt ? new Date(review.publishedAt) : null, relativeTime: review.relativeTime, issueScore: analysis.score, issueCategories: analysis.categories, isParkingRelated: analysis.parkingReviewCount > 0, fetchedAt },
        });
        reviewsSaved++;
      }

      const stored = await prisma.venueReview.findMany({ where: { venueType: target.venueType, venueId: target.venueId }, select: { text: true, rating: true, publishedAt: true } });
      const aggregate = scoreReviewIssues(stored.map((review) => ({ text: review.text ?? undefined, rating: review.rating ?? undefined, time: review.publishedAt ? review.publishedAt.getTime() / 1000 : undefined })));
      const spec = specs.find((entry) => entry.type === target.venueType)!;
      await spec.model.update({ where: { id: target.venueId }, data: { review_issue_score: aggregate.score, review_priority: aggregate.priority, review_issue_categories: aggregate.categories, review_issue_summary: aggregate.summary, review_evidence: aggregate.evidence, reviews_analyzed: aggregate.reviewsAnalyzed, issue_review_count: aggregate.issueReviewCount, parking_review_count: aggregate.parkingReviewCount, review_analyzed_at: fetchedAt } });
      completed++;
      console.log(`[${completed + failed}/${selectedTargets.length}] ${target.venueType}: ${target.name} — fetched ${reviews.length}, stored total ${stored.length}, ${aggregate.priority} (${aggregate.score})`);
    } catch (error) {
      failed++;
      console.error(`[${completed + failed}/${selectedTargets.length}] ${target.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
    await sleep(delayMs);
  }

  console.log(JSON.stringify({ venuesSelected: selectedTargets.length, completed, failed, reviewsFetched, reviewsSaved, apiRequestsUsed }));
  await prisma.$disconnect();
  if (failed) process.exitCode = 1;
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
