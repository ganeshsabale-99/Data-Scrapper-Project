import { Request, Response } from "express";
import { prismaInstance } from "@repo/db";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";

export const getNationalOverview = async (_req: Request, res: Response) => {
  try {
    const [
      techParksCount,
      coworkingCount,
      mallsCount,
      hospitalsCount,
      stadiumsCount,
      airportsCount,
      techParksStatus,
      coworkingStatus,
      mallsStatus,
      hospitalsStatus,
      stadiumsStatus,
      airportsStatus,
    ] = await Promise.all([
      prismaInstance.newTechPark.count({ where: { is_active: true } }),
      prismaInstance.coworkingSpace.count(),
      prismaInstance.mall.count({ where: { is_active: true } }),
      prismaInstance.hospital.count({ where: { is_active: true } }),
      prismaInstance.stadium.count({ where: { is_active: true } }),
      prismaInstance.airport.count({ where: { is_active: true } }),
      prismaInstance.newTechPark.groupBy({ by: ["status"], where: { is_active: true }, _count: { _all: true } }),
      prismaInstance.coworkingSpace.groupBy({ by: ["status"], _count: { _all: true } }),
      prismaInstance.mall.groupBy({ by: ["status"], where: { is_active: true }, _count: { _all: true } }),
      prismaInstance.hospital.groupBy({ by: ["status"], where: { is_active: true }, _count: { _all: true } }),
      prismaInstance.stadium.groupBy({ by: ["status"], where: { is_active: true }, _count: { _all: true } }),
      prismaInstance.airport.groupBy({ by: ["status"], where: { is_active: true }, _count: { _all: true } }),
    ]);

    const buildStatusMap = (groups: any[]) => {
      const map: Record<string, number> = {};
      groups.forEach((g) => { map[String(g.status || "NOT_CONTACTED")] = Number(g._count?._all ?? 0); });
      return map;
    };

    const computeTab = (label: string, type: string, count: number, statusMap: Record<string, number>) => {
      const contacted = count - (statusMap["NOT_CONTACTED"] ?? 0);
      const positive = (statusMap["INTERESTED"] ?? 0) + (statusMap["MEETING_SCHEDULED"] ?? 0) + (statusMap["PROPOSAL_SENT"] ?? 0);
      const responseRate = contacted > 0 ? Number(((positive / contacted) * 100).toFixed(2)) : 0;
      return { type, label, count, contactedCount: contacted, responseRate };
    };

    const totalVenues =
      techParksCount + coworkingCount + mallsCount + hospitalsCount + stadiumsCount + airportsCount;

    const tabs = [
      computeTab("Tech Parks", "techParks", techParksCount, buildStatusMap(techParksStatus)),
      computeTab("Coworking Spaces", "coworkingSpaces", coworkingCount, buildStatusMap(coworkingStatus)),
      computeTab("Malls", "malls", mallsCount, buildStatusMap(mallsStatus)),
      computeTab("Hospitals", "hospitals", hospitalsCount, buildStatusMap(hospitalsStatus)),
      computeTab("Stadiums", "stadiums", stadiumsCount, buildStatusMap(stadiumsStatus)),
      computeTab("Airports", "airports", airportsCount, buildStatusMap(airportsStatus)),
    ];

    return res.json({
      success: true,
      summary: {
        totalVenues,
        byType: {
          techParks: techParksCount,
          coworkingSpaces: coworkingCount,
          malls: mallsCount,
          hospitals: hospitalsCount,
          stadiums: stadiumsCount,
          airports: airportsCount,
        },
      },
      tabs,
    });
  } catch (error) {
    return sendSafeErrorResponse(res, error, "nationalOverview.getNationalOverview", "Failed to fetch national overview");
  }
};
