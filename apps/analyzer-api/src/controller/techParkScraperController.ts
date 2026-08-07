import { Request, Response } from "express";
import { getAllIndiaTechParks } from "../libs/getAllIndiaTechParks";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";
import { logOperationalEvent } from "../libs/serviceHealthLogger";
import { getActiveScrapeJob, startScrapeJob, completeScrapeJob, failScrapeJob } from "../libs/scrapeJobService";

const VENUE_TYPE = "techPark" as const;

export const triggerTechParkScrape = async (req: Request, res: Response) => {
  try {
    const activeJob = await getActiveScrapeJob(VENUE_TYPE);
    if (activeJob) {
      return res.status(409).json({
        success: false,
        message: "A tech park scrape is already in progress.",
        jobId: activeJob.id,
        startedAt: activeJob.startedAt,
      });
    }

    const testMode = Boolean(req.body?.testMode);
    const cityFilter = typeof req.body?.cityFilter === "string" && req.body.cityFilter.trim()
      ? req.body.cityFilter.trim()
      : undefined;

    const job = await startScrapeJob(VENUE_TYPE, { triggeredBy: req.user?.userId, testMode, cityFilter });

    logOperationalEvent("techpark.scrape.triggered", { jobId: job.id, triggeredBy: req.user?.userId, testMode, cityFilter });

    void getAllIndiaTechParks({ testMode, cityFilter })
      .then(() => {
        void completeScrapeJob(job.id);
        logOperationalEvent("techpark.scrape.finished", { jobId: job.id });
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        void failScrapeJob(job.id, message);
        logOperationalEvent("techpark.scrape.background_failed", { jobId: job.id, error: message }, "warn");
      });

    return res.status(202).json({
      success: true,
      message: "Tech park scrape started in background.",
      jobId: job.id,
      startedAt: job.startedAt,
      testMode,
      cityFilter: cityFilter ?? null,
    });
  } catch (error) {
    return sendSafeErrorResponse(res, error, "techParkScraper.triggerTechParkScrape", "Failed to trigger tech park scrape");
  }
};

export const getTechParkScrapeStatus = async (_req: Request, res: Response) => {
  try {
    const activeJob = await getActiveScrapeJob(VENUE_TYPE);
    return res.status(200).json({
      success: true,
      isRunning: Boolean(activeJob),
      jobId: activeJob?.id ?? null,
      lastStartedAt: activeJob?.startedAt ?? null,
    });
  } catch (error) {
    return sendSafeErrorResponse(res, error, "techParkScraper.getTechParkScrapeStatus", "Failed to fetch tech park scrape status");
  }
};
