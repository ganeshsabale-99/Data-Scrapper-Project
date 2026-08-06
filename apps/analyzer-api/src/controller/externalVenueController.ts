import type { Prisma } from "@repo/db";
import { prismaInstance } from "@repo/db";
import type { Request, Response } from "express";
import { getQueryString } from "../utils/queryUtils";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";

const EXTERNAL_STATUS_VALUES = [
  "NOT_CONTACTED",
  "CONTACTED",
  "INTERESTED",
  "MEETING_SCHEDULED",
  "PROPOSAL_SENT",
  "IN_PROGRESS",
  "CLOSED",
] as const;

const parsePositiveInteger = (
  value: string | undefined,
  fallback: number,
): number | null => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return parsed;
};

const parseBooleanFilter = (value: string | undefined): boolean | "invalid" | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return "invalid";
};

const CONTACT_LOG_SELECT = {
  id: true,
  type: true,
  status: true,
  subject: true,
  notes: true,
  timestamp: true,
  createdAt: true,
} satisfies Prisma.ContactLogSelect;

export type ExternalVenueConfig = {
  /** Prisma delegate for the venue's model, e.g. prismaInstance.mall */
  model: any;
  /** Fields to select for both the list and single-record endpoints */
  select: Record<string, boolean>;
  /** Whether this model has an is_active column to filter on (generic venues do, CoworkingSpace doesn't) */
  hasIsActiveField: boolean;
  notFoundMessage: string;
  logPrefix: string;
};

export function createExternalVenueHandlers(config: ExternalVenueConfig) {
  const { model, select, hasIsActiveField, notFoundMessage, logPrefix } = config;

  const list = async (req: Request, res: Response) => {
    try {
      const pageRaw = parsePositiveInteger(getQueryString(req.query.page), 1);
      const limitRaw = parsePositiveInteger(getQueryString(req.query.limit), 50);
      if (!pageRaw || !limitRaw) {
        return res.status(400).json({
          success: false,
          code: "VALIDATION_ERROR",
          message: "page and limit must be positive integers",
        });
      }

      const page = pageRaw;
      const limit = Math.min(200, limitRaw);
      const skip = (page - 1) * limit;

      const verifiedFilter = parseBooleanFilter(getQueryString(req.query.verified));
      if (verifiedFilter === "invalid") {
        return res.status(400).json({
          success: false,
          code: "VALIDATION_ERROR",
          message: "verified must be true or false",
        });
      }

      const statusRaw = getQueryString(req.query.status)?.trim().toUpperCase();
      const isStatusAll = statusRaw === "ALL";
      if (statusRaw && !isStatusAll && !EXTERNAL_STATUS_VALUES.includes(statusRaw as (typeof EXTERNAL_STATUS_VALUES)[number])) {
        return res.status(400).json({
          success: false,
          code: "VALIDATION_ERROR",
          message: `status must be one of: ${EXTERNAL_STATUS_VALUES.join(", ")}, or ALL`,
        });
      }

      const includeContacts = parseBooleanFilter(getQueryString(req.query.includeContacts)) === true;

      const state = getQueryString(req.query.state)?.trim();
      const city = getQueryString(req.query.city)?.trim();

      const where: Record<string, unknown> = {
        ...(hasIsActiveField ? { is_active: true } : {}),
        ...(state ? { state: { equals: state, mode: "insensitive" } } : {}),
        ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
        ...(statusRaw && !isStatusAll ? { status: statusRaw } : {}),
        ...(typeof verifiedFilter === "boolean" ? { isVerified: verifiedFilter } : {}),
      };

      const [totalItems, items] = await Promise.all([
        model.count({ where }),
        model.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
          select: {
            ...select,
            ...(includeContacts
              ? {
                contactLogs: {
                  orderBy: { createdAt: "desc" },
                  take: 50,
                  select: CONTACT_LOG_SELECT,
                },
              }
              : {}),
          },
        }),
      ]);

      const totalPages = Math.max(1, Math.ceil(totalItems / limit));

      return res.status(200).json({
        success: true,
        filters: {
          state: state || null,
          city: city || null,
          status: statusRaw || null,
          verified: typeof verifiedFilter === "boolean" ? verifiedFilter : null,
        },
        data: items,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      });
    } catch (error) {
      return sendSafeErrorResponse(
        res,
        error,
        `${logPrefix}.list`,
        "Unable to fetch data right now. Please try again.",
      );
    }
  };

  const getById = async (req: Request, res: Response) => {
    try {
      const id = getQueryString(req.params.id)?.trim();
      if (!id) {
        return res.status(400).json({
          success: false,
          code: "VALIDATION_ERROR",
          message: "id is required",
        });
      }

      const record = await model.findFirst({
        where: {
          id,
          ...(hasIsActiveField ? { is_active: true } : {}),
        },
        select,
      });

      if (!record) {
        return res.status(404).json({
          success: false,
          code: "NOT_FOUND",
          message: notFoundMessage,
        });
      }

      return res.status(200).json({ success: true, data: record });
    } catch (error) {
      return sendSafeErrorResponse(
        res,
        error,
        `${logPrefix}.getById`,
        "Unable to fetch data right now. Please try again.",
      );
    }
  };

  return { list, getById };
}

const GENERIC_VENUE_SELECT = {
  id: true,
  place_id: true,
  name: true,
  address: true,
  locality: true,
  district: true,
  city: true,
  state: true,
  pincode: true,
  country: true,
  lat: true,
  lng: true,
  map_url: true,
  photo_url: true,
  website: true,
  reception_phone: true,
  international_phone: true,
  generic_email: true,
  rating: true,
  total_ratings: true,
  types: true,
  business_status: true,
  parking_score: true,
  status: true,
  is_active: true,
  isVerified: true,
  verifiedAt: true,
  spoc_name: true,
  spoc_phone: true,
  challenges: true,
  first_seen_at: true,
  last_seen_at: true,
  createdAt: true,
  updatedAt: true,
};

const COWORKING_SELECT = {
  id: true,
  name: true,
  city: true,
  state: true,
  district: true,
  pincode: true,
  country: true,
  address: true,
  contact_phone: true,
  international_phone: true,
  generic_email: true,
  operator_name: true,
  campus_brand: true,
  legal_entity: true,
  campus_size_hint: true,
  status: true,
  lat: true,
  lng: true,
  map_url: true,
  website: true,
  rating: true,
  total_ratings: true,
  builder_name: true,
  security_agency_name: true,
  property_manager_name: true,
  property_manager_phone: true,
  property_manager_email: true,
  parking_floors: true,
  total_floors: true,
  basement_levels: true,
  spoc_name: true,
  spoc_phone: true,
  seating_capacity: true,
  challenges: true,
  isVerified: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
};

export const externalCoworkingSpaces = createExternalVenueHandlers({
  model: prismaInstance.coworkingSpace,
  select: COWORKING_SELECT,
  hasIsActiveField: false,
  notFoundMessage: "Coworking space not found",
  logPrefix: "externalVenue.coworking",
});

export const externalMalls = createExternalVenueHandlers({
  model: prismaInstance.mall,
  select: GENERIC_VENUE_SELECT,
  hasIsActiveField: true,
  notFoundMessage: "Mall not found",
  logPrefix: "externalVenue.mall",
});

export const externalHospitals = createExternalVenueHandlers({
  model: prismaInstance.hospital,
  select: GENERIC_VENUE_SELECT,
  hasIsActiveField: true,
  notFoundMessage: "Hospital not found",
  logPrefix: "externalVenue.hospital",
});

export const externalStadiums = createExternalVenueHandlers({
  model: prismaInstance.stadium,
  select: GENERIC_VENUE_SELECT,
  hasIsActiveField: true,
  notFoundMessage: "Stadium not found",
  logPrefix: "externalVenue.stadium",
});

export const externalAirports = createExternalVenueHandlers({
  model: prismaInstance.airport,
  select: GENERIC_VENUE_SELECT,
  hasIsActiveField: true,
  notFoundMessage: "Airport not found",
  logPrefix: "externalVenue.airport",
});
