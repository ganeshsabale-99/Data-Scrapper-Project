import cron from "node-cron";
import { getAllIndiaCoworkingSpaces } from "./getAllIndiaCoworkingSpaces";
import { getAllIndiaTechParks } from "./getAllIndiaTechParks";
import { getAllIndiaMalls } from "./getAllIndiaMalls";
import { getAllIndiaHospitals } from "./getAllIndiaHospitals";
import { getAllIndiaStadiums } from "./getAllIndiaStadiums";
import { getAllIndiaAirports } from "./getAllIndiaAirports";
import { logOperationalEvent } from "./serviceHealthLogger";

let isScrapeRunning = false;

// Runs all 6 venue scrapers sequentially so Google API rate limits aren't exceeded.
const runAllScrapers = async () => {
  if (isScrapeRunning) {
    logOperationalEvent("scrapeScheduler.skipped", { reason: "previous run still in progress" }, "warn");
    return;
  }

  isScrapeRunning = true;
  const startedAt = new Date().toISOString();
  logOperationalEvent("scrapeScheduler.started", { startedAt });
  console.log(`[ScrapeScheduler] Full scrape started at ${startedAt}`);

  const scrapers: Array<{ name: string; fn: () => Promise<void> }> = [
    { name: "techParks",       fn: () => getAllIndiaTechParks() },
    { name: "coworkingSpaces", fn: () => getAllIndiaCoworkingSpaces() },
    { name: "malls",           fn: () => getAllIndiaMalls() },
    { name: "hospitals",       fn: () => getAllIndiaHospitals() },
    { name: "stadiums",        fn: () => getAllIndiaStadiums() },
    { name: "airports",        fn: () => getAllIndiaAirports() },
  ];

  for (const { name, fn } of scrapers) {
    console.log(`[ScrapeScheduler] Starting: ${name}`);
    try {
      await fn();
      logOperationalEvent(`scrapeScheduler.${name}.completed`, {});
      console.log(`[ScrapeScheduler] Finished: ${name}`);
    } catch (error) {
      logOperationalEvent(
        `scrapeScheduler.${name}.failed`,
        { error: error instanceof Error ? error.message : String(error) },
        "warn",
      );
      console.error(`[ScrapeScheduler] Failed: ${name}`, error);
    }
  }

  isScrapeRunning = false;
  const finishedAt = new Date().toISOString();
  logOperationalEvent("scrapeScheduler.completed", { startedAt, finishedAt });
  console.log(`[ScrapeScheduler] All scrapers done at ${finishedAt}`);
};

export const startScrapeScheduler = () => {
  if (!process.env.GOOGLE_API_KEY) {
    console.warn("[ScrapeScheduler] GOOGLE_API_KEY not set — scrape scheduler disabled.");
    return;
  }

  // Default: every Sunday at 2:00 AM IST
  // Override via SCRAPE_CRON env var e.g. "0 2 * * 0"
  const cronExpr = process.env.SCRAPE_CRON ?? "0 2 * * 0";

  if (!cron.validate(cronExpr)) {
    console.error(`[ScrapeScheduler] Invalid SCRAPE_CRON expression: "${cronExpr}"`);
    return;
  }

  cron.schedule(cronExpr, () => {
    void runAllScrapers();
  }, { timezone: "Asia/Kolkata" });

  console.log(`[ScrapeScheduler] Scheduled — cron: "${cronExpr}" (Asia/Kolkata). Next run: Sunday 2:00 AM IST.`);
  logOperationalEvent("scrapeScheduler.registered", { cronExpr });
};

export const triggerManualScrape = async () => {
  await runAllScrapers();
};
