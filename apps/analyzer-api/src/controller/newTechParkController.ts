import {
  prismaInstance,
  Prisma,
} from "@repo/db";
import { Request, Response } from "express";
import { normalizeCity } from "../utils/cityNormalization";
import { getQueryString } from "../utils/queryUtils";
import { INDIA_STATES_AND_UTS } from "../utils/indiaStates";
import { matchEnumValue } from "../utils/enumSearch";
import { getPostgresEnumValues } from "../utils/dbEnums";
import {
  applyScopeToStateCityWhere,
  buildTechParkCompanyScopeWhere,
  canAccessStateCity,
  getDataScopeFromRequest,
} from "../utils/dataScope";
import { calculateDuplicationScore } from "../utils/verificationUtils";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";
import { diffObjects } from "../utils/diffUtils";
import { createActivityLog } from "../libs/activityLogger.service";
import { ActivityEntityType, ActivityAction } from "@repo/db";

const normalizePermission = (value: string) =>
  value.trim().toUpperCase().replace(/[^A-Z0-9.]+/g, "_");

const hasPermission = (permissionSet: Set<string>, permission: string) => {
  const normalized = normalizePermission(permission);
  if (!normalized) return false;
  if (
    permissionSet.has("*") ||
    permissionSet.has("SYSTEM.ADMIN") ||
    permissionSet.has("SYSTEM.SUPER_ADMIN")
  ) {
    return true;
  }
  if (permissionSet.has(normalized)) return true;
  const moduleKey = normalized.split(".")[0];
  return Boolean(moduleKey && permissionSet.has(`${moduleKey}.*`));
};

const hasAnyPermission = (permissionSet: Set<string>, permissions: string[]) =>
  permissions.some((permission) => hasPermission(permissionSet, permission));

const getRequestPermissionSet = (req: Request) =>
  new Set(
    (req.user?.permissions || [])
      .map((permission) => normalizePermission(permission))
      .filter(Boolean),
  );

const TECHPARK_APPROVER_PERMISSIONS = [
  "SYSTEM.SUPER_ADMIN",
];

const canApproveTechParkReview = (permissionSet: Set<string>) =>
  TECHPARK_APPROVER_PERMISSIONS.some((permission) => permissionSet.has(permission));

const canSubmitTechParkReview = (permissionSet: Set<string>) =>
  hasAnyPermission(permissionSet, ["TECHPARKS.VERIFY", "TASKS.VERIFY_TECHPARK"]);

type VerificationLifecycleStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "READY_FOR_REVIEW"
  | "VERIFIED"
  | "REJECTED";

type TechParkVerificationSnapshot = {
  isVerified: boolean;
  reviewStatus?: string | null;
  verifiedByUserId?: string | null;
  security_agency_name?: string | null;
  property_manager_name?: string | null;
  property_manager_phone?: string | null;
  property_manager_email?: string | null;
  parking_floors?: number | null;
  total_floors?: number | null;
  basement_levels?: number | null;
  spoc_name?: string | null;
  spoc_phone?: string | null;
  seating_capacity?: number | null;
  challenges?: string | null;
  lat?: number | null;
  lng?: number | null;
};

const isPresentText = (value: unknown) => typeof value === "string" && value.trim().length > 0;

const isValidEmailAddress = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isNonNegativeInteger = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

const toFriendlyFieldLabel = (field: string) =>
  field
    .replaceAll("_", " ")
    .replace(/\blat lng\b/i, "coordinates")
    .replace(/\bspoc\b/gi, "SPOC")
    .replace(/\bid\b/gi, "ID")
    .replace(/\bemail\b/gi, "email")
    .replace(/\bphone\b/gi, "phone");

const getVerificationFormState = (park: TechParkVerificationSnapshot) => {
  const missingFields: string[] = [];

  const requiredTextFields: Array<keyof TechParkVerificationSnapshot> = [
    "security_agency_name",
    "property_manager_name",
    "property_manager_phone",
    "property_manager_email",
    "spoc_name",
    "spoc_phone",
    "challenges",
  ];

  const requiredNumericFields: Array<keyof TechParkVerificationSnapshot> = [
    "parking_floors",
    "total_floors",
    "basement_levels",
    "seating_capacity",
  ];

  const hasAnyTextProgress = requiredTextFields.some((field) => isPresentText(park[field]));
  const hasAnyNumericProgress = requiredNumericFields.some(
    (field) => park[field] !== null && park[field] !== undefined,
  );

  requiredTextFields.forEach((field) => {
    if (!isPresentText(park[field])) {
      missingFields.push(String(field));
    }
  });

  const emailValue = String(park.property_manager_email || "").trim();
  if (emailValue && !isValidEmailAddress(emailValue)) {
    missingFields.push("property_manager_email");
  }

  requiredNumericFields.forEach((field) => {
    if (!isNonNegativeInteger(park[field])) {
      missingFields.push(String(field));
    }
  });

  const hasCoordinateProgress =
    (park.lat !== null && park.lat !== undefined) ||
    (park.lng !== null && park.lng !== undefined);
  const hasValidCoordinates =
    typeof park.lat === "number" &&
    Number.isFinite(park.lat) &&
    park.lat >= -90 &&
    park.lat <= 90 &&
    typeof park.lng === "number" &&
    Number.isFinite(park.lng) &&
    park.lng >= -180 &&
    park.lng <= 180;

  if (!hasValidCoordinates) {
    missingFields.push("lat_lng");
  }

  const dedupedMissingFields = Array.from(new Set(missingFields));
  const isFormComplete = dedupedMissingFields.length === 0;
  const hasFormProgress = hasAnyTextProgress || hasAnyNumericProgress || hasCoordinateProgress;

  return {
    isFormComplete,
    hasFormProgress,
    missingFields: dedupedMissingFields,
    missingFieldLabels: dedupedMissingFields.map((field) => toFriendlyFieldLabel(field)),
  };
};

const getVerificationLifecycleStatus = (
  park: TechParkVerificationSnapshot,
): VerificationLifecycleStatus => {
  if (park.isVerified) return "VERIFIED";
  if (String(park.reviewStatus || "").trim().toUpperCase() === "REJECTED") return "REJECTED";

  const formState = getVerificationFormState(park);
  if (park.verifiedByUserId && formState.isFormComplete) return "READY_FOR_REVIEW";
  if (formState.hasFormProgress) return "IN_PROGRESS";
  return "PENDING";
};


export const getOverviewData = async (req: Request, res: Response) => {
  try {
    const scope = getDataScopeFromRequest(req);
    const where: any = { is_active: true };
    applyScopeToStateCityWhere(where, scope);

    const [totalTechParks, statusGroups, stateGroups] = await Promise.all([
      prismaInstance.newTechPark.count({ where }),
      prismaInstance.newTechPark.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      prismaInstance.newTechPark.groupBy({
        by: ["state"],
        where,
        _count: { _all: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    statusGroups.forEach((group) => {
      const key = String(group.status || "NOT_CONTACTED");
      statusCounts[key] = Number(group._count?._all ?? 0);
    });

    const contactedTechParks =
      totalTechParks - (statusCounts["NOT_CONTACTED"] ?? 0);
    const positiveResponses =
      (statusCounts["INTERESTED"] ?? 0) +
      (statusCounts["MEETING_SCHEDULED"] ?? 0) +
      (statusCounts["PROPOSAL_SENT"] ?? 0);

    const responseRate = contactedTechParks > 0
      ? Number(((positiveResponses / contactedTechParks) * 100).toFixed(2))
      : 0;


    const stateMap: Record<string, number> = {};
    INDIA_STATES_AND_UTS.forEach((s) => {
      stateMap[s] = 0;
    });

    let unknownCount = 0;
    stateGroups.forEach((group) => {
      const state = (group.state || "").trim();
      const count = Number(group._count?._all ?? 0);
      if (!state) {
        unknownCount += count;
        return;
      }
      stateMap[state] = (stateMap[state] ?? 0) + count;
    });

    const stateData = [
      ...INDIA_STATES_AND_UTS.map((state) => ({
        state,
        count: stateMap[state] ?? 0,
      })),
      ...(unknownCount > 0 ? [{ state: "Unknown", count: unknownCount }] : []),
    ];

    res.json({
      success: true,
      totalTechParks,
      contactedTechParks,
      positiveResponses,
      responseRate,
      stateData,
    });
  } catch (error) {
    return sendNewTechParkSafeError(
      res,
      error,
      "getOverviewData",
      "Failed to fetch overview data",
    );
  }
};

const sendNewTechParkSafeError = (
  res: Response,
  error: unknown,
  context: string,
  fallbackMessage: string,
) =>
  sendSafeErrorResponse(
    res,
    error,
    `newTechPark.${context}`,
    fallbackMessage,
  );



const toJsonValue = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value ?? null));



const listActiveAdminRecipientIds = async (): Promise<string[]> => {
  try {
    const admins = await prismaInstance.adminUser.findMany({
      where: {
        isActive: true,
        status: "ACTIVE",
        accessRoles: {
          some: {
            role: {
              isActive: true,
              permissions: {
                some: {
                  permission: {
                    key: {
                      in: ["SYSTEM.ADMIN", "SYSTEM.SUPER_ADMIN"],
                    },
                  },
                },
              },
            },
          },
        },
      },
      select: { id: true },
    });
    return admins.map((row) => row.id);
  } catch (error) {
    console.warn("[newTechPark.notifications.admin_lookup_failed]", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
};



export const getStateWiseOverview = async (req: Request, res: Response) => {
  try {
    const state = getQueryString(req.params.state);
    if (!state) {
      return res.status(400).json({ success: false, message: "State parameter is required" });
    }
    const scope = getDataScopeFromRequest(req);
    if (!canAccessStateCity(scope, state, null)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this state",
      });
    }

    const catalogWhere: any = {
      state: { equals: state, mode: "insensitive" },
      is_active: true,
    };
    applyScopeToStateCityWhere(catalogWhere, scope);
    const catalogCities = await prismaInstance.cityCatalog.findMany({
      where: catalogWhere,
      orderBy: { city: "asc" },
      select: { city: true },
    });

    const techParkWhere: any = {
      is_active: true,
      state: { equals: state, mode: "insensitive" },
    };
    applyScopeToStateCityWhere(techParkWhere, scope);
    const [totalTechParks, statusGroups, cityGroups] = await Promise.all([
      prismaInstance.newTechPark.count({ where: techParkWhere }),
      prismaInstance.newTechPark.groupBy({
        by: ["status"],
        where: techParkWhere,
        _count: { _all: true },
      }),
      prismaInstance.newTechPark.groupBy({
        by: ["city"],
        where: techParkWhere,
        _count: { _all: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    statusGroups.forEach((group) => {
      statusCounts[String(group.status || "NOT_CONTACTED")] = Number(
        group._count?._all ?? 0,
      );
    });

    const contactedTechParks = totalTechParks - (statusCounts["NOT_CONTACTED"] ?? 0);

    const positiveResponses =
      (statusCounts["INTERESTED"] ?? 0) +
      (statusCounts["MEETING_SCHEDULED"] ?? 0) +
      (statusCounts["PROPOSAL_SENT"] ?? 0);

    const responseRate = contactedTechParks > 0
      ? Number(((positiveResponses / contactedTechParks) * 100).toFixed(2))
      : 0;

    const normalizeKey = (s: string) => s.trim().toLowerCase();
    const cityMap = new Map<string, { city: string; count: number }>();
    cityGroups.forEach((group) => {
      const cityRaw = (group.city || "").trim();
      const count = Number(group._count?._all ?? 0);
      const city = cityRaw ? normalizeCity(cityRaw) : "Unknown";
      const key = normalizeKey(city);
      const existing = cityMap.get(key);
      if (existing) {
        existing.count += count;
      } else {
        cityMap.set(key, { city, count });
      }
    });

    const catalogCityKeys = new Set(catalogCities.map((c) => normalizeKey(c.city)));
    const cityData = [
      ...catalogCities.map((c) => ({
        city: c.city,
        count: cityMap.get(normalizeKey(c.city))?.count ?? 0,
      })),
      ...Array.from(cityMap.values())
        .filter((x) => !catalogCityKeys.has(normalizeKey(x.city)))
        .sort((a, b) => b.count - a.count),
    ];



    res.json({
      success: true,
      state,
      totalTechParks,
      contactedTechParks,
      positiveResponses,
      responseRate,
      cityData,
    });
  } catch (error) {
    return sendNewTechParkSafeError(
      res,
      error,
      "getStateWiseOverview",
      "Failed to fetch state-wise overview data",
    );
  }
};

export const getCityWiseOverview = async (req: Request, res: Response) => {
  try {
    const state = getQueryString(req.params.state);
    const city = getQueryString(req.params.city);
    if (!state || !city) {
      return res.status(400).json({ success: false, message: "State and city parameters are required" });
    }
    const scope = getDataScopeFromRequest(req);
    if (!canAccessStateCity(scope, state, city)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this city",
      });
    }

    const page = Math.max(1, Number(getQueryString(req.query.page)) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(getQueryString(req.query.pageSize)) || 10));
    const search = getQueryString(req.query.search);
    const verifiedRaw = getQueryString(req.query.verified) || "ALL";
    const verifiedFilter = verifiedRaw.trim().toUpperCase();
    if (!["ALL", "VERIFIED", "UNVERIFIED"].includes(verifiedFilter)) {
      return res.status(400).json({
        success: false,
        message: "verified must be one of ALL, VERIFIED, UNVERIFIED",
      });
    }
    const skip = (page - 1) * pageSize;

    const baseWhere: any = {
      is_active: true,
      state: { equals: state, mode: "insensitive" },
      city: { equals: city, mode: "insensitive" },
    };
    applyScopeToStateCityWhere(baseWhere, scope);

    if (search && search.trim()) {
      const trimmed = search.trim();
      const statusCandidate = matchEnumValue(trimmed, [
        "NOT_CONTACTED",
        "CONTACTED",
        "INTERESTED",
        "MEETING_SCHEDULED",
        "PROPOSAL_SENT",
        "IN_PROGRESS",
        "CLOSED",
      ]);
      const dbEnumValues = await getPostgresEnumValues(
        prismaInstance,
        "Status",
      );
      const fallbackEnumValues =
        dbEnumValues ?? (await getPostgresEnumValues(prismaInstance, "NewTechParkStatus"));
      const statusMatch =
        statusCandidate && fallbackEnumValues?.includes(statusCandidate)
          ? statusCandidate
          : undefined;

      baseWhere.OR = [
        { name: { contains: trimmed, mode: 'insensitive' } },
        { address_line1: { contains: trimmed, mode: 'insensitive' } },
        { address_line2: { contains: trimmed, mode: 'insensitive' } },
        { locality: { contains: trimmed, mode: 'insensitive' } },
        { website: { contains: trimmed, mode: 'insensitive' } },
        { reception_phone: { contains: trimmed, mode: 'insensitive' } },
        { international_phone: { contains: trimmed, mode: 'insensitive' } },
        ...(statusMatch ? [{ status: statusMatch }] : []),
      ];
    }

    const where: any = {
      ...baseWhere,
      ...(verifiedFilter === "VERIFIED"
        ? { isVerified: true }
        : verifiedFilter === "UNVERIFIED"
          ? { isVerified: false }
          : {}),
    };

    const [totalItems, totalVerified, totalUnverified] = await Promise.all([
      prismaInstance.newTechPark.count({ where }),
      prismaInstance.newTechPark.count({
        where: {
          ...baseWhere,
          isVerified: true,
        },
      }),
      prismaInstance.newTechPark.count({
        where: {
          ...baseWhere,
          isVerified: false,
        },
      }),
    ]);

    const techParks = await prismaInstance.newTechPark.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        name: true,
        website: true,
        address_line1: true,
        address_line2: true,
        locality: true,
        city: true,
        state: true,
        pincode: true,
        reception_phone: true,
        international_phone: true,
        status: true,
        rating: true,
        map_url: true,
        isVerified: true,
        reviewStatus: true,
        verifiedByUserId: true,
        verifiedAt: true,
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
        lat: true,
        lng: true,
        verifiedByUser: {
          select: {
            name: true,
          },
        },
      },
    });

    const totalTechParks = totalItems;
    const statusGroups = await prismaInstance.newTechPark.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    });
    const statusCounts: Record<string, number> = {};
    statusGroups.forEach((g: any) => {
      statusCounts[String(g.status)] = Number(g._count?._all ?? 0);
    });

    const notContactedCount = statusCounts["NOT_CONTACTED"] ?? 0;
    const contactedTechParks = totalItems - notContactedCount;
    const positiveResponses =
      (statusCounts["INTERESTED"] ?? 0) +
      (statusCounts["MEETING_SCHEDULED"] ?? 0) +
      (statusCounts["PROPOSAL_SENT"] ?? 0);
    const responseRate =
      contactedTechParks > 0
        ? Number(((positiveResponses / contactedTechParks) * 100).toFixed(2))
        : 0;

    const statusBreakdown = {
      NOT_CONTACTED: notContactedCount,
      CONTACTED: statusCounts["CONTACTED"] ?? 0,
      INTERESTED: statusCounts["INTERESTED"] ?? 0,
      MEETING_SCHEDULED: statusCounts["MEETING_SCHEDULED"] ?? 0,
      PROPOSAL_SENT: statusCounts["PROPOSAL_SENT"] ?? 0,
      IN_PROGRESS: statusCounts["IN_PROGRESS"] ?? 0,
      CLOSED: statusCounts["CLOSED"] ?? 0,
    };

    const items = techParks.map((tp) => {
      const formState = getVerificationFormState(tp);
      const lifecycleStatus = getVerificationLifecycleStatus(tp);
      return {
        id: tp.id,
        name: tp.name,
        website: tp.website ?? null,
        address: [tp.address_line1, tp.address_line2, tp.locality, tp.city, tp.state, tp.pincode]
          .filter(Boolean)
          .join(", "),
        contactNumber: tp.reception_phone || tp.international_phone || null,
        status: tp.status,
        rating: tp.rating ?? null,
        googleMapLink: tp.map_url ?? null,
        isVerified: tp.isVerified,
        reviewStatus: tp.reviewStatus,
        submittedByUserId: tp.verifiedByUserId ?? null,
        verificationLifecycleStatus: lifecycleStatus,
        isVerificationFormComplete: formState.isFormComplete,
        hasVerificationProgress: formState.hasFormProgress,
        verifiedAt: tp.verifiedAt ?? null,
        verifiedByName: tp.verifiedByUser?.name ?? null,
      };
    });

    res.json({
      success: true,
      state,
      city,
      totalTechParks,
      contactedTechParks,
      positiveResponses,
      responseRate,
      statusBreakdown,
      verificationBreakdown: {
        all: totalVerified + totalUnverified,
        verified: totalVerified,
        unverified: totalUnverified,
        appliedFilter: verifiedFilter,
      },
      items,
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    });
  } catch (error) {
    return sendNewTechParkSafeError(
      res,
      error,
      "getCityWiseOverview",
      "Failed to fetch city-wise overview data",
    );
  }
};

export const addTechPark = async (
  req: Request,
  res: Response,
) => {
  try {
    const {
      name,
      website,
      address,
      reception_phone,
      status,
      rating,
      map_url,

      builder_name,
      security_agency_name,
      property_manager_name,
      property_manager_phone,
      property_manager_email,
      parking_floors,
      total_floors,
      basement_levels,
      spoc_name,
      spoc_phone,
      seating_capacity,
      challenges,
      lat,
      lng,
      exterior_media_url,
      exterior_media_urls,
    } = req.body;
    const state = getQueryString(req.params.state);
    const city = getQueryString(req.params.city);
    const scope = getDataScopeFromRequest(req);
    if (!canAccessStateCity(scope, state, city)) {
      return res.status(403).json({
        error: "You do not have access to create records in this location.",
      });
    }

    const toTrimmedString = (value: unknown) =>
      typeof value === "string" ? value.trim() : "";
    const toOptionalTrimmedStringOrNull = (value: unknown) => {
      const s = toTrimmedString(value);
      return s ? s : null;
    };
    const toOptionalIntOrNull = (value: unknown) => {
      if (value === null || value === undefined || value === "") return null;
      const n = typeof value === "number" ? value : Number(String(value).trim());
      if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
      return n;
    };
    const normalizePhone10 = (value: unknown) => {
      const s = toTrimmedString(value);
      if (!s) return "";
      const digits = s.replace(/[^\d]/g, "");
      return digits;
    };
    const isValidEmail = (value: string) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    const toOptionalFloatOrNull = (value: unknown) => {
      if (value === null || value === undefined || value === "") return null;
      const n = typeof value === "number" ? value : Number(String(value).trim());
      if (!Number.isFinite(n)) return null;
      return n;
    };

    const nameStr = toTrimmedString(name);
    const addressStr = toTrimmedString(address);
    const cityStr = toTrimmedString(city);
    const builderNameStr = toTrimmedString(builder_name);
    const securityAgencyStr = toTrimmedString(security_agency_name);
    const propertyManagerNameStr = toTrimmedString(property_manager_name);
    const propertyManagerPhoneDigits = normalizePhone10(property_manager_phone);
    const propertyManagerEmailStr = toTrimmedString(property_manager_email);
    const spocNameStr = toTrimmedString(spoc_name);
    const spocPhoneDigits = normalizePhone10(spoc_phone);
    const challengesStr = toTrimmedString(challenges);
    const exteriorMediaUrlStr = toTrimmedString(exterior_media_url);
    const exteriorMediaUrlsStrs = Array.isArray(exterior_media_urls)
      ? exterior_media_urls
        .filter((v: unknown) => typeof v === "string")
        .map((v: string) => v.trim())
        .filter(Boolean)
      : [];
    const exteriorMediaUrls = exteriorMediaUrlsStrs.length
      ? exteriorMediaUrlsStrs
      : exteriorMediaUrlStr
        ? [exteriorMediaUrlStr]
        : [];

    const parkingFloorsInt = toOptionalIntOrNull(parking_floors);
    const totalFloorsInt = toOptionalIntOrNull(total_floors);
    const basementLevelsInt = toOptionalIntOrNull(basement_levels);
    const seatingCapacityInt = toOptionalIntOrNull(seating_capacity);
    const latFloat = toOptionalFloatOrNull(lat);
    const lngFloat = toOptionalFloatOrNull(lng);

    if (!nameStr || !addressStr || !cityStr || !builderNameStr) {
      return res
        .status(400)
        .json({ error: "Missing required fields: name, address, city, or builder name." });
    }

    if (
      !securityAgencyStr ||
      !propertyManagerNameStr ||
      !propertyManagerEmailStr ||
      !spocNameStr ||
      !challengesStr ||
      exteriorMediaUrls.length === 0
    ) {
      return res.status(400).json({
        error:
          "Missing required fields: security agency, property manager, SPOC, challenges, or exterior media.",
      });
    }
    if (exteriorMediaUrls.length > 5) {
      return res
        .status(400)
        .json({ error: "Exterior media supports a maximum of 5 URLs." });
    }

    if (propertyManagerPhoneDigits.length !== 10) {
      return res
        .status(400)
        .json({ error: "Property manager contact must be a 10-digit number." });
    }
    if (spocPhoneDigits.length !== 10) {
      return res
        .status(400)
        .json({ error: "SPOC contact must be a 10-digit number." });
    }
    if (!isValidEmail(propertyManagerEmailStr)) {
      return res
        .status(400)
        .json({ error: "Property manager email must be a valid email ID." });
    }
    if (parkingFloorsInt === null || parkingFloorsInt < 0) {
      return res
        .status(400)
        .json({ error: "Parking floors must be a non-negative integer." });
    }
    if (totalFloorsInt === null || totalFloorsInt < 0) {
      return res
        .status(400)
        .json({ error: "Total floors must be a non-negative integer." });
    }
    if (basementLevelsInt === null || basementLevelsInt < 0) {
      return res
        .status(400)
        .json({ error: "Basement levels must be a non-negative integer." });
    }
    if (seatingCapacityInt === null || seatingCapacityInt < 0) {
      return res
        .status(400)
        .json({ error: "Seating capacity must be a non-negative integer." });
    }
    if (
      latFloat === null ||
      lngFloat === null ||
      latFloat < -90 ||
      latFloat > 90 ||
      lngFloat < -180 ||
      lngFloat > 180
    ) {
      return res.status(400).json({
        error:
          "Latitude/Longitude is required and must be valid (lat -90..90, lng -180..180).",
      });
    }
    try {
      for (const urlStr of exteriorMediaUrls) {
        // eslint-disable-next-line no-new
        new URL(urlStr);
      }
    } catch {
      return res.status(400).json({
        error:
          "Exterior media must be a valid URL (upload to Drive/Cloud and paste link).",
      });
    }

    const existingTechPark = await prismaInstance.newTechPark.findFirst({
      where: {
        name: { equals: nameStr, mode: 'insensitive' },
        city: { equals: cityStr, mode: 'insensitive' },
        state: state ? { equals: state, mode: 'insensitive' } : undefined,
      }
    });

    if (existingTechPark) {
      return res.status(409).json({
        success: false,
        error: "A tech park with this exact name already exists in this city."
      });
    }

    const placeId = `manual_${Date.now()}`;
    const ratingFloat =
      rating === undefined || rating === null || rating === ""
        ? null
        : typeof rating === "number"
          ? rating
          : Number(String(rating).trim());
    if (ratingFloat !== null && (!Number.isFinite(ratingFloat) || ratingFloat < 0 || ratingFloat > 5)) {
      return res.status(400).json({ error: "Rating must be a number between 0 and 5." });
    }
    const techPark = await prismaInstance.newTechPark.create({
      data: {
        place_id: placeId,
        name: nameStr,
        address_line1: addressStr,
        city: cityStr,
        state: state ?? undefined,
        website: toOptionalTrimmedStringOrNull(website),
        reception_phone: toOptionalTrimmedStringOrNull(reception_phone),
        map_url: toOptionalTrimmedStringOrNull(map_url),
        rating: ratingFloat,
        status: (status as any) ?? 'NOT_CONTACTED',
        types: [],
        is_active: true,

        builder_name: builderNameStr,
        security_agency_name: securityAgencyStr,
        property_manager_name: propertyManagerNameStr,
        property_manager_phone: propertyManagerPhoneDigits,
        property_manager_email: propertyManagerEmailStr,
        parking_floors: parkingFloorsInt,
        total_floors: totalFloorsInt,
        basement_levels: basementLevelsInt,
        spoc_name: spocNameStr,
        spoc_phone: spocPhoneDigits,
        seating_capacity: seatingCapacityInt,
        challenges: challengesStr,
        lat: latFloat,
        lng: lngFloat,
        exterior_media_url: exteriorMediaUrls[0],
        exterior_media_urls: exteriorMediaUrls,
        isVerified: false,
        reviewStatus: "PENDING_REVIEW",
        duplication_score: await calculateDuplicationScore({
          name: nameStr,
          lat: latFloat,
          lng: lngFloat,
          state: state || "",
          city: cityStr,
          propertyManagerEmail: propertyManagerEmailStr,
          spocPhone: spocPhoneDigits,
        }),
        verifiedByUserId: null,
        verifiedAt: null,
      },
    });

    return res
      .status(201)
      .json({ message: "Tech park created successfully.", data: techPark });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res
        .status(409)
        .json({ error: "A tech park with this unique field already exists." });
    }
    if (error.name === "PrismaClientValidationError") {
      return res.status(400).json({ error: "Invalid data format." });
    }
    if (error instanceof SyntaxError) {
      return res.status(400).json({ error: "Invalid JSON in request body." });
    }
    return sendNewTechParkSafeError(
      res,
      error,
      "addTechPark",
      "Unable to create tech park right now. Please try again.",
    );
  }
};

export const changeTechParkStatus = async (req: Request, res: Response) => {
  try {
    const id = getQueryString(req.params.id);
    const { updatedStatus } = req.body;
    const scope = getDataScopeFromRequest(req);

    if (!id || typeof updatedStatus !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "Missing or invalid id or status" });
    }

    const validStatuses = [
      "NOT_CONTACTED",
      "CONTACTED",
      "INTERESTED",
      "MEETING_SCHEDULED",
      "PROPOSAL_SENT",
      "IN_PROGRESS",
      "CLOSED",
    ] as const;
    if (!validStatuses.includes(updatedStatus as any)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid status value" });
    }

    const accessWhere: any = { id };
    applyScopeToStateCityWhere(accessWhere, scope);
    const accessibleTechPark = await prismaInstance.newTechPark.findFirst({
      where: accessWhere,
      select: { id: true, status: true },
    });
    if (!accessibleTechPark) {
      return res.status(404).json({
        success: false,
        error: "Tech park not found",
      });
    }

    const updatedTechPark = await prismaInstance.newTechPark.update({
      where: { id },
      data: { status: updatedStatus as (typeof validStatuses)[number] },
    });

    try {
      if (updatedStatus !== accessibleTechPark?.status) {
        await createActivityLog({
          entityType: ActivityEntityType.TECH_PARK,
          entityId: id,
          action: ActivityAction.STATUS_CHANGE,
          summary: `Status changed to ${updatedStatus}`,
          changedFields: {
            status: { from: accessibleTechPark?.status || "NOT_CONTACTED", to: updatedStatus }
          },
          actor: {
            id: req.user?.userId || "unknown",
            name: "unknown",
            role: "unknown",
          },
          reqContext: {
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          },
        });
      }
    } catch (e) { }

    res.json({ success: true, data: updatedTechPark });
  } catch (err) {
    return sendNewTechParkSafeError(
      res,
      err,
      "changeTechParkStatus",
      "Unable to update tech park status right now. Please try again.",
    );
  }
};

export const verifyTechParkDetails = async (req: Request, res: Response) => {
  try {
    const id = getQueryString(req.params.id);
    const scope = getDataScopeFromRequest(req);
    const actorUserId = req.user?.userId;
    const actorPermissionSet = getRequestPermissionSet(req);
    const canApproveReview = canApproveTechParkReview(actorPermissionSet);
    const canSubmitReview = canSubmitTechParkReview(actorPermissionSet);

    if (!id) {
      return res.status(400).json({ success: false, error: "Tech park ID is required" });
    }
    if (!actorUserId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }
    if (!canApproveReview && !canSubmitReview) {
      return res.status(403).json({
        success: false,
        error: "You are not allowed to submit or approve tech park verification.",
      });
    }

    const accessWhere: any = { id, is_active: true };
    applyScopeToStateCityWhere(accessWhere, scope);
    const current = await prismaInstance.newTechPark.findFirst({
      where: accessWhere,
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        isVerified: true,
        reviewStatus: true,
        verifiedByUserId: true,
        verifiedAt: true,
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
        lat: true,
        lng: true,
        verifiedByUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!current) {
      return res.status(404).json({ success: false, error: "Tech park not found" });
    }

    const formState = getVerificationFormState(current);
    const lifecycleStatus = getVerificationLifecycleStatus(current);

    if (!canApproveReview) {
      if (current.isVerified) {
        return res.status(400).json({
          success: false,
          error: "Tech park is already verified by super admin.",
        });
      }

      if (!formState.isFormComplete) {
        return res.status(400).json({
          success: false,
          error: "Required form details are incomplete. Please complete all mandatory fields before submission.",
          data: {
            verificationLifecycleStatus: lifecycleStatus,
            isVerificationFormComplete: false,
            hasVerificationProgress: formState.hasFormProgress,
            missingFields: formState.missingFields,
            missingFieldLabels: formState.missingFieldLabels,
          },
        });
      }

      if (current.reviewStatus === "PENDING_REVIEW" && current.verifiedByUserId) {
        return res.status(200).json({
          success: true,
          message: "Tech park is already submitted and ready for super admin review.",
          data: current,
        });
      }

      const submittedTechPark = await prismaInstance.newTechPark.update({
        where: { id },
        data: {
          isVerified: false,
          reviewStatus: "PENDING_REVIEW",
          verifiedByUserId: actorUserId,
          verifiedAt: null,
        },
        select: {
          id: true,
          name: true,
          city: true,
          state: true,
          isVerified: true,
          reviewStatus: true,
          verifiedByUserId: true,
          verifiedAt: true,
          verifiedByUser: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });



      return res.status(200).json({
        success: true,
        message: "Tech park details completed and sent for super admin review.",
        data: submittedTechPark,
      });
    }

    if (current.isVerified) {
      return res.status(200).json({
        success: true,
        message: "Tech park is already verified.",
        data: current,
      });
    }

    if (!formState.isFormComplete) {
      return res.status(400).json({
        success: false,
        error: "Submitted details are incomplete. Ask the team to complete required details first.",
        data: {
          verificationLifecycleStatus: lifecycleStatus,
          isVerificationFormComplete: false,
          hasVerificationProgress: formState.hasFormProgress,
          missingFields: formState.missingFields,
          missingFieldLabels: formState.missingFieldLabels,
        },
      });
    }

    if (!current.verifiedByUserId) {
      return res.status(400).json({
        success: false,
        error: "Tech park is not submitted for review yet. Team must submit completed details before super admin verification.",
      });
    }

    const updatedTechPark = await prismaInstance.newTechPark.update({
      where: { id },
      data: {
        isVerified: true,
        reviewStatus: "APPROVED",
        verifiedByUserId: actorUserId,
        verifiedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        isVerified: true,
        reviewStatus: true,
        verifiedAt: true,
        verifiedByUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });



    try {
      await createActivityLog({
        entityType: ActivityEntityType.TECH_PARK,
        entityId: id,
        action: ActivityAction.VERIFY,
        summary: `Verified Tech Park`,
        actor: {
          id: req.user?.userId || "unknown",
          name: "unknown",
          role: "unknown",
        },
        reqContext: {
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        },
      });
    } catch (e) { }



    return res.status(200).json({
      success: true,
      message: "Tech park verified successfully.",
      data: updatedTechPark,
    });
  } catch (err) {
    return sendNewTechParkSafeError(
      res,
      err,
      "verifyTechParkDetails",
      "Unable to verify this tech park right now. Please try again.",
    );
  }
};

export const unverifyTechParkDetails = async (req: Request, res: Response) => {
  try {
    const id = getQueryString(req.params.id);
    const scope = getDataScopeFromRequest(req);
    const actorUserId = req.user?.userId;
    const actorPermissionSet = getRequestPermissionSet(req);

    if (!id) {
      return res.status(400).json({ success: false, error: "Tech park ID is required" });
    }
    if (!actorUserId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const accessWhere: any = { id, is_active: true };
    applyScopeToStateCityWhere(accessWhere, scope);
    const current = await prismaInstance.newTechPark.findFirst({
      where: accessWhere,
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        isVerified: true,
        verifiedByUserId: true,
        verifiedAt: true,
        verifiedByUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!current) {
      return res.status(404).json({ success: false, error: "Tech park not found" });
    }

    if (!current.isVerified) {
      return res.status(200).json({
        success: true,
        message: "Tech park is already unverified.",
        data: current,
      });
    }

    const isAdminOrManager = hasAnyPermission(actorPermissionSet, [
      "SYSTEM.SUPER_ADMIN",
    ]);
    const canUnverify = isAdminOrManager;

    if (!canUnverify) {
      return res.status(403).json({
        success: false,
        error: "Only super admin can mark this tech park as unverified.",
      });
    }

    const now = new Date();
    const updatedTechPark = await prismaInstance.$transaction(async (tx) => {
      const updated = await tx.newTechPark.update({
        where: { id },
        data: {
          isVerified: false,
          reviewStatus: "PENDING_REVIEW",
          verifiedByUserId: null,
          verifiedAt: null,
        },
        select: {
          id: true,
          name: true,
          city: true,
          state: true,
          isVerified: true,
          reviewStatus: true,
          verifiedAt: true,
          verifiedByUser: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return updated;
    });



    return res.status(200).json({
      success: true,
      message: "Tech park marked as unverified successfully.",
      data: updatedTechPark,
    });
  } catch (err) {
    return sendNewTechParkSafeError(
      res,
      err,
      "unverifyTechParkDetails",
      "Unable to mark this tech park as unverified right now. Please try again.",
    );
  }
};

export const verifyAllCityTechParks = async (req: Request, res: Response) => {
  try {
    const state = getQueryString(req.params.state);
    const city = getQueryString(req.params.city);
    const actorUserId = req.user?.userId;
    const scope = getDataScopeFromRequest(req);
    const actorPermissionSet = getRequestPermissionSet(req);

    if (!state || !city) {
      return res.status(400).json({
        success: false,
        error: "State and city are required",
      });
    }
    if (!actorUserId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }
    if (!canApproveTechParkReview(actorPermissionSet)) {
      return res.status(403).json({
        success: false,
        error: "Only super admin can approve bulk verification.",
      });
    }
    if (!canAccessStateCity(scope, state, city)) {
      return res.status(403).json({
        success: false,
        error: "You do not have access to this city",
      });
    }

    const where: any = {
      is_active: true,
      state: { equals: state, mode: "insensitive" },
      city: { equals: city, mode: "insensitive" },
      isVerified: false,
      reviewStatus: "PENDING_REVIEW",
      verifiedByUserId: { not: null },
    };
    applyScopeToStateCityWhere(where, scope);

    const submittedCandidates = await prismaInstance.newTechPark.findMany({
      where,
      select: {
        id: true,
        isVerified: true,
        reviewStatus: true,
        verifiedByUserId: true,
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
        lat: true,
        lng: true,
      },
    });

    const eligibleIds = submittedCandidates
      .filter((row) => getVerificationFormState(row).isFormComplete)
      .map((row) => row.id);

    if (eligibleIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No completed tech parks pending super admin verification for this city.",
        data: {
          state,
          city,
          requested: submittedCandidates.length,
          verifiedNow: 0,
          skipped: submittedCandidates.length,
        },
      });
    }

    const updated = await prismaInstance.newTechPark.updateMany({
      where: {
        id: { in: eligibleIds },
        isVerified: false,
      },
      data: {
        isVerified: true,
        reviewStatus: "APPROVED",
        verifiedByUserId: actorUserId,
        verifiedAt: new Date(),
      },
    });



    return res.status(200).json({
      success: true,
      message: `${updated.count} tech park(s) verified successfully.`,
      data: {
        state,
        city,
        requested: submittedCandidates.length,
        verifiedNow: updated.count,
        skipped: Math.max(0, submittedCandidates.length - updated.count),
      },
    });
  } catch (err) {
    return sendNewTechParkSafeError(
      res,
      err,
      "verifyAllCityTechParks",
      "Unable to complete bulk verification right now. Please try again.",
    );
  }
};

export const getCompaniesByTechPark = async (req: Request, res: Response) => {
  try {
    const techParkId = getQueryString(req.params.techParkId);
    const scope = getDataScopeFromRequest(req);
    if (!techParkId) {
      return res.status(400).json({ success: false, message: "Tech park ID is required" });
    }

    const accessWhere: any = { id: techParkId };
    applyScopeToStateCityWhere(accessWhere, scope);
    const accessibleTechPark = await prismaInstance.newTechPark.findFirst({
      where: accessWhere,
      select: { id: true },
    });
    if (!accessibleTechPark) {
      return res.status(404).json({ success: false, message: "Tech park not found" });
    }

    const page = parseInt(getQueryString(req.query.page) || "1", 10) || 1;
    const limit = parseInt(getQueryString(req.query.limit) || "10", 10) || 10;
    const search = getQueryString(req.query.search);
    const offset = (page - 1) * limit;
    const where: any = {
      newTechParkId: techParkId,
      ...buildTechParkCompanyScopeWhere(scope),
    };
    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { website: { contains: search, mode: 'insensitive' } },
        { contact_phone: { contains: search, mode: 'insensitive' } },
        { contact_international_phone: { contains: search, mode: 'insensitive' } },
        { contact_email: { contains: search, mode: 'insensitive' } },
        { business_status: { contains: search, mode: 'insensitive' } },
        { operator: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const totalCompanies = await (prismaInstance as any).techParkCompany.count({
      where,
    });

    const companies: any[] = await (prismaInstance as any).techParkCompany.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const allCompanies = await (prismaInstance as any).techParkCompany.findMany({
      where: {
        newTechParkId: techParkId,
        ...buildTechParkCompanyScopeWhere(scope),
      },
      select: { business_status: true },
    });

    const contactedCompanies = allCompanies.filter((c: any) => (c.business_status || 'NOT_CONTACTED') !== 'NOT_CONTACTED').length;
    const positiveResponses = allCompanies.filter((c: any) => ['INTERESTED', 'MEETING_SCHEDULED', 'PROPOSAL_SENT'].includes(c.business_status || '')).length;
    const responseRate = contactedCompanies > 0 ? Number(((positiveResponses / contactedCompanies) * 100).toFixed(2)) : 0;

    const statusBreakdown = {
      NOT_CONTACTED: allCompanies.filter((c: any) => (c.business_status || 'NOT_CONTACTED') === 'NOT_CONTACTED').length,
      CONTACTED: allCompanies.filter((c: any) => (c.business_status || '') === 'CONTACTED').length,
      INTERESTED: allCompanies.filter((c: any) => (c.business_status || '') === 'INTERESTED').length,
      MEETING_SCHEDULED: allCompanies.filter((c: any) => (c.business_status || '') === 'MEETING_SCHEDULED').length,
      PROPOSAL_SENT: allCompanies.filter((c: any) => (c.business_status || '') === 'PROPOSAL_SENT').length,
      IN_PROGRESS: allCompanies.filter((c: any) => (c.business_status || '') === 'IN_PROGRESS').length,
      CLOSED: allCompanies.filter((c: any) => (c.business_status || '') === 'CLOSED').length,
    };

    const items = companies.map((c: any, index: number) => ({
      id: c.id,
      name: c.name,
      address: c.address,
      website: c.website ?? null,
      rating: c.rating ?? null,
      total_ratings: c.total_ratings ?? 0,
      business_status: c.business_status ?? 'NOT_CONTACTED',
      phone: c.contact_phone ?? c.contact_international_phone ?? null,
      map_url: c.map_url ?? null,
      opening_hours: (c.opening_hours || []).join(', '),
      city: c.city,
      serialNumber: offset + index + 1,
    }));

    const totalPages = Math.max(1, Math.ceil(totalCompanies / limit));

    res.json({
      success: true,
      data: {
        stats: {
          totalCompanies,
          contactedCompanies,
          positiveResponses,
          responseRate,
        },
        statusBreakdown,
        items,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: totalCompanies,
          pageSize: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    return sendNewTechParkSafeError(
      res,
      error,
      "getCompaniesByTechPark",
      "Failed to fetch companies",
    );
  }
};

export const addCompanyToTechPark = async (req: Request, res: Response) => {
  try {
    const techParkId = getQueryString(req.params.techParkId);
    const scope = getDataScopeFromRequest(req);
    const payload = req.body || {};
    if (!techParkId) {
      return res.status(400).json({ success: false, message: "Tech park ID is required" });
    }
    if (!payload.name) {
      return res.status(400).json({ success: false, message: "Company name is required" });
    }

    const techParkWhere: any = { id: techParkId };
    applyScopeToStateCityWhere(techParkWhere, scope);
    const techPark = await prismaInstance.newTechPark.findFirst({ where: techParkWhere });
    if (!techPark) {
      return res.status(404).json({ success: false, message: "Tech park not found" });
    }

    const created = await (prismaInstance as any).techParkCompany.create({
      data: {
        newTechParkId: techParkId,
        name: payload.name,
        address: payload.address || techPark.address_line1 || '',
        city: payload.city || techPark.city || '',
        locationLat: typeof payload.locationLat === 'number' ? payload.locationLat : 0,
        locationLng: typeof payload.locationLng === 'number' ? payload.locationLng : 0,
        website: payload.website || null,
        description: payload.description || null,
        operator: payload.operator || null,
        rating: typeof payload.rating === 'number' ? payload.rating : payload.rating ? Number(payload.rating) : null,
        total_ratings: typeof payload.total_ratings === 'number' ? payload.total_ratings : null,
        types: Array.isArray(payload.types) ? payload.types : [],
        business_status: payload.status || 'NOT_CONTACTED',
        plus_code: payload.plus_code || null,
        opening_hours: Array.isArray(payload.opening_hours) ? payload.opening_hours : [],
        map_url: payload.map_url || null,
        photo_reference: payload.photo_reference || null,
        contact_phone: payload.contact || payload.contact_phone || null,
        contact_international_phone: payload.contact_international_phone || null,
        contact_email: payload.contact_email || null,
      },
    });

    res.status(201).json({ success: true, message: 'Company created', data: created });
  } catch (error: any) {
    console.error('Error in addCompanyToTechPark:', error);
    if (error?.code === 'P2003') {
      return res.status(400).json({ success: false, message: 'Invalid Tech Park reference' });
    }
    return sendNewTechParkSafeError(
      res,
      error,
      "addCompanyToTechPark",
      "Failed to add company",
    );
  }
};

export const getCompanyById = async (req: Request, res: Response) => {
  try {
    const companyId = getQueryString(req.params.companyId);
    const scope = getDataScopeFromRequest(req);
    if (!companyId) {
      return res.status(400).json({ success: false, message: "Company ID is required" });
    }
    const company = await (prismaInstance as any).techParkCompany.findFirst({
      where: { id: companyId, ...buildTechParkCompanyScopeWhere(scope) },
    });
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }
    res.json({ success: true, data: company });
  } catch (error) {
    return sendNewTechParkSafeError(
      res,
      error,
      "getCompanyById",
      "Failed to fetch company",
    );
  }
};

export const updateCompany = async (req: Request, res: Response) => {
  try {
    const companyId = getQueryString(req.params.companyId);
    const scope = getDataScopeFromRequest(req);
    if (!companyId) {
      return res.status(400).json({ success: false, message: "Company ID is required" });
    }

    const data = req.body || {};

    const existingCompany = await (prismaInstance as any).techParkCompany.findFirst({
      where: { id: companyId, ...buildTechParkCompanyScopeWhere(scope) },
    });

    if (!existingCompany) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const updateData: any = {};

    if (data.name !== undefined && data.name !== null && data.name !== '') {
      updateData.name = data.name;
    }
    if (data.address !== undefined && data.address !== null && data.address !== '') {
      updateData.address = data.address;
    }
    if (data.city !== undefined && data.city !== null && data.city !== '') {
      updateData.city = data.city;
    }
    if (data.website !== undefined) updateData.website = data.website;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.operator !== undefined) updateData.operator = data.operator;
    if (data.map_url !== undefined) updateData.map_url = data.map_url;
    if (data.contact_phone !== undefined) updateData.contact_phone = data.contact_phone;
    if (data.contact_email !== undefined) updateData.contact_email = data.contact_email;
    if (data.contact_international_phone !== undefined) updateData.contact_international_phone = data.contact_international_phone;
    if (data.business_status !== undefined && data.business_status !== null && data.business_status !== '') {
      updateData.business_status = data.business_status;
    }

    if (data.rating !== undefined) {
      updateData.rating = typeof data.rating === 'number' ? data.rating : data.rating ? Number(data.rating) : null;
    }
    if (data.total_ratings !== undefined) {
      updateData.total_ratings = typeof data.total_ratings === 'number' ? data.total_ratings : null;
    }
    if (data.locationLat !== undefined && data.locationLat !== null && data.locationLat !== '') {
      updateData.locationLat = typeof data.locationLat === 'number' ? data.locationLat : Number(data.locationLat);
    }
    if (data.locationLng !== undefined && data.locationLng !== null && data.locationLng !== '') {
      updateData.locationLng = typeof data.locationLng === 'number' ? data.locationLng : Number(data.locationLng);
    }

    if (data.opening_hours !== undefined) {
      updateData.opening_hours = Array.isArray(data.opening_hours) ? data.opening_hours : [];
    }
    if (data.types !== undefined) {
      updateData.types = Array.isArray(data.types) ? data.types : [];
    }

    const updated = await (prismaInstance as any).techParkCompany.update({
      where: { id: companyId },
      data: updateData,
    });
    res.json({ success: true, message: 'Company updated', data: updated });
  } catch (error: any) {
    console.error('Error in updateCompany:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      meta: error.meta
    });

    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: "Duplicate entry" });
    }
    if (error.code === 'P2003') {
      return res.status(400).json({ success: false, message: "Invalid reference" });
    }

    return sendNewTechParkSafeError(
      res,
      error,
      "updateCompany",
      "Failed to update company. Please try again.",
    );
  }
};

export const deleteCompany = async (req: Request, res: Response) => {
  try {
    const companyId = getQueryString(req.params.companyId);
    const scope = getDataScopeFromRequest(req);
    if (!companyId) {
      return res.status(400).json({ success: false, message: "Company ID is required" });
    }
    const existingCompany = await (prismaInstance as any).techParkCompany.findFirst({
      where: { id: companyId, ...buildTechParkCompanyScopeWhere(scope) },
      select: { id: true },
    });
    if (!existingCompany) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    await (prismaInstance as any).techParkCompany.delete({ where: { id: companyId } });
    res.json({ success: true, message: "Company deleted" });
  } catch (error) {
    return sendNewTechParkSafeError(
      res,
      error,
      "deleteCompany",
      "Failed to delete company",
    );
  }
};

export const changeCompanyStatus = async (req: Request, res: Response) => {
  try {
    const companyId = getQueryString(req.params.companyId);
    const { updatedStatus } = req.body;
    const scope = getDataScopeFromRequest(req);

    if (!companyId || typeof updatedStatus !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "Missing or invalid company ID or status" });
    }

    const validStatuses = [
      "NOT_CONTACTED",
      "CONTACTED",
      "INTERESTED",
      "MEETING_SCHEDULED",
      "PROPOSAL_SENT",
      "IN_PROGRESS",
      "CLOSED",
    ] as const;
    if (!validStatuses.includes(updatedStatus as any)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid status value" });
    }

    const existingCompany = await (prismaInstance as any).techParkCompany.findFirst({
      where: { id: companyId, ...buildTechParkCompanyScopeWhere(scope) },
      select: { id: true },
    });
    if (!existingCompany) {
      return res.status(404).json({ success: false, error: "Company not found" });
    }

    const updatedCompany = await (prismaInstance as any).techParkCompany.update({
      where: { id: companyId },
      data: { business_status: updatedStatus as (typeof validStatuses)[number] },
    });

    res.json({ success: true, data: updatedCompany });
  } catch (err) {
    return sendNewTechParkSafeError(
      res,
      err,
      "changeCompanyStatus",
      "Unable to update company status right now. Please try again.",
    );
  }
};

export const deleteTechPark = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = getQueryString(req.params.id);
    const scope = getDataScopeFromRequest(req);

    if (!id) {
      return res.status(400).json({ error: "Tech park ID is required." });
    }

    const accessWhere: any = { id };
    applyScopeToStateCityWhere(accessWhere, scope);
    const existingTechPark = await prismaInstance.newTechPark.findFirst({
      where: accessWhere,
    });

    if (!existingTechPark) {
      return res.status(404).json({ error: "Tech park not found." });
    }

    await prismaInstance.newTechPark.delete({
      where: { id },
    });

    return res.status(200).json({ message: "Tech park deleted successfully." });
  } catch (error: any) {
    if (error.code === "P2023") {
      return res.status(400).json({ error: "Invalid tech park ID format." });
    }

    return sendNewTechParkSafeError(
      res,
      error,
      "deleteTechPark",
      "Unable to delete tech park right now. Please try again.",
    );
  }
};


export const editTechPark = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = getQueryString(req.params.id);
    const updateData = req.body ?? {};
    const scope = getDataScopeFromRequest(req);

    if (!id) {
      return res.status(400).json({ error: "Tech park ID is required." });
    }

    const accessWhere: any = { id };
    applyScopeToStateCityWhere(accessWhere, scope);
    const existingTechPark = await prismaInstance.newTechPark.findFirst({
      where: accessWhere,
    });

    if (!existingTechPark) {
      return res.status(404).json({ error: "Tech park not found." });
    }

    const toTrimmedString = (value: unknown) =>
      typeof value === "string" ? value.trim() : "";
    const toOptionalTrimmedStringOrUndefined = (value: unknown) => {
      if (value === undefined) return undefined;
      const s = toTrimmedString(value);
      return s ? s : null;
    };
    const toOptionalIntOrUndefined = (value: unknown) => {
      if (value === undefined) return undefined;
      if (value === null || value === "") return null;
      const n = typeof value === "number" ? value : Number(String(value).trim());
      if (!Number.isFinite(n) || !Number.isInteger(n)) return undefined;
      return n;
    };
    const normalizePhone10OrUndefined = (value: unknown) => {
      if (value === undefined) return undefined;
      const digits = toTrimmedString(value).replace(/[^\d]/g, "");
      return digits ? digits : null;
    };
    const isValidEmail = (value: string) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    const toOptionalFloatOrUndefined = (value: unknown) => {
      if (value === undefined) return undefined;
      if (value === null || value === "") return null;
      const n = typeof value === "number" ? value : Number(String(value).trim());
      if (!Number.isFinite(n)) return undefined;
      return n;
    };

    const allowedUpdate: any = {
      name: toOptionalTrimmedStringOrUndefined(updateData.name),
      address_line1: toOptionalTrimmedStringOrUndefined(updateData.address_line1),
      address_line2: toOptionalTrimmedStringOrUndefined(updateData.address_line2),
      locality: toOptionalTrimmedStringOrUndefined(updateData.locality),
      city: toOptionalTrimmedStringOrUndefined(updateData.city),
      district: toOptionalTrimmedStringOrUndefined(updateData.district),
      state: toOptionalTrimmedStringOrUndefined(updateData.state),
      pincode: toOptionalTrimmedStringOrUndefined(updateData.pincode),
      country: toOptionalTrimmedStringOrUndefined(updateData.country),
      website: toOptionalTrimmedStringOrUndefined(updateData.website),
      reception_phone: toOptionalTrimmedStringOrUndefined(updateData.reception_phone),
      international_phone: toOptionalTrimmedStringOrUndefined(updateData.international_phone),
      generic_email: toOptionalTrimmedStringOrUndefined(updateData.generic_email),
      contact_page_url: toOptionalTrimmedStringOrUndefined(updateData.contact_page_url),
      map_url: toOptionalTrimmedStringOrUndefined(updateData.map_url),
      rating:
        updateData.rating === undefined
          ? undefined
          : updateData.rating === null || updateData.rating === ""
            ? null
            : (() => {
              const n = Number(updateData.rating);
              return Number.isFinite(n) ? n : undefined;
            })(),
      total_ratings: toOptionalIntOrUndefined(updateData.total_ratings),
      business_status: toOptionalTrimmedStringOrUndefined(updateData.business_status),
      types: Array.isArray(updateData.types) ? updateData.types : undefined,
      is_active:
        typeof updateData.is_active === "boolean"
          ? updateData.is_active
          : updateData.is_active === undefined
            ? undefined
            : typeof updateData.is_active === "string"
              ? updateData.is_active.trim().toLowerCase() === "true"
              : Boolean(updateData.is_active),
      status: toOptionalTrimmedStringOrUndefined(updateData.status),

      // New fields
      exterior_media_url: toOptionalTrimmedStringOrUndefined(updateData.exterior_media_url),
      exterior_media_urls: Array.isArray(updateData.exterior_media_urls) ? updateData.exterior_media_urls : undefined,
      builder_name: toOptionalTrimmedStringOrUndefined(updateData.builder_name),
      security_agency_name: toOptionalTrimmedStringOrUndefined(updateData.security_agency_name),
      property_manager_name: toOptionalTrimmedStringOrUndefined(updateData.property_manager_name),
      property_manager_phone: normalizePhone10OrUndefined(updateData.property_manager_phone),
      property_manager_email: toOptionalTrimmedStringOrUndefined(updateData.property_manager_email),
      parking_floors: toOptionalIntOrUndefined(updateData.parking_floors),
      total_floors: toOptionalIntOrUndefined(updateData.total_floors),
      basement_levels: toOptionalIntOrUndefined(updateData.basement_levels),
      spoc_name: toOptionalTrimmedStringOrUndefined(updateData.spoc_name),
      spoc_phone: normalizePhone10OrUndefined(updateData.spoc_phone),
      seating_capacity: toOptionalIntOrUndefined(updateData.seating_capacity),
      challenges: toOptionalTrimmedStringOrUndefined(updateData.challenges),
      lat: toOptionalFloatOrUndefined(updateData.lat),
      lng: toOptionalFloatOrUndefined(updateData.lng),
    };

    // Remove undefined keys so Prisma doesn't attempt to set them.
    Object.keys(allowedUpdate).forEach((k) => {
      if (allowedUpdate[k] === undefined) delete allowedUpdate[k];
    });

    // Field-level validation for edits (only when provided)
    if (typeof allowedUpdate.property_manager_phone === "string" && allowedUpdate.property_manager_phone.length !== 10) {
      return res.status(400).json({ error: "Property manager contact must be a 10-digit number." });
    }
    if (typeof allowedUpdate.spoc_phone === "string" && allowedUpdate.spoc_phone.length !== 10) {
      return res.status(400).json({ error: "SPOC contact must be a 10-digit number." });
    }
    if (typeof allowedUpdate.property_manager_email === "string" && !isValidEmail(allowedUpdate.property_manager_email)) {
      return res.status(400).json({ error: "Property manager email must be a valid email ID." });
    }
    if (typeof allowedUpdate.lat === "number" && (allowedUpdate.lat < -90 || allowedUpdate.lat > 90)) {
      return res.status(400).json({ error: "Latitude must be between -90 and 90." });
    }
    if (typeof allowedUpdate.lng === "number" && (allowedUpdate.lng < -180 || allowedUpdate.lng > 180)) {
      return res.status(400).json({ error: "Longitude must be between -180 and 180." });
    }
    if (typeof allowedUpdate.rating === "number" && (allowedUpdate.rating < 0 || allowedUpdate.rating > 5)) {
      return res.status(400).json({ error: "Rating must be between 0 and 5." });
    }
    if (Array.isArray(allowedUpdate.exterior_media_urls)) {
      const urls = allowedUpdate.exterior_media_urls
        .filter((v: unknown) => typeof v === "string")
        .map((v: string) => v.trim())
        .filter(Boolean);
      if (urls.length === 0) {
        return res.status(400).json({ error: "At least 1 exterior photo URL is required." });
      }
      if (urls.length > 5) {
        return res.status(400).json({ error: "Maximum 5 exterior photo URLs are allowed." });
      }
      try {
        for (const urlStr of urls) {
          // eslint-disable-next-line no-new
          new URL(urlStr);
        }
      } catch {
        return res.status(400).json({ error: "Exterior media must be a valid URL." });
      }
      allowedUpdate.exterior_media_urls = urls;
      allowedUpdate.exterior_media_url = urls[0];
    } else if (typeof allowedUpdate.exterior_media_url === "string") {
      try {
        // eslint-disable-next-line no-new
        new URL(allowedUpdate.exterior_media_url);
      } catch {
        return res.status(400).json({ error: "Exterior media must be a valid URL." });
      }
      allowedUpdate.exterior_media_urls = [allowedUpdate.exterior_media_url];
    }

    const nextState = allowedUpdate.state ?? existingTechPark.state ?? null;
    const nextCity = allowedUpdate.city ?? existingTechPark.city ?? null;
    if (!canAccessStateCity(scope, nextState, nextCity)) {
      return res.status(403).json({
        error: "You do not have access to move this record to the selected location.",
      });
    }

    const updatedTechPark = await prismaInstance.newTechPark.update({
      where: { id },
      data: allowedUpdate,
    });

    try {
      const diffs = diffObjects(existingTechPark, allowedUpdate, undefined, ["updatedAt"]);
      if (diffs) {
        await createActivityLog({
          entityType: ActivityEntityType.TECH_PARK,
          entityId: id,
          action: ActivityAction.UPDATE,
          summary: `Updated tech park details`,
          changedFields: diffs,
          actor: {
            id: req.user?.userId || "unknown",
            name: "unknown",
            role: "unknown",
          },
          reqContext: {
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          },
        });

        // Handle STATUS_CHANGE if included in allowedUpdate
        if (diffs.status && diffs.status.from !== diffs.status.to) {
          await createActivityLog({
            entityType: ActivityEntityType.TECH_PARK,
            entityId: id,
            action: ActivityAction.STATUS_CHANGE,
            summary: `Status changed to ${diffs.status.to}`,
            changedFields: { status: diffs.status },
            actor: {
              id: req.user?.userId || "unknown",
              name: "unknown",
              role: "unknown",
            },
            reqContext: { ipAddress: req.ip, userAgent: req.headers["user-agent"] },
          });
        }
      }
    } catch (e) { }

    return res.status(200).json({
      success: true,
      message: "Tech park updated successfully.",
      data: updatedTechPark,
    });
  } catch (error: any) {
    if (error.code === "P2023") {
      return res.status(400).json({ error: "Invalid tech park ID format." });
    }
    if (error instanceof SyntaxError) {
      return res.status(400).json({ error: "Invalid JSON in request body." });
    }
    return sendNewTechParkSafeError(
      res,
      error,
      "editTechPark",
      "Unable to update tech park right now. Please try again.",
    );
  }
};

export const getTechParkById = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = getQueryString(req.params.id);
    const scope = getDataScopeFromRequest(req);

    if (!id) {
      return res.status(400).json({ error: "Tech park ID is required." });
    }

    const accessWhere: any = { id };
    applyScopeToStateCityWhere(accessWhere, scope);
    const techPark = await prismaInstance.newTechPark.findFirst({
      where: accessWhere,
    });

    if (!techPark) {
      return res.status(404).json({ error: "Tech park not found." });
    }

    const formState = getVerificationFormState(techPark);
    const lifecycleStatus = getVerificationLifecycleStatus(techPark);

    let finalPhotoUrl = techPark.photo_url;
    if (finalPhotoUrl && process.env.GOOGLE_API_KEY) {
      if (finalPhotoUrl.startsWith("http") && finalPhotoUrl.includes("key=")) {
        // Replace potentially stale key with active key
        finalPhotoUrl = finalPhotoUrl.replace(/([?&]key=)([^&]+)/, `$1${process.env.GOOGLE_API_KEY}`);
      } else if (!finalPhotoUrl.startsWith("http")) {
        // Construct URL from reference
        finalPhotoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${finalPhotoUrl}&key=${process.env.GOOGLE_API_KEY}`;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        ...techPark,
        photo_url: finalPhotoUrl,
        verificationLifecycleStatus: lifecycleStatus,
        isVerificationFormComplete: formState.isFormComplete,
        hasVerificationProgress: formState.hasFormProgress,
        missingVerificationFields: formState.missingFields,
      },
    });
  } catch (error: any) {
    if (error.code === "P2023") {
      return res.status(400).json({ error: "Invalid tech park ID format." });
    }
    return sendNewTechParkSafeError(
      res,
      error,
      "getTechParkById",
      "Unable to fetch tech park details right now. Please try again.",
    );
  }
};

export const rejectTechParkDetails = async (req: Request, res: Response) => {
  try {
    const id = getQueryString(req.params.id);
    const scope = getDataScopeFromRequest(req);
    const actorUserId = req.user?.userId;
    const actorPermissionSet = getRequestPermissionSet(req);

    if (!id) {
      return res.status(400).json({ success: false, error: "Tech park ID is required" });
    }
    if (!actorUserId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }
    if (!canApproveTechParkReview(actorPermissionSet)) {
      return res.status(403).json({
        success: false,
        error: "Only super admin can reject tech park verification.",
      });
    }

    const accessWhere: any = { id, is_active: true };
    applyScopeToStateCityWhere(accessWhere, scope);

    const updatedTechPark = await prismaInstance.newTechPark.update({
      where: accessWhere,
      data: {
        isVerified: false,
        reviewStatus: "REJECTED",
        is_active: false,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Tech park rejected and marked inactive.",
      data: updatedTechPark,
    });
  } catch (err) {
    return sendNewTechParkSafeError(
      res,
      err,
      "rejectTechParkDetails",
      "Unable to reject this tech park right now.",
    );
  }
};

export const getPendingReviews = async (req: Request, res: Response) => {
  try {
    const scope = getDataScopeFromRequest(req);
    const actorPermissionSet = getRequestPermissionSet(req);
    if (!canApproveTechParkReview(actorPermissionSet)) {
      return res.status(403).json({
        success: false,
        error: "Only super admin can view pending reviews.",
      });
    }
    const where: any = {
      is_active: true,
      reviewStatus: "PENDING_REVIEW",
      verifiedByUserId: { not: null },
    };
    applyScopeToStateCityWhere(where, scope);

    const pendingParks = await prismaInstance.newTechPark.findMany({
      where,
      orderBy: { duplication_score: "desc" },
      include: {
        verifiedByUser: {
          select: { name: true }
        }
      }
    });

    const readyForReview = pendingParks.filter(
      (park) => getVerificationFormState(park).isFormComplete,
    );

    return res.json({
      success: true,
      data: readyForReview,
    });
  } catch (err) {
    return sendNewTechParkSafeError(
      res,
      err,
      "getPendingReviews",
      "Failed to fetch pending reviews.",
    );
  }
};
