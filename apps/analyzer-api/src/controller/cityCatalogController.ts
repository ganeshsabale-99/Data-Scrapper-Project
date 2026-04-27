import { prismaInstance } from "@repo/db";
import type { Request, Response } from "express";
import { getQueryString } from "../utils/queryUtils";
import { INDIA_STATES_AND_UTS } from "../utils/indiaStates";
import { normalizeStateName, upsertCityCatalogEntry } from "../utils/cityCatalog";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";

const sendCityCatalogSafeError = (
  res: Response,
  error: unknown,
  context: string,
  fallbackMessage: string,
) =>
  sendSafeErrorResponse(
    res,
    error,
    `cityCatalog.${context}`,
    fallbackMessage,
  );

export const addCityToState = async (req: Request, res: Response) => {
  try {
    const stateParam = getQueryString(req.params.state);
    const cityRaw = typeof req.body?.city === "string" ? req.body.city : "";

    const stateTrimmed = (stateParam || "").trim();
    const cityTrimmed = cityRaw.trim();

    if (!stateTrimmed) {
      return res.status(400).json({ success: false, error: "State is required." });
    }
    if (!cityTrimmed) {
      return res.status(400).json({ success: false, error: "City is required." });
    }
    if (cityTrimmed.length < 2) {
      return res
        .status(400)
        .json({ success: false, error: "City must be at least 2 characters." });
    }

    const created = await upsertCityCatalogEntry(
      normalizeStateName(stateTrimmed),
      cityTrimmed,
    );

    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    return sendCityCatalogSafeError(
      res,
      error,
      "addCityToState",
      "Unable to save city mapping right now. Please try again.",
    );
  }
};

export const getStateByCity = async (req: Request, res: Response) => {
  try {
    const cityParam = getQueryString(req.params.city);
    const cityTrimmed = (cityParam || "").trim();

    if (!cityTrimmed) {
      return res.status(400).json({ success: false, error: "City is required." });
    }

    const matches = await prismaInstance.$queryRaw<
      Array<{ state: string; city: string; is_active: boolean }>
    >`
      SELECT state, city, is_active
      FROM "CityCatalog"
      WHERE LOWER(city) = LOWER(${cityTrimmed})
      ORDER BY is_active DESC, "updatedAt" DESC
      LIMIT 1
    `;

    const matchedCity = matches[0];

    if (!matchedCity) {
      return res.status(404).json({
        success: false,
        error: "No state mapping found for the provided city.",
      });
    }

    return res.status(200).json({
      success: true,
      data: matchedCity,
    });
  } catch (error: any) {
    return sendCityCatalogSafeError(
      res,
      error,
      "getStateByCity",
      "Unable to fetch city-to-state mapping right now. Please try again.",
    );
  }
};

export const getCityCatalogOptions = async (_req: Request, res: Response) => {
  try {
    const [catalogRows, techParkRows, coworkingRows] = await Promise.all([
      prismaInstance.cityCatalog.findMany({
        where: { is_active: true },
        select: { state: true, city: true },
      }),
      prismaInstance.newTechPark.findMany({
        where: {
          is_active: { not: false },
          state: { not: null },
          city: { not: null },
        },
        select: { state: true, city: true },
      }),
      prismaInstance.coworkingSpace.findMany({
        select: { state: true, city: true },
      }),
    ]);

    const cityBuckets: Record<string, Map<string, string>> = {};
    const addEntry = (stateRaw?: string | null, cityRaw?: string | null) => {
      const stateTrimmed = (stateRaw || "").trim();
      const cityTrimmed = (cityRaw || "").trim();
      if (!stateTrimmed || !cityTrimmed) return;

      const normalizedState = normalizeStateName(stateTrimmed);
      const cityKey = cityTrimmed.toLowerCase();
      const stateBucket = cityBuckets[normalizedState] ?? new Map<string, string>();
      if (!stateBucket.has(cityKey)) {
        stateBucket.set(cityKey, cityTrimmed);
      }
      cityBuckets[normalizedState] = stateBucket;
    };

    for (const row of catalogRows) addEntry(row.state, row.city);
    for (const row of techParkRows) addEntry(row.state, row.city);
    for (const row of coworkingRows) addEntry(row.state, row.city);

    const citiesByStateFromData: Record<string, string[]> = {};
    for (const [state, cityMap] of Object.entries(cityBuckets)) {
      citiesByStateFromData[state] = Array.from(cityMap.values()).sort((a, b) =>
        a.localeCompare(b),
      );
    }

    const canonicalStates: string[] = [...INDIA_STATES_AND_UTS];
    const canonicalSet = new Set<string>(canonicalStates);
    const extraStates = Object.keys(citiesByStateFromData)
      .filter((state) => !canonicalSet.has(state))
      .sort((a, b) => a.localeCompare(b));

    const states = [...canonicalStates, ...extraStates];
    const citiesByState: Record<string, string[]> = {};

    for (const state of states) {
      citiesByState[state] = citiesByStateFromData[state] ?? [];
    }

    return res.status(200).json({
      success: true,
      data: {
        states,
        citiesByState,
      },
    });
  } catch (error: any) {
    return sendCityCatalogSafeError(
      res,
      error,
      "getCityCatalogOptions",
      "Unable to fetch location options right now. Please try again.",
    );
  }
};
