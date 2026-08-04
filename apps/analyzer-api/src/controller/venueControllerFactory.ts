import { Request, Response } from "express";
import { getQueryString } from "../utils/queryUtils";
import { INDIA_STATES_AND_UTS } from "../utils/indiaStates";
import {
  applyScopeToStateCityWhere,
  canAccessStateCity,
  getDataScopeFromRequest,
} from "../utils/dataScope";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";
import { matchEnumValue } from "../utils/enumSearch";
import { getPostgresEnumValues } from "../utils/dbEnums";
import { prismaInstance } from "@repo/db";

const VALID_STATUSES = [
  "NOT_CONTACTED",
  "CONTACTED",
  "INTERESTED",
  "MEETING_SCHEDULED",
  "PROPOSAL_SENT",
  "IN_PROGRESS",
  "CLOSED",
] as const;

type ValidStatus = (typeof VALID_STATUSES)[number];

export interface VenueController {
  getOverviewData: (req: Request, res: Response) => Promise<any>;
  getStateWiseOverview: (req: Request, res: Response) => Promise<any>;
  getCityWiseOverview: (req: Request, res: Response) => Promise<any>;
  getVenueById: (req: Request, res: Response) => Promise<any>;
  addVenue: (req: Request, res: Response) => Promise<any>;
  updateVenue: (req: Request, res: Response) => Promise<any>;
  deleteVenue: (req: Request, res: Response) => Promise<any>;
  changeStatus: (req: Request, res: Response) => Promise<any>;
  verifyVenue: (req: Request, res: Response) => Promise<any>;
  unverifyVenue: (req: Request, res: Response) => Promise<any>;
}

export function createVenueController(
  model: any,
  entityLabel: string,
  errorPrefix: string,
): VenueController {
  const sendError = (res: Response, error: unknown, context: string, fallback: string) =>
    sendSafeErrorResponse(res, error, `${errorPrefix}.${context}`, fallback);

  const getOverviewData = async (req: Request, res: Response) => {
    try {
      const scope = getDataScopeFromRequest(req);
      const where: any = {};
      applyScopeToStateCityWhere(where, scope);

      const [total, statusGroups, stateGroups] = await Promise.all([
        model.count({ where }),
        model.groupBy({ by: ["status"], where, _count: { _all: true } }),
        model.groupBy({ by: ["state"], where, _count: { _all: true } }),
      ]);

      const statusCounts: Record<string, number> = {};
      statusGroups.forEach((g: any) => {
        statusCounts[String(g.status || "NOT_CONTACTED")] = Number(g._count?._all ?? 0);
      });

      const contacted = total - (statusCounts["NOT_CONTACTED"] ?? 0);
      const positiveResponses =
        (statusCounts["INTERESTED"] ?? 0) +
        (statusCounts["MEETING_SCHEDULED"] ?? 0) +
        (statusCounts["PROPOSAL_SENT"] ?? 0);
      const responseRate =
        contacted > 0 ? Number(((positiveResponses / contacted) * 100).toFixed(2)) : 0;

      const stateMap: Record<string, number> = {};
      INDIA_STATES_AND_UTS.forEach((s) => { stateMap[s] = 0; });

      let unknownCount = 0;
      stateGroups.forEach((g: any) => {
        const state = (g.state || "").trim();
        const count = Number(g._count?._all ?? 0);
        if (!state) { unknownCount += count; return; }
        stateMap[state] = (stateMap[state] ?? 0) + count;
      });

      const stateData = [
        ...INDIA_STATES_AND_UTS.map((state) => ({ state, count: stateMap[state] ?? 0 })),
        ...(unknownCount > 0 ? [{ state: "Unknown", count: unknownCount }] : []),
      ];

      return res.json({
        success: true,
        total,
        contacted,
        positiveResponses,
        responseRate,
        stateData,
      });
    } catch (error) {
      return sendError(res, error, "getOverviewData", `Failed to fetch ${entityLabel} overview data`);
    }
  };

  const getStateWiseOverview = async (req: Request, res: Response) => {
    try {
      const state = getQueryString(req.params.state);
      if (!state) {
        return res.status(400).json({ success: false, message: "State parameter is required" });
      }

      const scope = getDataScopeFromRequest(req);
      if (!canAccessStateCity(scope, state, null)) {
        return res.status(403).json({ success: false, message: "You do not have access to this state" });
      }

      const where: any = { state: { equals: state, mode: "insensitive" } };
      applyScopeToStateCityWhere(where, scope);

      const [total, statusGroups, cityGroups] = await Promise.all([
        model.count({ where }),
        model.groupBy({ by: ["status"], where, _count: { _all: true } }),
        model.groupBy({ by: ["city", "district"], where, _count: { _all: true } }),
      ]);

      const statusCounts: Record<string, number> = {};
      statusGroups.forEach((g: any) => {
        statusCounts[String(g.status || "NOT_CONTACTED")] = Number(g._count?._all ?? 0);
      });

      const contacted = total - (statusCounts["NOT_CONTACTED"] ?? 0);
      const positiveResponses =
        (statusCounts["INTERESTED"] ?? 0) +
        (statusCounts["MEETING_SCHEDULED"] ?? 0) +
        (statusCounts["PROPOSAL_SENT"] ?? 0);
      const responseRate =
        contacted > 0 ? Number(((positiveResponses / contacted) * 100).toFixed(2)) : 0;

      const normalizeKey = (s: string) => s.trim().toLowerCase();
      const cityMap = new Map<string, { city: string; count: number }>();
      cityGroups.forEach((g: any) => {
        const cityRaw = (g.city || "").trim();
        const districtRaw = (g.district || "").trim();
        const count = Number(g._count?._all ?? 0);
        const city = districtRaw || cityRaw || "Unknown";
        const key = normalizeKey(city);
        const existing = cityMap.get(key);
        if (existing) { existing.count += count; }
        else { cityMap.set(key, { city, count }); }
      });

      const cityData = Array.from(cityMap.values()).sort((a, b) => b.count - a.count);

      return res.json({
        success: true,
        state,
        total,
        contacted,
        positiveResponses,
        responseRate,
        cityData,
        statusBreakdown: {
          NOT_CONTACTED: statusCounts["NOT_CONTACTED"] ?? 0,
          CONTACTED: statusCounts["CONTACTED"] ?? 0,
          INTERESTED: statusCounts["INTERESTED"] ?? 0,
          MEETING_SCHEDULED: statusCounts["MEETING_SCHEDULED"] ?? 0,
          PROPOSAL_SENT: statusCounts["PROPOSAL_SENT"] ?? 0,
          IN_PROGRESS: statusCounts["IN_PROGRESS"] ?? 0,
          CLOSED: statusCounts["CLOSED"] ?? 0,
        },
      });
    } catch (error) {
      return sendError(res, error, "getStateWiseOverview", `Failed to fetch ${entityLabel} state-wise overview`);
    }
  };

  const getCityWiseOverview = async (req: Request, res: Response) => {
    try {
      const state = getQueryString(req.params.state);
      const city = getQueryString(req.params.city);
      if (!state || !city) {
        return res.status(400).json({ success: false, message: "State and city parameters are required" });
      }

      const scope = getDataScopeFromRequest(req);
      if (!canAccessStateCity(scope, state, city)) {
        return res.status(403).json({ success: false, message: "You do not have access to this city" });
      }

      const page = Math.max(1, Number(getQueryString(req.query.page)) || 1);
      const pageSize = Math.max(1, Math.min(100, Number(getQueryString(req.query.pageSize)) || 10));
      const search = getQueryString(req.query.search);
      const verifiedFilter = getQueryString(req.query.verified);
      const skip = (page - 1) * pageSize;

      const where: any = {
        state: { equals: state, mode: "insensitive" },
        OR: [
          { city: { equals: city, mode: "insensitive" } },
          { district: { equals: city, mode: "insensitive" } },
        ],
      };
      applyScopeToStateCityWhere(where, scope);

      if (verifiedFilter === "VERIFIED") { where.isVerified = true; }
      else if (verifiedFilter === "UNVERIFIED") { where.isVerified = false; }

      if (search && search.trim()) {
        const trimmed = search.trim();
        const statusCandidate = matchEnumValue(trimmed, [...VALID_STATUSES]);
        const dbEnumValues = await getPostgresEnumValues(prismaInstance, "Status");
        const statusMatch =
          statusCandidate && dbEnumValues?.includes(statusCandidate) ? statusCandidate : undefined;

        where.OR = [
          { name: { contains: trimmed, mode: "insensitive" } },
          { address: { contains: trimmed, mode: "insensitive" } },
          { reception_phone: { contains: trimmed, mode: "insensitive" } },
          { generic_email: { contains: trimmed, mode: "insensitive" } },
          ...(statusMatch ? [{ status: statusMatch }] : []),
        ];
      }

      const [totalItems, items, statusGroups] = await Promise.all([
        model.count({ where }),
        model.findMany({ where, orderBy: { name: "asc" }, skip, take: pageSize }),
        model.groupBy({ by: ["status"], where, _count: { _all: true } }),
      ]);

      const statusCounts: Record<string, number> = {};
      statusGroups.forEach((g: any) => {
        statusCounts[String(g.status)] = Number(g._count?._all ?? 0);
      });

      const notContactedCount = statusCounts["NOT_CONTACTED"] ?? 0;
      const contacted = totalItems - notContactedCount;
      const positiveResponses =
        (statusCounts["INTERESTED"] ?? 0) +
        (statusCounts["MEETING_SCHEDULED"] ?? 0) +
        (statusCounts["PROPOSAL_SENT"] ?? 0);
      const responseRate =
        contacted > 0 ? Number(((positiveResponses / contacted) * 100).toFixed(2)) : 0;

      return res.json({
        success: true,
        state,
        city,
        total: totalItems,
        contacted,
        positiveResponses,
        responseRate,
        statusBreakdown: {
          NOT_CONTACTED: notContactedCount,
          CONTACTED: statusCounts["CONTACTED"] ?? 0,
          INTERESTED: statusCounts["INTERESTED"] ?? 0,
          MEETING_SCHEDULED: statusCounts["MEETING_SCHEDULED"] ?? 0,
          PROPOSAL_SENT: statusCounts["PROPOSAL_SENT"] ?? 0,
          IN_PROGRESS: statusCounts["IN_PROGRESS"] ?? 0,
          CLOSED: statusCounts["CLOSED"] ?? 0,
        },
        items,
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      });
    } catch (error) {
      return sendError(res, error, "getCityWiseOverview", `Failed to fetch ${entityLabel} city-wise overview`);
    }
  };

  const getVenueById = async (req: Request, res: Response) => {
    try {
      const id = getQueryString(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, message: `${entityLabel} ID is required` });
      }

      const scope = getDataScopeFromRequest(req);
      const accessWhere: any = { id };
      applyScopeToStateCityWhere(accessWhere, scope);

      const venue = await model.findFirst({ where: accessWhere });
      if (!venue) {
        return res.status(404).json({ success: false, message: `${entityLabel} not found` });
      }

      return res.json({ success: true, data: venue });
    } catch (error) {
      return sendError(res, error, "getVenueById", `Failed to fetch ${entityLabel}`);
    }
  };

  const addVenue = async (req: Request, res: Response) => {
    try {
      const { name, city: bodyCity, state: bodyState, ...rest } = req.body ?? {};
      const stateParam = getQueryString(req.params.state);
      const cityParam = getQueryString(req.params.city);

      const resolvedState = (stateParam && isNaN(Number(stateParam)) ? stateParam : bodyState || stateParam || "").trim();
      const resolvedCity = (cityParam && isNaN(Number(cityParam)) ? cityParam : bodyCity || cityParam || "").trim();

      if (!name || !resolvedCity || !resolvedState) {
        return res.status(400).json({ success: false, message: "Name, city, and state are required" });
      }

      const scope = getDataScopeFromRequest(req);
      if (!canAccessStateCity(scope, resolvedState, resolvedCity)) {
        return res.status(403).json({ success: false, message: "You do not have access to create records in this location" });
      }

      const existing = await model.findFirst({
        where: {
          name: { equals: name.trim(), mode: "insensitive" },
          city: { equals: resolvedCity, mode: "insensitive" },
          state: { equals: resolvedState, mode: "insensitive" },
        },
      });
      if (existing) {
        return res.status(409).json({ success: false, message: `A ${entityLabel} with this name already exists in this city.` });
      }

      const created = await model.create({
        data: {
          name: name.trim(),
          city: resolvedCity,
          state: resolvedState,
          place_id: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          address: rest.address || null,
          locality: rest.locality || null,
          district: rest.district || null,
          pincode: rest.pincode || null,
          country: rest.country || null,
          lat: rest.lat != null ? Number(rest.lat) : null,
          lng: rest.lng != null ? Number(rest.lng) : null,
          map_url: rest.map_url || null,
          website: rest.website || null,
          reception_phone: rest.reception_phone || null,
          international_phone: rest.international_phone || null,
          generic_email: rest.generic_email || null,
          rating: rest.rating != null ? Number(rest.rating) : null,
          spoc_name: rest.spoc_name || null,
          spoc_phone: rest.spoc_phone || null,
          challenges: rest.challenges || null,
          notes_internal: rest.notes_internal || null,
          status: rest.status || "NOT_CONTACTED",
        },
      });

      return res.status(201).json({ success: true, message: `${entityLabel} created successfully`, data: created });
    } catch (error: any) {
      if (error.code === "P2002") {
        return res.status(409).json({ success: false, message: `A ${entityLabel} with this information already exists` });
      }
      return sendError(res, error, "addVenue", `Failed to create ${entityLabel}`);
    }
  };

  const updateVenue = async (req: Request, res: Response) => {
    try {
      const id = getQueryString(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, message: `${entityLabel} ID is required` });
      }

      const scope = getDataScopeFromRequest(req);
      const accessWhere: any = { id };
      applyScopeToStateCityWhere(accessWhere, scope);

      const existing = await model.findFirst({ where: accessWhere });
      if (!existing) {
        return res.status(404).json({ success: false, message: `${entityLabel} not found` });
      }

      const updateData = req.body ?? {};
      const nextState = updateData?.state ?? existing.state;
      const nextCity = updateData?.city ?? existing.city;
      if (!canAccessStateCity(scope, nextState, nextCity)) {
        return res.status(403).json({ success: false, message: "You do not have access to move this record to the selected location" });
      }

      if (updateData.lat != null) updateData.lat = Number(updateData.lat);
      if (updateData.lng != null) updateData.lng = Number(updateData.lng);
      if (updateData.rating != null) updateData.rating = Number(updateData.rating);

      const updated = await model.update({ where: { id }, data: updateData });
      return res.json({ success: true, message: `${entityLabel} updated successfully`, data: updated });
    } catch (error: any) {
      if (error.code === "P2023") {
        return res.status(400).json({ success: false, message: `Invalid ${entityLabel} ID format` });
      }
      return sendError(res, error, "updateVenue", `Failed to update ${entityLabel}`);
    }
  };

  const deleteVenue = async (req: Request, res: Response) => {
    try {
      const id = getQueryString(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, message: `${entityLabel} ID is required` });
      }

      const scope = getDataScopeFromRequest(req);
      const accessWhere: any = { id };
      applyScopeToStateCityWhere(accessWhere, scope);

      const existing = await model.findFirst({ where: accessWhere });
      if (!existing) {
        return res.status(404).json({ success: false, message: `${entityLabel} not found` });
      }

      await model.delete({ where: { id } });
      return res.json({ success: true, message: `${entityLabel} deleted successfully` });
    } catch (error: any) {
      if (error.code === "P2023") {
        return res.status(400).json({ success: false, message: `Invalid ${entityLabel} ID format` });
      }
      return sendError(res, error, "deleteVenue", `Failed to delete ${entityLabel}`);
    }
  };

  const changeStatus = async (req: Request, res: Response) => {
    try {
      const id = getQueryString(req.params.id);
      const { updatedStatus } = req.body;
      const scope = getDataScopeFromRequest(req);

      if (!id || typeof updatedStatus !== "string") {
        return res.status(400).json({ success: false, message: `Missing or invalid ${entityLabel} ID or status` });
      }

      if (!VALID_STATUSES.includes(updatedStatus as ValidStatus)) {
        return res.status(400).json({ success: false, message: "Invalid status value" });
      }

      const accessWhere: any = { id };
      applyScopeToStateCityWhere(accessWhere, scope);
      const accessible = await model.findFirst({ where: accessWhere, select: { id: true } });
      if (!accessible) {
        return res.status(404).json({ success: false, message: `${entityLabel} not found` });
      }

      const updated = await model.update({
        where: { id },
        data: { status: updatedStatus as ValidStatus },
      });

      return res.json({ success: true, data: updated });
    } catch (error) {
      return sendError(res, error, "changeStatus", `Failed to update ${entityLabel} status`);
    }
  };

  const verifyVenue = async (req: Request, res: Response) => {
    try {
      const id = getQueryString(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, message: "ID parameter is required" });
      }

      const existing = await model.findFirst({ where: { id } });
      if (!existing) {
        return res.status(404).json({ success: false, message: `${entityLabel} not found` });
      }

      const updated = await model.update({
        where: { id },
        data: { isVerified: true, verifiedAt: new Date() },
      });

      return res.json({ success: true, message: `${entityLabel} verified successfully`, data: updated });
    } catch (error) {
      return sendError(res, error, "verifyVenue", `Failed to verify ${entityLabel}`);
    }
  };

  const unverifyVenue = async (req: Request, res: Response) => {
    try {
      const id = getQueryString(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, message: "ID parameter is required" });
      }

      const existing = await model.findFirst({ where: { id } });
      if (!existing) {
        return res.status(404).json({ success: false, message: `${entityLabel} not found` });
      }

      const updated = await model.update({
        where: { id },
        data: { isVerified: false, verifiedAt: null },
      });

      return res.json({ success: true, message: `${entityLabel} unverified successfully`, data: updated });
    } catch (error) {
      return sendError(res, error, "unverifyVenue", `Failed to unverify ${entityLabel}`);
    }
  };

  return {
    getOverviewData,
    getStateWiseOverview,
    getCityWiseOverview,
    getVenueById,
    addVenue,
    updateVenue,
    deleteVenue,
    changeStatus,
    verifyVenue,
    unverifyVenue,
  };
}
