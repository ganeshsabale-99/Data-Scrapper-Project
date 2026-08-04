import { Request, Response } from "express";
import { getAllIndiaStadiums } from "../libs/getAllIndiaStadiums";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";
import { logOperationalEvent } from "../libs/serviceHealthLogger";

let isStadiumScrapeRunning = false;
let currentJobId: string | null = null;
let lastJobStartedAt: string | null = null;

export const triggerStadiumScrape = async (req: Request, res: Response) => {
  try {
    if (isStadiumScrapeRunning) {
      return res.status(409).json({
        success: false,
        message: "A stadium scrape is already in progress.",
        jobId: currentJobId,
        startedAt: lastJobStartedAt,
      });
    }

    const jobId = `stadium-scrape-${Date.now()}`;
    isStadiumScrapeRunning = true;
    currentJobId = jobId;
    lastJobStartedAt = new Date().toISOString();

    const testMode = Boolean(req.body?.testMode);
    const cityFilter =
      typeof req.body?.cityFilter === "string" && req.body.cityFilter.trim()
        ? req.body.cityFilter.trim()
        : undefined;

    logOperationalEvent("stadium.scrape.triggered", { jobId, triggeredBy: req.user?.userId, testMode, cityFilter });

    void getAllIndiaStadiums({ testMode, cityFilter })
      .then(() => { logOperationalEvent("stadium.scrape.finished", { jobId }); })
      .catch((error) => {
        logOperationalEvent(
          "stadium.scrape.background_failed",
          { jobId, error: error instanceof Error ? error.message : String(error) },
          "warn",
        );
      })
      .finally(() => {
        isStadiumScrapeRunning = false;
        currentJobId = null;
      });

    return res.status(202).json({
      success: true,
      message: "Stadium scrape started in background.",
      jobId,
      startedAt: lastJobStartedAt,
      testMode,
      cityFilter: cityFilter ?? null,
    });
  } catch (error) {
    isStadiumScrapeRunning = false;
    currentJobId = null;
    return sendSafeErrorResponse(res, error, "stadiumScraper.triggerStadiumScrape", "Failed to trigger stadium scrape");
  }
};

export const getStadiumScrapeStatus = async (_req: Request, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      isRunning: isStadiumScrapeRunning,
      jobId: currentJobId,
      lastStartedAt: lastJobStartedAt,
    });
  } catch (error) {
    return sendSafeErrorResponse(res, error, "stadiumScraper.getStadiumScrapeStatus", "Failed to fetch stadium scrape status");
  }
};
