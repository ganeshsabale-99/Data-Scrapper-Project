import { Request, Response } from "express";
import { getAllIndiaMalls } from "../libs/getAllIndiaMalls";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";
import { logOperationalEvent } from "../libs/serviceHealthLogger";

let isMallScrapeRunning = false;
let currentJobId: string | null = null;
let lastJobStartedAt: string | null = null;

export const triggerMallScrape = async (req: Request, res: Response) => {
  try {
    if (isMallScrapeRunning) {
      return res.status(409).json({
        success: false,
        message: "A mall scrape is already in progress.",
        jobId: currentJobId,
        startedAt: lastJobStartedAt,
      });
    }

    const jobId = `mall-scrape-${Date.now()}`;
    isMallScrapeRunning = true;
    currentJobId = jobId;
    lastJobStartedAt = new Date().toISOString();

    const testMode = Boolean(req.body?.testMode);
    const cityFilter =
      typeof req.body?.cityFilter === "string" && req.body.cityFilter.trim()
        ? req.body.cityFilter.trim()
        : undefined;

    logOperationalEvent("mall.scrape.triggered", { jobId, triggeredBy: req.user?.userId, testMode, cityFilter });

    void getAllIndiaMalls({ testMode, cityFilter })
      .then(() => { logOperationalEvent("mall.scrape.finished", { jobId }); })
      .catch((error) => {
        logOperationalEvent(
          "mall.scrape.background_failed",
          { jobId, error: error instanceof Error ? error.message : String(error) },
          "warn",
        );
      })
      .finally(() => {
        isMallScrapeRunning = false;
        currentJobId = null;
      });

    return res.status(202).json({
      success: true,
      message: "Mall scrape started in background.",
      jobId,
      startedAt: lastJobStartedAt,
      testMode,
      cityFilter: cityFilter ?? null,
    });
  } catch (error) {
    isMallScrapeRunning = false;
    currentJobId = null;
    return sendSafeErrorResponse(res, error, "mallScraper.triggerMallScrape", "Failed to trigger mall scrape");
  }
};

export const getMallScrapeStatus = async (_req: Request, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      isRunning: isMallScrapeRunning,
      jobId: currentJobId,
      lastStartedAt: lastJobStartedAt,
    });
  } catch (error) {
    return sendSafeErrorResponse(res, error, "mallScraper.getMallScrapeStatus", "Failed to fetch mall scrape status");
  }
};
