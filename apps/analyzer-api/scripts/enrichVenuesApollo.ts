import axios from "axios";
import dotenv from "dotenv";
import path from "path";

dotenv.config();
if (!process.env.DATABASE_URL) dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

type VenueType = "techpark" | "coworking";
type Target = { type: VenueType; id: string; name: string; website: string; totalRatings: number; operatorName: string | null; phone: string | null };

const args = process.argv.slice(2);
const value = (name: string) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const requestedType = (value("--type") ?? "all").toLowerCase();
const venueLimit = Math.max(1, Number(value("--venue-limit") ?? 10));
const delayMs = Math.max(250, Number(value("--delay-ms") ?? 500));
if (!["all", "techpark", "coworking"].includes(requestedType)) throw new Error("--type must be all, techpark, or coworking");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const cleanPhone = (organization: any): string | null =>
  organization?.primary_phone?.sanitized_number ||
  organization?.primary_phone?.number ||
  organization?.sanitized_phone ||
  organization?.phone ||
  null;

async function main() {
  const apiKey = process.env.APOLLO_API_KEY?.trim();
  if (!apiKey) throw new Error("APOLLO_API_KEY is required");
  const { prismaInstance: prisma } = await import("@repo/db");
  const targets: Target[] = [];

  if (requestedType === "all" || requestedType === "techpark") {
    const rows = await prisma.newTechPark.findMany({
      where: { is_active: true, do_not_call: false, website: { not: null }, OR: [{ operator_name: null }, { reception_phone: null }] },
      select: { id: true, name: true, website: true, total_ratings: true, operator_name: true, reception_phone: true },
      orderBy: [{ total_ratings: "desc" }, { name: "asc" }],
    });
    for (const row of rows) if (row.website) targets.push({ type: "techpark", id: row.id, name: row.name, website: row.website, totalRatings: row.total_ratings ?? 0, operatorName: row.operator_name, phone: row.reception_phone });
  }
  if (requestedType === "all" || requestedType === "coworking") {
    const rows = await prisma.coworkingSpace.findMany({
      where: { is_active: true, do_not_call: false, website: { not: null }, OR: [{ operator_name: null }, { contact_phone: null }] },
      select: { id: true, name: true, website: true, total_ratings: true, operator_name: true, contact_phone: true },
      orderBy: [{ total_ratings: "desc" }, { name: "asc" }],
    });
    for (const row of rows) if (row.website) targets.push({ type: "coworking", id: row.id, name: row.name, website: row.website, totalRatings: row.total_ratings ?? 0, operatorName: row.operator_name, phone: row.contact_phone });
  }

  const selected = targets.sort((a, b) => b.totalRatings - a.totalRatings).slice(0, venueLimit);
  let matched = 0, updated = 0, failed = 0;
  console.log(`Apollo enrichment: ${selected.length} venue(s), credit limit=${venueLimit}`);

  for (const [index, target] of selected.entries()) {
    try {
      const response = await axios.get("https://api.apollo.io/api/v1/organizations/enrich", {
        params: { website: target.website, name: target.name },
        headers: { "x-api-key": apiKey, accept: "application/json" },
        timeout: 30_000,
      });
      const organization = response.data?.organization;
      if (!organization) {
        console.log(`[${index + 1}/${selected.length}] ${target.name}: no Apollo organization match`);
        continue;
      }
      matched++;
      const phone = cleanPhone(organization);
      const data = {
        ...(!target.operatorName && organization.name ? { operator_name: organization.name } : {}),
        ...(!target.phone && phone ? (target.type === "techpark" ? { reception_phone: phone } : { contact_phone: phone }) : {}),
      };
      if (Object.keys(data).length) {
        if (target.type === "techpark") await prisma.newTechPark.update({ where: { id: target.id }, data });
        else await prisma.coworkingSpace.update({ where: { id: target.id }, data });
        updated++;
      }
      console.log(`[${index + 1}/${selected.length}] ${target.name}: matched ${organization.name}; phone=${phone ? "found" : "not found"}`);
    } catch (error: any) {
      failed++;
      console.error(`[${index + 1}/${selected.length}] ${target.name}: ${error.response?.data?.message ?? error.message}`);
    }
    await sleep(delayMs);
  }

  console.log(JSON.stringify({ selected: selected.length, matched, updated, failed }));
  await prisma.$disconnect();
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
