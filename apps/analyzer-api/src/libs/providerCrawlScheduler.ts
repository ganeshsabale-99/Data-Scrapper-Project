import cron from "node-cron";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { logOperationalEvent } from "./serviceHealthLogger";
import { parseBooleanEnv } from "../utils/envUtils";
import axios from "axios";

const execFileAsync = promisify(execFile);
let running = false;

async function runProviderCrawl() {
  if (running) {
    logOperationalEvent("provider_crawl.skipped", { reason: "already_running" }, "warn");
    return;
  }
  running = true;
  const configuredLimit = Math.max(1, Number(process.env.PROVIDER_CRAWLER_VENUE_LIMIT ?? 10));
  try {
    const account = await axios.get("https://serpapi.com/account.json", { params: { api_key: process.env.SERPAPI_API_KEY }, timeout: 15_000 });
    const searchesLeft = Number(account.data?.total_searches_left ?? account.data?.searches_left ?? 0);
    const reserve = Math.max(0, Number(process.env.PROVIDER_CRAWLER_CREDIT_RESERVE ?? 10));
    const allowed = Math.min(configuredLimit, Math.max(0, searchesLeft - reserve));
    if (allowed === 0) {
      logOperationalEvent("provider_crawl.skipped", { reason: "credit_reserve_reached", searchesLeft, reserve }, "warn");
      return;
    }
    const venueLimit = String(allowed);
    const { stdout, stderr } = await execFileAsync(
      "pnpm",
      ["run", "crawl:venue-providers", "--venue-limit", venueLimit, "--delay-ms", "750"],
      { cwd: process.cwd(), timeout: 30 * 60 * 1000, maxBuffer: 2 * 1024 * 1024 },
    );
    logOperationalEvent("provider_crawl.completed", { venueLimit, searchesLeftBeforeRun: searchesLeft, output: stdout.trim().split("\n").at(-1), warnings: stderr.trim() || undefined });
  } catch (error) {
    logOperationalEvent("provider_crawl.failed", { error: error instanceof Error ? error.message : String(error) }, "error");
  } finally {
    running = false;
  }
}

export function startProviderCrawlScheduler() {
  if (!process.env.SERPAPI_API_KEY?.trim()) {
    logOperationalEvent("provider_crawl.disabled", { reason: "SERPAPI_API_KEY_missing" }, "warn");
    return;
  }
  if (!parseBooleanEnv(process.env.PROVIDER_CRAWLER_ENABLED, true)) {
    logOperationalEvent("provider_crawl.disabled", { reason: "PROVIDER_CRAWLER_ENABLED=false" });
    return;
  }
  const cronExpression = process.env.PROVIDER_CRAWLER_CRON?.trim() || "30 2 * * *";
  cron.schedule(cronExpression, () => { void runProviderCrawl(); }, { timezone: "Asia/Kolkata", noOverlap: true });
  logOperationalEvent("provider_crawl.scheduled", { cronExpression, timezone: "Asia/Kolkata", venueLimit: Number(process.env.PROVIDER_CRAWLER_VENUE_LIMIT ?? 10) });
  if (parseBooleanEnv(process.env.PROVIDER_CRAWLER_RUN_ON_STARTUP, false)) void runProviderCrawl();
}
