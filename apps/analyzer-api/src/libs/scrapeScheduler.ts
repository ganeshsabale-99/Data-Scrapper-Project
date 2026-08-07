import cron from "node-cron";
import { getAllIndiaCoworkingSpaces } from "./getAllIndiaCoworkingSpaces";
import { getAllIndiaTechParks } from "./getAllIndiaTechParks";
import { getAllIndiaMalls } from "./getAllIndiaMalls";
import { getAllIndiaHospitals } from "./getAllIndiaHospitals";
import { getAllIndiaStadiums } from "./getAllIndiaStadiums";
import { getAllIndiaAirports } from "./getAllIndiaAirports";
import { logOperationalEvent } from "./serviceHealthLogger";
import {
  getActiveScrapeJob,
  startScrapeJob,
  completeScrapeJob,
  failScrapeJob,
  type VenueTypeKey,
} from "./scrapeJobService";

const SCRAPERS: Array<{ name: VenueTypeKey; fn: () => Promise<{ totalFound?: number; saved?: number; skipped?: number; failed?: number } | void> }> = [
  { name: "techPark",       fn: () => getAllIndiaTechParks() },
  { name: "coworkingSpace", fn: () => getAllIndiaCoworkingSpaces() },
  { name: "mall",           fn: () => getAllIndiaMalls() },
  { name: "hospital",       fn: () => getAllIndiaHospitals() },
  { name: "stadium",        fn: () => getAllIndiaStadiums() },
  { name: "airport",        fn: () => getAllIndiaAirports() },
];

// Runs all 6 venue scrapers sequentially so Google API rate limits aren't exceeded.
// Each venue type goes through the same DB-backed lock (scrapeJobService) that manual
// triggers use, so a scheduled run and a manual trigger for the same type can never
// run concurrently — one will just see the other's job as active and skip.
const runAllScrapers = async (triggeredBy: string) => {
  const startedAt = new Date().toISOString();
  logOperationalEvent("scrapeScheduler.started", { startedAt, triggeredBy });
  console.log(`[ScrapeScheduler] Full scrape started at ${startedAt}`);

  for (const { name, fn } of SCRAPERS) {
    const activeJob = await getActiveScrapeJob(name);
    if (activeJob) {
      logOperationalEvent(`scrapeScheduler.${name}.skipped`, { reason: "already running", jobId: activeJob.id }, "warn");
      console.warn(`[ScrapeScheduler] Skipping ${name} — already running (job ${activeJob.id})`);
      continue;
    }

    const job = await startScrapeJob(name, { triggeredBy });
    console.log(`[ScrapeScheduler] Starting: ${name}`);
    try {
      const result = (await fn()) || undefined;
      await completeScrapeJob(job.id, result ?? {});
      logOperationalEvent(`scrapeScheduler.${name}.completed`, { jobId: job.id, ...result });
      console.log(`[ScrapeScheduler] Finished: ${name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await failScrapeJob(job.id, message);
      logOperationalEvent(`scrapeScheduler.${name}.failed`, { jobId: job.id, error: message }, "warn");
      console.error(`[ScrapeScheduler] Failed: ${name}`, error);
    }
  }

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
    void runAllScrapers("scheduler");
  }, { timezone: "Asia/Kolkata" });

  console.log(`[ScrapeScheduler] Scheduled — cron: "${cronExpr}" (Asia/Kolkata). Next run: Sunday 2:00 AM IST.`);
  logOperationalEvent("scrapeScheduler.registered", { cronExpr });
};

export const triggerManualScrape = async (triggeredBy = "manual") => {
  await runAllScrapers(triggeredBy);
};
