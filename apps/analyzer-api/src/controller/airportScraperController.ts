import { Request, Response } from "express";
import { getAllIndiaAirports } from "../libs/getAllIndiaAirports";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";
import { logOperationalEvent } from "../libs/serviceHealthLogger";

let isAirportScrapeRunning = false;
let currentJobId: string | null = null;
let lastJobStartedAt: string | null = null;

export const triggerAirportScrape = async (req: Request, res: Response) => {
  try {
    if (isAirportScrapeRunning) {
      return res.status(409).json({
        success: false,
        message: "An airport scrape is already in progress.",
        jobId: currentJobId,
        startedAt: lastJobStartedAt,
      });
    }

    const jobId = `airport-scrape-${Date.now()}`;
    isAirportScrapeRunning = true;
    currentJobId = jobId;
    lastJobStartedAt = new Date().toISOString();

    const testMode = Boolean(req.body?.testMode);
    const cityFilter =
      typeof req.body?.cityFilter === "string" && req.body.cityFilter.trim()
        ? req.body.cityFilter.trim()
        : undefined;

    logOperationalEvent("airport.scrape.triggered", { jobId, triggeredBy: req.user?.userId, testMode, cityFilter });

    void getAllIndiaAirports({ testMode, cityFilter })
      .then(() => { logOperationalEvent("airport.scrape.finished", { jobId }); })
      .catch((error) => {
        logOperationalEvent(
          "airport.scrape.background_failed",
          { jobId, error: error instanceof Error ? error.message : String(error) },
          "warn",
        );
      })
      .finally(() => {
        isAirportScrapeRunning = false;
        currentJobId = null;
      });

    return res.status(202).json({
      success: true,
      message: "Airport scrape started in background.",
      jobId,
      startedAt: lastJobStartedAt,
      testMode,
      cityFilter: cityFilter ?? null,
    });
  } catch (error) {
    isAirportScrapeRunning = false;
    currentJobId = null;
    return sendSafeErrorResponse(res, error, "airportScraper.triggerAirportScrape", "Failed to trigger airport scrape");
  }
};

export const getAirportScrapeStatus = async (_req: Request, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      isRunning: isAirportScrapeRunning,
      jobId: currentJobId,
      lastStartedAt: lastJobStartedAt,
    });
  } catch (error) {
    return sendSafeErrorResponse(res, error, "airportScraper.getAirportScrapeStatus", "Failed to fetch airport scrape status");
  }
};
