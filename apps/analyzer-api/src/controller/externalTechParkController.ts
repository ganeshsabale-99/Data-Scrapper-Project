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

const EXTERNAL_TECH_PARK_SELECT = {
  id: true,
  place_id: true,
  name: true,
  address_line1: true,
  address_line2: true,
  locality: true,
  city: true,
  district: true,
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
  contact_page_url: true,
  rating: true,
  total_ratings: true,
  business_status: true,
  types: true,
  operator_name: true,
  campus_brand: true,
  legal_entity: true,
  campus_size_hint: true,
  tenant_signal: true,
  amenities_signal: true,
  source_primary: true,
  sources_raw: true,
  confidence_overall: true,
  qa_status: true,
  is_active: true,
  first_seen_at: true,
  last_seen_at: true,
  last_changed_at: true,
  exterior_media_url: true,
  exterior_media_urls: true,
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
  status: true,
  reviewStatus: true,
  isVerified: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NewTechParkSelect;

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

export const getExternalNationalTechParks = async (req: Request, res: Response) => {
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

    const where: Prisma.NewTechParkWhereInput = {
      is_active: true,
      ...(state
        ? {
          state: {
            equals: state,
            mode: "insensitive",
          },
        }
        : {}),
      ...(city
        ? {
          city: {
            equals: city,
            mode: "insensitive",
          },
        }
        : {}),
      ...(statusRaw && !isStatusAll ? { status: statusRaw as Prisma.EnumStatusFilter["equals"] } : {}),
      ...(typeof verifiedFilter === "boolean" ? { isVerified: verifiedFilter } : {}),
    };

    const [totalItems, items] = await Promise.all([
      prismaInstance.newTechPark.count({ where }),
      prismaInstance.newTechPark.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        select: {
          ...EXTERNAL_TECH_PARK_SELECT,
          ...(includeContacts
            ? {
              contactLogs: {
                orderBy: { createdAt: "desc" },
                take: 50,
                select: {
                  id: true,
                  type: true,
                  status: true,
                  subject: true,
                  notes: true,
                  timestamp: true,
                  createdAt: true,
                },
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
      "externalTechPark.getNational",
      "Unable to fetch national tech park data right now. Please try again.",
    );
  }
};

export const getExternalTechParkById = async (req: Request, res: Response) => {
  try {
    const id = getQueryString(req.params.id)?.trim();
    if (!id) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "id is required",
      });
    }

    const techPark = await prismaInstance.newTechPark.findFirst({
      where: {
        id,
        is_active: true,
      },
      select: EXTERNAL_TECH_PARK_SELECT,
    });

    if (!techPark) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Tech park not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: techPark,
    });
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "externalTechPark.getById",
      "Unable to fetch tech park data right now. Please try again.",
    );
  }
};
