import { Request, Response } from "express";
import { getAllIndiaTechParks } from "../libs/getAllIndiaTechParks";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";
import { logOperationalEvent } from "../libs/serviceHealthLogger";

let isTechParkScrapeRunning = false;
let currentJobId: string | null = null;
let lastJobStartedAt: string | null = null;

export const triggerTechParkScrape = async (req: Request, res: Response) => {
  try {
    if (isTechParkScrapeRunning) {
      return res.status(409).json({
        success: false,
        message: "A tech park scrape is already in progress.",
        jobId: currentJobId,
        startedAt: lastJobStartedAt,
      });
    }

    const jobId = `techpark-scrape-${Date.now()}`;
    isTechParkScrapeRunning = true;
    currentJobId = jobId;
    lastJobStartedAt = new Date().toISOString();

    const testMode = Boolean(req.body?.testMode);
    const cityFilter = typeof req.body?.cityFilter === "string" && req.body.cityFilter.trim()
      ? req.body.cityFilter.trim()
      : undefined;

    logOperationalEvent("techpark.scrape.triggered", { jobId, triggeredBy: req.user?.userId, testMode, cityFilter });

    void getAllIndiaTechParks({ testMode, cityFilter })
      .then(() => {
        logOperationalEvent("techpark.scrape.finished", { jobId });
      })
      .catch((error) => {
        logOperationalEvent(
          "techpark.scrape.background_failed",
          { jobId, error: error instanceof Error ? error.message : String(error) },
          "warn",
        );
      })
      .finally(() => {
        isTechParkScrapeRunning = false;
        currentJobId = null;
      });

    return res.status(202).json({
      success: true,
      message: "Tech park scrape started in background.",
      jobId,
      startedAt: lastJobStartedAt,
      testMode,
      cityFilter: cityFilter ?? null,
    });
  } catch (error) {
    isTechParkScrapeRunning = false;
    currentJobId = null;
    return sendSafeErrorResponse(res, error, "techParkScraper.triggerTechParkScrape", "Failed to trigger tech park scrape");
  }
};

export const getTechParkScrapeStatus = async (_req: Request, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      isRunning: isTechParkScrapeRunning,
      jobId: currentJobId,
      lastStartedAt: lastJobStartedAt,
    });
  } catch (error) {
    return sendSafeErrorResponse(res, error, "techParkScraper.getTechParkScrapeStatus", "Failed to fetch tech park scrape status");
  }
};
