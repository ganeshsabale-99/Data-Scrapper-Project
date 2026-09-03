import crypto from "crypto";
import dotenv from "dotenv";
import path from "path";
import axios from "axios";
import { scoreReviewIssues } from "../src/utils/reviewIssuePriority";

dotenv.config();
if (!process.env.DATABASE_URL) dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

type VenueType = "techpark" | "coworking" | "mall" | "hospital" | "stadium" | "airport";
type Target = { venueType: VenueType; venueId: string; placeId: string | null; name: string; city: string | null; state: string | null; mapUrl: string | null };
type CollectedReview = { id?: string; author?: string; authorImage?: string; rating?: number; text?: string; publishedAt?: string; relativeTime?: string };

const args = process.argv.slice(2);
const arg = (name: string) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const requestedType = (arg("--type") ?? "all").toLowerCase();
const city = arg("--city");
const venueLimit = Math.max(0, Number(arg("--venue-limit") ?? 0));
const reviewsLimit = Math.max(1, Number(arg("--reviews-limit") ?? 1000));
const delayMs = Math.max(100, Number(arg("--delay-ms") ?? 500));
const validTypes = new Set(["all", "techpark", "coworking", "mall", "hospital", "stadium", "airport"]);
if (!validTypes.has(requestedType)) throw new Error(`Invalid --type "${requestedType}"`);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const hash = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

async function collectOutscraper(query: string): Promise<CollectedReview[]> {
  const key = process.env.OUTSCRAPER_API_KEY?.trim();
  if (!key) throw new Error("OUTSCRAPER_API_KEY is required for full review collection");
  const response = await axios.get("https://api.app.outscraper.com/maps/reviews-v3", {
    params: { query, limit: reviewsLimit, language: "en", async: false, sort: "newest" },
    headers: { "X-API-KEY": key },
    timeout: 120_000,
  });
  const place = response.data?.data?.[0]?.[0];
  return (place?.reviews_data ?? []).map((review: any) => ({
    id: review.reviews_id,
    author: review.author_title,
    authorImage: review.author_image,
    rating: review.review_rating,
    text: review.review_text,
    publishedAt: review.review_datetime_utc,
    relativeTime: review.review_timestamp ? undefined : review.review_datetime_utc,
  }));
}

async function main() {
  if (!process.env.OUTSCRAPER_API_KEY?.trim()) {
    throw new Error("OUTSCRAPER_API_KEY is required for full review collection. Google Places is limited to five reviews per place.");
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
      select: { id: true, name: true, city: true, state: true, map_url: true, ...(spec.placeField ? { [spec.placeField]: true } : {}) },
      orderBy: { updatedAt: "desc" },
      ...(venueLimit ? { take: venueLimit } : {}),
    });
    for (const row of rows) targets.push({ venueType: spec.type, venueId: row.id, placeId: spec.placeField ? row[spec.placeField] : null, name: row.name, city: row.city, state: row.state, mapUrl: row.map_url });
  }

  console.log(`Review scraper: ${targets.length} venue(s), provider=Outscraper, review limit=${reviewsLimit}`);
  let completed = 0, failed = 0, reviewsFetched = 0, reviewsSaved = 0;

  for (const target of targets) {
    try {
      const query = target.mapUrl || `${target.name}, ${target.city ?? ""}, ${target.state ?? ""}`;
      const reviews = await collectOutscraper(query);
      reviewsFetched += reviews.length;
      const fetchedAt = new Date();

      for (const review of reviews) {
        const sourceReviewId = review.id || hash(`${target.venueType}|${target.venueId}|${review.author ?? ""}|${review.publishedAt ?? ""}|${review.text ?? ""}`);
        const analysis = scoreReviewIssues([{ text: review.text, rating: review.rating, time: review.publishedAt ? Date.parse(review.publishedAt) / 1000 : undefined }]);
        await prisma.venueReview.upsert({
          where: { provider_sourceReviewId: { provider: "OUTSCRAPER", sourceReviewId } },
          update: { venueType: target.venueType, venueId: target.venueId, placeId: target.placeId, authorName: review.author, authorImageUrl: review.authorImage, rating: review.rating, text: review.text, publishedAt: review.publishedAt ? new Date(review.publishedAt) : null, relativeTime: review.relativeTime, issueScore: analysis.score, issueCategories: analysis.categories, isParkingRelated: analysis.parkingReviewCount > 0, fetchedAt },
          create: { venueType: target.venueType, venueId: target.venueId, placeId: target.placeId, provider: "OUTSCRAPER", sourceReviewId, authorName: review.author, authorImageUrl: review.authorImage, rating: review.rating, text: review.text, publishedAt: review.publishedAt ? new Date(review.publishedAt) : null, relativeTime: review.relativeTime, issueScore: analysis.score, issueCategories: analysis.categories, isParkingRelated: analysis.parkingReviewCount > 0, fetchedAt },
        });
        reviewsSaved++;
      }

      const stored = await prisma.venueReview.findMany({ where: { venueType: target.venueType, venueId: target.venueId }, select: { text: true, rating: true, publishedAt: true } });
      const aggregate = scoreReviewIssues(stored.map((review) => ({ text: review.text ?? undefined, rating: review.rating ?? undefined, time: review.publishedAt ? review.publishedAt.getTime() / 1000 : undefined })));
      const spec = specs.find((entry) => entry.type === target.venueType)!;
      await spec.model.update({ where: { id: target.venueId }, data: { review_issue_score: aggregate.score, review_priority: aggregate.priority, review_issue_categories: aggregate.categories, review_issue_summary: aggregate.summary, review_evidence: aggregate.evidence, reviews_analyzed: aggregate.reviewsAnalyzed, issue_review_count: aggregate.issueReviewCount, parking_review_count: aggregate.parkingReviewCount, review_analyzed_at: fetchedAt } });
      completed++;
      console.log(`[${completed + failed}/${targets.length}] ${target.venueType}: ${target.name} — fetched ${reviews.length}, stored total ${stored.length}, ${aggregate.priority} (${aggregate.score})`);
    } catch (error) {
      failed++;
      console.error(`[${completed + failed}/${targets.length}] ${target.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
    await sleep(delayMs);
  }

  console.log(JSON.stringify({ venues: targets.length, completed, failed, reviewsFetched, reviewsSaved }));
  await prisma.$disconnect();
  if (failed) process.exitCode = 1;
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
