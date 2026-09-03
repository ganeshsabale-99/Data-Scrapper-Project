import axios from "axios";
import dotenv from "dotenv";
import path from "path";

dotenv.config();
if (!process.env.DATABASE_URL) dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

type Target = { type: "techpark" | "coworking"; id: string; name: string; city: string | null; state: string | null; website: string | null; totalRatings: number };
const args = process.argv.slice(2);
const value = (name: string) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const limit = Math.max(1, Number(value("--venue-limit") ?? 20));
const delayMs = Math.max(250, Number(value("--delay-ms") ?? 750));
const requestedType = (value("--type") ?? "all").toLowerCase();
if (!["all", "techpark", "coworking"].includes(requestedType)) throw new Error("--type must be all, techpark, or coworking");

const keywords = ["security", "facility", "facilities", "housekeeping", "property management", "maintenance", "contract", "tender", "vendor", "agency"];
const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const phoneRegex = /(?:\+91[-\s]?)?[6-9]\d{2}[-\s]?\d{3}[-\s]?\d{4}/;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const domainOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; } };
const score = (text: string, venueName: string) => {
  const lower = text.toLowerCase();
  const venueTokens = venueName.toLowerCase().split(/\W+/).filter((token) => token.length > 3);
  return Math.min(100, keywords.filter((keyword) => lower.includes(keyword)).length * 12 + venueTokens.filter((token) => lower.includes(token)).length * 8);
};
const categoryOf = (text: string) => {
  const lower = text.toLowerCase();
  if (lower.includes("security")) return "SECURITY";
  if (lower.includes("housekeeping")) return "HOUSEKEEPING";
  if (lower.includes("property management")) return "PROPERTY_MANAGEMENT";
  if (lower.includes("facility") || lower.includes("maintenance")) return "FACILITY_MANAGEMENT";
  if (lower.includes("tender") || lower.includes("contract")) return "CONTRACT_OR_TENDER";
  return "OTHER_SERVICE";
};

async function main() {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) throw new Error("SERPAPI_API_KEY is required");
  const { prismaInstance: prisma } = await import("@repo/db");
  const targets: Target[] = [];
  if (requestedType === "all" || requestedType === "techpark") {
    const rows = await prisma.newTechPark.findMany({ where: { is_active: true, do_not_call: false }, select: { id: true, name: true, city: true, state: true, website: true, total_ratings: true } });
    rows.forEach((row) => targets.push({ type: "techpark", id: row.id, name: row.name, city: row.city, state: row.state, website: row.website, totalRatings: row.total_ratings ?? 0 }));
  }
  if (requestedType === "all" || requestedType === "coworking") {
    const rows = await prisma.coworkingSpace.findMany({ where: { is_active: true, do_not_call: false }, select: { id: true, name: true, city: true, state: true, website: true, total_ratings: true } });
    rows.forEach((row) => targets.push({ type: "coworking", id: row.id, name: row.name, city: row.city, state: row.state, website: row.website, totalRatings: row.total_ratings ?? 0 }));
  }
  const searched = await prisma.venueProviderCandidate.findMany({ select: { venueType: true, venueId: true }, distinct: ["venueType", "venueId"] });
  const done = new Set(searched.map((row) => `${row.venueType}:${row.venueId}`));
  const selected = targets.filter((target) => !done.has(`${target.type}:${target.id}`)).sort((a, b) => b.totalRatings - a.totalRatings).slice(0, limit);
  let searches = 0, resultsFound = 0, stored = 0, failed = 0;

  for (const [index, target] of selected.entries()) {
    const query = `"${target.name}" "${target.city ?? ""}" (security agency OR facility management OR housekeeping OR property manager OR maintenance contract OR tender)`;
    try {
      const response = await axios.get("https://serpapi.com/search.json", { params: { engine: "google", q: query, location: "India", gl: "in", hl: "en", num: 10, api_key: apiKey }, timeout: 60_000 });
      searches++;
      const results = Array.isArray(response.data?.organic_results) ? response.data.organic_results : [];
      resultsFound += results.length;
      for (const result of results) {
        if (!result.link || !result.title) continue;
        const evidence = `${result.title} ${result.snippet ?? ""}`;
        await prisma.venueProviderCandidate.upsert({
          where: { venueType_venueId_sourceUrl: { venueType: target.type, venueId: target.id, sourceUrl: result.link } },
          update: { query, title: result.title, snippet: result.snippet, sourceDomain: domainOf(result.link), phone: evidence.match(phoneRegex)?.[0], email: evidence.match(emailRegex)?.[0], relevanceScore: score(evidence, target.name), category: categoryOf(evidence), rawData: result, fetchedAt: new Date() },
          create: { venueType: target.type, venueId: target.id, venueName: target.name, query, category: categoryOf(evidence), candidateName: result.title.split(/[|\-–—]/)[0]?.trim(), title: result.title, sourceUrl: result.link, sourceDomain: domainOf(result.link), snippet: result.snippet, phone: evidence.match(phoneRegex)?.[0], email: evidence.match(emailRegex)?.[0], relevanceScore: score(evidence, target.name), rawData: result },
        });
        stored++;
      }
      console.log(`[${index + 1}/${selected.length}] ${target.name}: ${results.length} candidates`);
    } catch (error: any) {
      failed++;
      console.error(`[${index + 1}/${selected.length}] ${target.name}: ${error.response?.data?.error ?? error.message}`);
    }
    await sleep(delayMs);
  }
  console.log(JSON.stringify({ venuesSelected: selected.length, searches, resultsFound, stored, failed }));
  await prisma.$disconnect();
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
