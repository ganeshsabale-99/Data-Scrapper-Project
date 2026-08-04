import { Request, Response } from "express";
import { getAllIndiaHospitals } from "../libs/getAllIndiaHospitals";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";
import { logOperationalEvent } from "../libs/serviceHealthLogger";

let isHospitalScrapeRunning = false;
let currentJobId: string | null = null;
let lastJobStartedAt: string | null = null;

export const triggerHospitalScrape = async (req: Request, res: Response) => {
  try {
    if (isHospitalScrapeRunning) {
      return res.status(409).json({
        success: false,
        message: "A hospital scrape is already in progress.",
        jobId: currentJobId,
        startedAt: lastJobStartedAt,
      });
    }

    const jobId = `hospital-scrape-${Date.now()}`;
    isHospitalScrapeRunning = true;
    currentJobId = jobId;
    lastJobStartedAt = new Date().toISOString();

    const testMode = Boolean(req.body?.testMode);
    const cityFilter =
      typeof req.body?.cityFilter === "string" && req.body.cityFilter.trim()
        ? req.body.cityFilter.trim()
        : undefined;

    logOperationalEvent("hospital.scrape.triggered", { jobId, triggeredBy: req.user?.userId, testMode, cityFilter });

    void getAllIndiaHospitals({ testMode, cityFilter })
      .then(() => { logOperationalEvent("hospital.scrape.finished", { jobId }); })
      .catch((error) => {
        logOperationalEvent(
          "hospital.scrape.background_failed",
          { jobId, error: error instanceof Error ? error.message : String(error) },
          "warn",
        );
      })
      .finally(() => {
        isHospitalScrapeRunning = false;
        currentJobId = null;
      });

    return res.status(202).json({
      success: true,
      message: "Hospital scrape started in background.",
      jobId,
      startedAt: lastJobStartedAt,
      testMode,
      cityFilter: cityFilter ?? null,
    });
  } catch (error) {
    isHospitalScrapeRunning = false;
    currentJobId = null;
    return sendSafeErrorResponse(res, error, "hospitalScraper.triggerHospitalScrape", "Failed to trigger hospital scrape");
  }
};

export const getHospitalScrapeStatus = async (_req: Request, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      isRunning: isHospitalScrapeRunning,
      jobId: currentJobId,
      lastStartedAt: lastJobStartedAt,
    });
  } catch (error) {
    return sendSafeErrorResponse(res, error, "hospitalScraper.getHospitalScrapeStatus", "Failed to fetch hospital scrape status");
  }
};
