import { prismaInstance } from "@repo/db";

// No real scrape should take longer than this; a RUNNING job older than the
// threshold means the process almost certainly crashed/restarted mid-run.
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

export type VenueTypeKey =
  | "techPark"
  | "coworkingSpace"
  | "mall"
  | "hospital"
  | "stadium"
  | "airport"
  | "fundingNews";

async function reapStaleJobs(venueType: VenueTypeKey): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);
  await prismaInstance.scrapeJob.updateMany({
    where: { venueType, status: "RUNNING", startedAt: { lt: cutoff } },
    data: {
      status: "FAILED",
      errorMessage: "Marked stale — no completion recorded within 2 hours (likely a process restart mid-run).",
      finishedAt: new Date(),
    },
  });
}

// Returns the currently-running job for this venue type, if any, after first
// reaping anything that's been "running" long enough to be considered stale.
// This is the shared lock: the scheduler and every manual trigger call this
// before starting, so they can't double-run against each other or a crash.
export async function getActiveScrapeJob(venueType: VenueTypeKey) {
  await reapStaleJobs(venueType);
  return prismaInstance.scrapeJob.findFirst({
    where: { venueType, status: "RUNNING" },
    orderBy: { startedAt: "desc" },
  });
}

export async function startScrapeJob(
  venueType: VenueTypeKey,
  opts: { triggeredBy?: string | null; testMode?: boolean; cityFilter?: string | null } = {},
) {
  return prismaInstance.scrapeJob.create({
    data: {
      venueType,
      triggeredBy: opts.triggeredBy ?? null,
      testMode: opts.testMode ?? false,
      cityFilter: opts.cityFilter ?? null,
    },
  });
}

export async function completeScrapeJob(
  jobId: string,
  result: { totalFound?: number; saved?: number; skipped?: number; failed?: number } = {},
) {
  return prismaInstance.scrapeJob.update({
    where: { id: jobId },
    data: { status: "COMPLETED", finishedAt: new Date(), ...result },
  });
}

export async function failScrapeJob(jobId: string, errorMessage: string) {
  return prismaInstance.scrapeJob.update({
    where: { id: jobId },
    data: { status: "FAILED", finishedAt: new Date(), errorMessage: errorMessage.slice(0, 2000) },
  });
}

export async function getRecentScrapeJobs(venueType?: VenueTypeKey, take = 20) {
  return prismaInstance.scrapeJob.findMany({
    where: venueType ? { venueType } : undefined,
    orderBy: { startedAt: "desc" },
    take: Math.min(100, take),
  });
}
