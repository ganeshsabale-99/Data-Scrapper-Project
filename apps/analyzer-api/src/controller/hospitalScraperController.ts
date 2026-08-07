import { Request, Response } from "express";
import { getAllIndiaHospitals } from "../libs/getAllIndiaHospitals";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";
import { logOperationalEvent } from "../libs/serviceHealthLogger";
import { getActiveScrapeJob, startScrapeJob, completeScrapeJob, failScrapeJob } from "../libs/scrapeJobService";

const VENUE_TYPE = "hospital" as const;

export const triggerHospitalScrape = async (req: Request, res: Response) => {
  try {
    const activeJob = await getActiveScrapeJob(VENUE_TYPE);
    if (activeJob) {
      return res.status(409).json({
        success: false,
        message: "A hospital scrape is already in progress.",
        jobId: activeJob.id,
        startedAt: activeJob.startedAt,
      });
    }

    const testMode = Boolean(req.body?.testMode);
    const cityFilter = typeof req.body?.cityFilter === "string" && req.body.cityFilter.trim()
      ? req.body.cityFilter.trim()
      : undefined;

    const job = await startScrapeJob(VENUE_TYPE, { triggeredBy: req.user?.userId, testMode, cityFilter });

    logOperationalEvent("hospital.scrape.triggered", { jobId: job.id, triggeredBy: req.user?.userId, testMode, cityFilter });

    void getAllIndiaHospitals({ testMode, cityFilter })
      .then((result) => {
        void completeScrapeJob(job.id, result);
        logOperationalEvent("hospital.scrape.finished", { jobId: job.id, ...result });
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        void failScrapeJob(job.id, message);
        logOperationalEvent("hospital.scrape.background_failed", { jobId: job.id, error: message }, "warn");
      });

    return res.status(202).json({
      success: true,
      message: "Hospital scrape started in background.",
      jobId: job.id,
      startedAt: job.startedAt,
      testMode,
      cityFilter: cityFilter ?? null,
    });
  } catch (error) {
    return sendSafeErrorResponse(res, error, "hospitalScraper.triggerHospitalScrape", "Failed to trigger hospital scrape");
  }
};

export const getHospitalScrapeStatus = async (_req: Request, res: Response) => {
  try {
    const activeJob = await getActiveScrapeJob(VENUE_TYPE);
    return res.status(200).json({
      success: true,
      isRunning: Boolean(activeJob),
      jobId: activeJob?.id ?? null,
      lastStartedAt: activeJob?.startedAt ?? null,
    });
  } catch (error) {
    return sendSafeErrorResponse(res, error, "hospitalScraper.getHospitalScrapeStatus", "Failed to fetch hospital scrape status");
  }
};
