import dotenv from "dotenv";
import path from "path";
import { prismaInstance } from "@repo/db";
import { getAllIndiaAirports } from "../src/libs/getAllIndiaAirports";

dotenv.config();
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
}
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
}
if (!process.env.GOOGLE_API_KEY) {
  dotenv.config({ path: path.resolve(process.cwd(), "apps/analyzer-api/.env") });
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
}

const args = process.argv.slice(2);
const testMode = args.includes("--test");
const cityFlagIndex = args.indexOf("--city");
const cityFilter = cityFlagIndex !== -1 ? args[cityFlagIndex + 1] : undefined;

if (!process.env.GOOGLE_API_KEY) {
  console.error("Error: GOOGLE_API_KEY is not set. Please set it in your .env file.");
  process.exit(1);
}

async function main() {
  console.log("--- AIRPORTS SCRAPER ---");
  if (testMode) {
    console.log("Mode: TEST (Bengaluru / Koramangala only)");
  } else if (cityFilter) {
    console.log(`Mode: SINGLE CITY — ${cityFilter}`);
  } else {
    console.log("Mode: ALL 25 CITIES");
  }
  console.log("");
  await prismaInstance.$connect();
  await getAllIndiaAirports({ testMode, cityFilter });
}

main()
  .then(() => { console.log("\nScrape finished successfully."); process.exit(0); })
  .catch((error) => { console.error("Airport scrape failed:", error instanceof Error ? error.message : String(error)); process.exit(1); })
  .finally(async () => { await prismaInstance.$disconnect(); });
