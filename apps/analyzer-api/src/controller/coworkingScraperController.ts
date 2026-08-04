import { Request, Response } from "express";
import { getAllIndiaCoworkingSpaces } from "../libs/getAllIndiaCoworkingSpaces";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";
import { logOperationalEvent } from "../libs/serviceHealthLogger";

let isCoworkingScrapeRunning = false;
let currentJobId: string | null = null;
let lastJobStartedAt: string | null = null;

export const triggerCoworkingScrape = async (req: Request, res: Response) => {
  try {
    if (isCoworkingScrapeRunning) {
      return res.status(409).json({
        success: false,
        message: "A coworking scrape is already in progress.",
        jobId: currentJobId,
        startedAt: lastJobStartedAt,
      });
    }

    const jobId = `coworking-scrape-${Date.now()}`;
    isCoworkingScrapeRunning = true;
    currentJobId = jobId;
    lastJobStartedAt = new Date().toISOString();

    const testMode = Boolean(req.body?.testMode);
    const cityFilter = typeof req.body?.cityFilter === "string" && req.body.cityFilter.trim()
      ? req.body.cityFilter.trim()
      : undefined;

    logOperationalEvent("coworking.scrape.triggered", { jobId, triggeredBy: req.user?.userId, testMode, cityFilter });

    void getAllIndiaCoworkingSpaces({ testMode, cityFilter })
      .then(() => {
        logOperationalEvent("coworking.scrape.finished", { jobId });
      })
      .catch((error) => {
        logOperationalEvent(
          "coworking.scrape.background_failed",
          { jobId, error: error instanceof Error ? error.message : String(error) },
          "warn",
        );
      })
      .finally(() => {
        isCoworkingScrapeRunning = false;
        currentJobId = null;
      });

    return res.status(202).json({
      success: true,
      message: "Coworking scrape started in background.",
      jobId,
      startedAt: lastJobStartedAt,
      testMode,
      cityFilter: cityFilter ?? null,
    });
  } catch (error) {
    isCoworkingScrapeRunning = false;
    currentJobId = null;
    return sendSafeErrorResponse(res, error, "coworkingScraper.triggerCoworkingScrape", "Failed to trigger coworking scrape");
  }
};

export const getCoworkingScrapeStatus = async (_req: Request, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      isRunning: isCoworkingScrapeRunning,
      jobId: currentJobId,
      lastStartedAt: lastJobStartedAt,
    });
  } catch (error) {
    return sendSafeErrorResponse(res, error, "coworkingScraper.getCoworkingScrapeStatus", "Failed to fetch coworking scrape status");
  }
};
