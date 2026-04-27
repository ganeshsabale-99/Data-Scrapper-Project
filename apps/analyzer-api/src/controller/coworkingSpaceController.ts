import { prismaInstance, type CoworkingSpace, type CoworkingCompany } from "@repo/db";
import { Request, Response } from "express";
import { calculateStatusAnalytics } from "../utils/analyticsUtils";
import { getQueryString } from "../utils/queryUtils";
import { INDIA_STATES_AND_UTS } from "../utils/indiaStates";
import { normalizeCity } from "../utils/cityNormalization";
import { matchEnumValue } from "../utils/enumSearch";
import { getPostgresEnumValues } from "../utils/dbEnums";
import {
    applyScopeToStateCityWhere,
    buildCoworkingCompanyScopeWhere,
    canAccessStateCity,
    getDataScopeFromRequest,
} from "../utils/dataScope";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";

export const getOverviewData = async (req: Request, res: Response) => {
    try {
        const scope = getDataScopeFromRequest(req);
        const where: any = {};
        applyScopeToStateCityWhere(where, scope);
        const [totalCoworkingSpaces, statusGroups, stateGroups] = await Promise.all([
            prismaInstance.coworkingSpace.count({ where }),
            prismaInstance.coworkingSpace.groupBy({
                by: ["status"],
                where,
                _count: { _all: true },
            }),
            prismaInstance.coworkingSpace.groupBy({
                by: ["state"],
                where,
                _count: { _all: true },
            }),
        ]);

        const statusCounts: Record<string, number> = {};
        statusGroups.forEach((group) => {
            statusCounts[String(group.status || "NOT_CONTACTED")] = Number(
                group._count?._all ?? 0,
            );
        });
        const contactedCoworkingSpaces = totalCoworkingSpaces - (statusCounts["NOT_CONTACTED"] ?? 0);
        const positiveResponses =
            (statusCounts["INTERESTED"] ?? 0) +
            (statusCounts["MEETING_SCHEDULED"] ?? 0) +
            (statusCounts["PROPOSAL_SENT"] ?? 0);
        const responseRate =
            contactedCoworkingSpaces > 0
                ? Number(((positiveResponses / contactedCoworkingSpaces) * 100).toFixed(2))
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
            totalCoworkingSpaces,
            contactedCoworkingSpaces,
            positiveResponses,
            responseRate,
            stateData,
        });
    } catch (error) {
        return sendCoworkingSafeError(
            res,
            error,
            "getOverviewData",
            "Failed to fetch overview data",
        );
    }
};

const sendCoworkingSafeError = (
    res: Response,
    error: unknown,
    context: string,
    fallbackMessage: string,
) =>
    sendSafeErrorResponse(
        res,
        error,
        `coworking.${context}`,
        fallbackMessage,
    );

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

        const coworkingWhere: any = {
            state: { equals: state, mode: "insensitive" },
        };
        applyScopeToStateCityWhere(coworkingWhere, scope);
        const [totalCoworkingSpaces, statusGroups, cityGroups] = await Promise.all([
            prismaInstance.coworkingSpace.count({ where: coworkingWhere }),
            prismaInstance.coworkingSpace.groupBy({
                by: ["status"],
                where: coworkingWhere,
                _count: { _all: true },
            }),
            prismaInstance.coworkingSpace.groupBy({
                by: ["city"],
                where: coworkingWhere,
                _count: { _all: true },
            }),
        ]);

        const statusCounts: Record<string, number> = {};
        statusGroups.forEach((group) => {
            statusCounts[String(group.status || "NOT_CONTACTED")] = Number(
                group._count?._all ?? 0,
            );
        });
        const contactedCoworkingSpaces = totalCoworkingSpaces - (statusCounts["NOT_CONTACTED"] ?? 0);
        const positiveResponses =
            (statusCounts["INTERESTED"] ?? 0) +
            (statusCounts["MEETING_SCHEDULED"] ?? 0) +
            (statusCounts["PROPOSAL_SENT"] ?? 0);
        const responseRate =
            contactedCoworkingSpaces > 0
                ? Number(((positiveResponses / contactedCoworkingSpaces) * 100).toFixed(2))
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
            totalCoworkingSpaces,
            contactedCoworkingSpaces,
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
        return sendCoworkingSafeError(
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
        const verifiedFilter = getQueryString(req.query.verified); // 'ALL', 'VERIFIED', 'UNVERIFIED'
        const skip = (page - 1) * pageSize;

        const where: any = {
            state: { equals: state, mode: "insensitive" },
            city: { equals: city, mode: "insensitive" },
        };
        applyScopeToStateCityWhere(where, scope);

        if (verifiedFilter === "VERIFIED") {
            where.isVerified = true;
        } else if (verifiedFilter === "UNVERIFIED") {
            where.isVerified = false;
        }

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
            const dbEnumValues = await getPostgresEnumValues(prismaInstance, "Status");
            const statusMatch =
                statusCandidate && dbEnumValues?.includes(statusCandidate)
                    ? statusCandidate
                    : undefined;

            where.OR = [
                { name: { contains: trimmed, mode: 'insensitive' } },
                { address: { contains: trimmed, mode: 'insensitive' } },
                { operator_name: { contains: trimmed, mode: 'insensitive' } },
                { campus_brand: { contains: trimmed, mode: 'insensitive' } },
                { contact_phone: { contains: trimmed, mode: 'insensitive' } },
                { generic_email: { contains: trimmed, mode: 'insensitive' } },
                ...(statusMatch ? [{ status: statusMatch }] : []),
            ];
        }

        const totalItems = await prismaInstance.coworkingSpace.count({ where });

        const coworkingSpaces = await prismaInstance.coworkingSpace.findMany({
            where,
            orderBy: { name: 'asc' },
            skip,
            take: pageSize,
        });

        const totalCoworkingSpaces = totalItems;
        const statusGroups = await prismaInstance.coworkingSpace.groupBy({
            by: ["status"],
            where,
            _count: { _all: true },
        });
        const statusCounts: Record<string, number> = {};
        statusGroups.forEach((g: any) => {
            statusCounts[String(g.status)] = Number(g._count?._all ?? 0);
        });

        const notContactedCount = statusCounts["NOT_CONTACTED"] ?? 0;
        const contactedCoworkingSpaces = totalItems - notContactedCount;
        const positiveResponses =
            (statusCounts["INTERESTED"] ?? 0) +
            (statusCounts["MEETING_SCHEDULED"] ?? 0) +
            (statusCounts["PROPOSAL_SENT"] ?? 0);
        const responseRate =
            contactedCoworkingSpaces > 0
                ? Number(((positiveResponses / contactedCoworkingSpaces) * 100).toFixed(2))
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

        const items = coworkingSpaces.map((cs: CoworkingSpace, index: number) => ({
            id: cs.id,
            name: cs.name,
            address: cs.address || 'N/A',
            contactPhone: cs.contact_phone || cs.international_phone || null,
            status: cs.status,
            operator: cs.operator_name || null,
            campusBrand: cs.campus_brand || null,
            city: cs.city || 'N/A',
            state: cs.state || 'N/A',
            rating: cs.rating || null,
            map_url: cs.map_url || null,
            website: cs.website || null,
            builder_name: cs.builder_name || null,
            security_agency_name: cs.security_agency_name || null,
            property_manager_name: cs.property_manager_name || null,
            property_manager_phone: cs.property_manager_phone || null,
            property_manager_email: cs.property_manager_email || null,
            parking_floors: cs.parking_floors || 0,
            total_floors: cs.total_floors || 0,
            basement_levels: cs.basement_levels || 0,
            spoc_name: cs.spoc_name || null,
            spoc_phone: cs.spoc_phone || null,
            seating_capacity: cs.seating_capacity || 0,
            challenges: cs.challenges || null,
            lat: cs.lat || null,
            lng: cs.lng || null,
            generic_email: cs.generic_email || null,
            legal_entity: cs.legal_entity || null,
            district: cs.district || null,
            pincode: cs.pincode || null,
            country: cs.country || null,
            campus_size_hint: cs.campus_size_hint || null,
            exterior_media_url: cs.exterior_media_url || null,
            exterior_media_urls: cs.exterior_media_urls || [],
            serialNumber: skip + index + 1,
        }));

        res.json({
            success: true,
            state,
            city,
            totalCoworkingSpaces,
            contactedCoworkingSpaces,
            positiveResponses,
            responseRate,
            statusBreakdown,
            items,
            page,
            pageSize,
            totalItems,
            totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
        });
    } catch (error) {
        return sendCoworkingSafeError(
            res,
            error,
            "getCityWiseOverview",
            "Failed to fetch city-wise overview data",
        );
    }
};

// Add Coworking Space
export const addCoworkingSpace = async (req: Request, res: Response) => {
    try {
        console.log('addCoworkingSpace payload:', JSON.stringify(req.body, null, 2));
        const {
            name,
            district,
            pincode,
            country,
            address,
            contact_phone,
            international_phone,
            generic_email,
            operator_name,
            campus_brand,
            legal_entity,
            campus_size_hint,
            status = 'NOT_CONTACTED',
            map_url,
            website,
            rating,
            exterior_media_url,
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
            exterior_media_urls,
            lat,
            lng,
        } = req.body;

        console.log('addCoworkingSpace payload details:', {
            name,
            generic_email,
            district,
            pincode,
            exterior_media_urls_count: exterior_media_urls?.length
        });

        const stateParam = getQueryString(req.params.state);
        const cityParam = getQueryString(req.params.city);

        // If cityParam or stateParam are numbers (IDs), we should prefer the names from the body if they exist
        const bodyCity = req.body.city;
        const bodyState = req.body.state;

        const normalizedState = (stateParam && isNaN(Number(stateParam)) ? stateParam : bodyState || stateParam || "").trim();
        const normalizedCity = (cityParam && isNaN(Number(cityParam)) ? cityParam : bodyCity || cityParam || "").trim();

        if (
            stateParam &&
            req.body.state &&
            stateParam.trim().toLowerCase() !== String(req.body.state).trim().toLowerCase()
        ) {
            return res.status(400).json({
                success: false,
                message: "State in URL and payload must match",
            });
        }
        if (
            cityParam &&
            req.body.city &&
            cityParam.trim().toLowerCase() !== String(req.body.city).trim().toLowerCase()
        ) {
            return res.status(400).json({
                success: false,
                message: "City in URL and payload must match",
            });
        }

        const scope = getDataScopeFromRequest(req);
        if (!canAccessStateCity(scope, normalizedState, normalizedCity)) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to create records in this location",
            });
        }

        if (!name || !normalizedCity || !normalizedState) {
            return res.status(400).json({
                success: false,
                message: "Name, city, and state are required fields"
            });
        }

        const existingSpace = await prismaInstance.coworkingSpace.findFirst({
            where: {
                name: { equals: name.trim(), mode: 'insensitive' },
                city: { equals: normalizedCity, mode: 'insensitive' },
                state: { equals: normalizedState, mode: 'insensitive' },
            }
        });

        if (existingSpace) {
            return res.status(409).json({
                success: false,
                message: "A coworking space with this exact name already exists in this city."
            });
        }

        const coworkingSpace = await prismaInstance.coworkingSpace.create({
            data: {
                name,
                city: normalizedCity,
                state: normalizedState,
                district: district || null,
                pincode: pincode || null,
                country: country || null,
                address: address || null,
                contact_phone: contact_phone || null,
                international_phone: international_phone || null,
                generic_email: generic_email || null,
                operator_name: operator_name || null,
                campus_brand: campus_brand || null,
                legal_entity: legal_entity || null,
                campus_size_hint: campus_size_hint || null,
                status: status as any,
                map_url: map_url || null,
                website: website || null,
                rating: (rating !== undefined && rating !== null && rating !== '') ? Number(rating) : null,
                exterior_media_url: exterior_media_url || null,
                builder_name: builder_name || null,
                security_agency_name: security_agency_name || null,
                property_manager_name: property_manager_name || null,
                property_manager_phone: property_manager_phone || null,
                property_manager_email: property_manager_email || null,
                parking_floors: (parking_floors !== undefined && parking_floors !== null && parking_floors !== '') ? Number(parking_floors) : null,
                total_floors: (total_floors !== undefined && total_floors !== null && total_floors !== '') ? Number(total_floors) : null,
                basement_levels: (basement_levels !== undefined && basement_levels !== null && basement_levels !== '') ? Number(basement_levels) : null,
                spoc_name: spoc_name || null,
                spoc_phone: spoc_phone || null,
                seating_capacity: (seating_capacity !== undefined && seating_capacity !== null && seating_capacity !== '') ? Number(seating_capacity) : null,
                challenges: challenges || null,
                exterior_media_urls: exterior_media_urls || [],
                lat: (lat !== undefined && lat !== null && lat !== '') ? Number(lat) : null,
                lng: (lng !== undefined && lng !== null && lng !== '') ? Number(lng) : null,
            },
        });

        res.status(201).json({
            success: true,
            message: "Coworking space created successfully",
            data: coworkingSpace,
        });
    } catch (error: any) {
        console.error('Error in addCoworkingSpace:', error);
        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message: "A coworking space with this information already exists"
            });
        }
        return sendCoworkingSafeError(
            res,
            error,
            "addCoworkingSpace",
            "Failed to create coworking space",
        );
    }
};

export const updateCoworkingSpace = async (req: Request, res: Response) => {
    try {
        const id = getQueryString(req.params.id);
        const updateData = req.body ?? {};
        const scope = getDataScopeFromRequest(req);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Coworking space ID is required"
            });
        }

        const accessWhere: any = { id };
        applyScopeToStateCityWhere(accessWhere, scope);
        const existingCoworkingSpace = await prismaInstance.coworkingSpace.findFirst({
            where: accessWhere,
        });

        if (!existingCoworkingSpace) {
            return res.status(404).json({
                success: false,
                message: "Coworking space not found"
            });
        }

        const nextState = updateData?.state ?? existingCoworkingSpace.state;
        const nextCity = updateData?.city ?? existingCoworkingSpace.city;
        if (!canAccessStateCity(scope, nextState, nextCity)) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to move this record to the selected location",
            });
        }

        if (typeof updateData !== "object" || updateData === null || Array.isArray(updateData)) {
            return res.status(400).json({
                success: false,
                message: "Invalid update payload",
            });
        }

        const hasOwn = (field: string) =>
            Object.prototype.hasOwnProperty.call(updateData, field);
        const trimIfString = (value: unknown) =>
            typeof value === "string" ? value.trim() : value;

        const stringFieldsToTrim = [
            "name",
            "city",
            "state",
            "district",
            "pincode",
            "country",
            "address",
            "contact_phone",
            "international_phone",
            "generic_email",
            "operator_name",
            "campus_brand",
            "legal_entity",
            "campus_size_hint",
            "map_url",
            "website",
            "exterior_media_url",
            "builder_name",
            "security_agency_name",
            "property_manager_name",
            "property_manager_phone",
            "property_manager_email",
            "spoc_name",
            "spoc_phone",
            "challenges",
        ];

        stringFieldsToTrim.forEach((field) => {
            if (hasOwn(field)) {
                updateData[field] = trimIfString(updateData[field]);
            }
        });

        const requiredStringFields: Array<{ key: string; label: string }> = [
            { key: "name", label: "Name" },
            { key: "address", label: "Address" },
            { key: "contact_phone", label: "Contact number" },
            { key: "builder_name", label: "Builder name" },
            { key: "security_agency_name", label: "Security agency name" },
            { key: "property_manager_name", label: "Property manager name" },
            { key: "property_manager_phone", label: "Property manager contact" },
            { key: "property_manager_email", label: "Property manager email" },
            { key: "spoc_name", label: "SPOC name" },
            { key: "spoc_phone", label: "SPOC contact" },
            { key: "challenges", label: "Challenges" },
        ];

        for (const { key, label } of requiredStringFields) {
            if (!hasOwn(key)) continue;
            const value = updateData[key];
            if (typeof value !== "string" || value.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: `${label} is required`,
                });
            }
        }

        const phoneRegex = /^(\+91[\s-]?)?[0-9]{10}$/;
        const phoneFields: Array<{ key: string; label: string }> = [
            { key: "contact_phone", label: "Contact number" },
            { key: "property_manager_phone", label: "Property manager contact" },
            { key: "spoc_phone", label: "SPOC contact" },
        ];

        for (const { key, label } of phoneFields) {
            if (!hasOwn(key)) continue;
            const value = String(updateData[key] ?? "");
            if (!phoneRegex.test(value.replace(/\s/g, ""))) {
                return res.status(400).json({
                    success: false,
                    message: `Please enter a valid 10-digit phone number for ${label}`,
                });
            }
        }

        if (hasOwn("property_manager_email")) {
            const email = String(updateData.property_manager_email ?? "");
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a valid property manager email",
                });
            }
        }

        if (hasOwn("generic_email")) {
            const email = String(updateData.generic_email ?? "");
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a valid email ID",
                });
            }
        }

        if (hasOwn("pincode")) {
            const pincode = String(updateData.pincode ?? "");
            if (pincode && !/^\d{6}$/.test(pincode)) {
                return res.status(400).json({
                    success: false,
                    message: "Pincode must be 6 digits",
                });
            }
        }

        const requiredNumericFields: Array<{ key: string; label: string }> = [
            { key: "parking_floors", label: "Parking floors" },
            { key: "total_floors", label: "Total floors" },
            { key: "basement_levels", label: "Basement levels" },
            { key: "seating_capacity", label: "Seating capacity" },
        ];

        for (const { key, label } of requiredNumericFields) {
            if (!hasOwn(key)) continue;
            const raw = updateData[key];
            if (raw === "" || raw === null || raw === undefined) {
                return res.status(400).json({
                    success: false,
                    message: `${label} is required`,
                });
            }
            const numericValue = Number(raw);
            if (!Number.isFinite(numericValue) || !Number.isInteger(numericValue) || numericValue < 0) {
                return res.status(400).json({
                    success: false,
                    message: `${label} must be a non-negative integer`,
                });
            }
            updateData[key] = numericValue;
        }

        const hasLat = hasOwn("lat");
        const hasLng = hasOwn("lng");
        if (hasLat || hasLng) {
            const rawLat = updateData.lat;
            const rawLng = updateData.lng;
            if (
                rawLat === "" || rawLat === null || rawLat === undefined ||
                rawLng === "" || rawLng === null || rawLng === undefined
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Latitude and longitude are required",
                });
            }

            const lat = Number(rawLat);
            const lng = Number(rawLng);
            if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide valid coordinates",
                });
            }
            updateData.lat = lat;
            updateData.lng = lng;
        }

        if (hasOwn("exterior_media_urls")) {
            if (!Array.isArray(updateData.exterior_media_urls)) {
                return res.status(400).json({
                    success: false,
                    message: "Exterior photos must be an array",
                });
            }
            const sanitizedExteriorUrls = updateData.exterior_media_urls
                .filter((url: unknown) => typeof url === "string")
                .map((url: string) => url.trim())
                .filter((url: string) => url.length > 0);

            if (sanitizedExteriorUrls.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "At least 1 exterior photo is required",
                });
            }

            updateData.exterior_media_urls = sanitizedExteriorUrls.slice(0, 5);
            updateData.exterior_media_url = updateData.exterior_media_urls[0];
        }

        const numericFields = [
            "rating",
        ];

        numericFields.forEach((field) => {
            if (updateData[field] !== undefined && updateData[field] !== null && updateData[field] !== "") {
                updateData[field] = Number(updateData[field]);
            } else if (updateData[field] === "") {
                updateData[field] = null;
            }
        });

        const updatedCoworkingSpace = await prismaInstance.coworkingSpace.update({
            where: { id },
            data: updateData,
        });

        res.json({
            success: true,
            message: "Coworking space updated successfully",
            data: updatedCoworkingSpace,
        });
    } catch (error: any) {
        console.error('Error in updateCoworkingSpace:', error);
        if (error.code === "P2023") {
            return res.status(400).json({
                success: false,
                message: "Invalid coworking space ID format"
            });
        }
        return sendCoworkingSafeError(
            res,
            error,
            "updateCoworkingSpace",
            "Failed to update coworking space",
        );
    }
};

export const deleteCoworkingSpace = async (req: Request, res: Response) => {
    try {
        const id = getQueryString(req.params.id);
        const scope = getDataScopeFromRequest(req);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Coworking space ID is required"
            });
        }

        const accessWhere: any = { id };
        applyScopeToStateCityWhere(accessWhere, scope);
        const existingCoworkingSpace = await prismaInstance.coworkingSpace.findFirst({
            where: accessWhere,
        });

        if (!existingCoworkingSpace) {
            return res.status(404).json({
                success: false,
                message: "Coworking space not found"
            });
        }

        await prismaInstance.coworkingSpace.delete({
            where: { id },
        });

        res.json({
            success: true,
            message: "Coworking space deleted successfully",
        });
    } catch (error: any) {
        console.error('Error in deleteCoworkingSpace:', error);
        if (error.code === "P2023") {
            return res.status(400).json({
                success: false,
                message: "Invalid coworking space ID format"
            });
        }
        return sendCoworkingSafeError(
            res,
            error,
            "deleteCoworkingSpace",
            "Failed to delete coworking space",
        );
    }
};

export const getCoworkingSpaceById = async (req: Request, res: Response) => {
    try {
        const id = getQueryString(req.params.id);
        const scope = getDataScopeFromRequest(req);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Coworking space ID is required"
            });
        }

        const accessWhere: any = { id };
        applyScopeToStateCityWhere(accessWhere, scope);
        const coworkingSpace = await prismaInstance.coworkingSpace.findFirst({
            where: accessWhere,
        });

        if (!coworkingSpace) {
            return res.status(404).json({
                success: false,
                message: "Coworking space not found"
            });
        }

        res.json({
            success: true,
            data: coworkingSpace,
        });
    } catch (error: any) {
        console.error('Error in getCoworkingSpaceById:', error);
        if (error.code === "P2023") {
            return res.status(400).json({
                success: false,
                message: "Invalid coworking space ID format"
            });
        }
        return sendCoworkingSafeError(
            res,
            error,
            "getCoworkingSpaceById",
            "Failed to fetch coworking space",
        );
    }
};

export const changeStatus = async (req: Request, res: Response) => {
    try {
        const id = getQueryString(req.params.id);
        const { updatedStatus } = req.body;
        const scope = getDataScopeFromRequest(req);

        if (!id || typeof updatedStatus !== "string") {
            return res.status(400).json({
                success: false,
                message: "Missing or invalid coworking space ID or status"
            });
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
            return res.status(400).json({
                success: false,
                message: "Invalid status value"
            });
        }

        const accessWhere: any = { id };
        applyScopeToStateCityWhere(accessWhere, scope);
        const accessibleCoworkingSpace = await prismaInstance.coworkingSpace.findFirst({
            where: accessWhere,
            select: { id: true },
        });
        if (!accessibleCoworkingSpace) {
            return res.status(404).json({
                success: false,
                message: "Coworking space not found"
            });
        }

        const updatedCoworkingSpace = await prismaInstance.coworkingSpace.update({
            where: { id },
            data: { status: updatedStatus as (typeof validStatuses)[number] },
        });

        res.json({
            success: true,
            data: updatedCoworkingSpace
        });
    } catch (error: any) {
        return sendCoworkingSafeError(
            res,
            error,
            "changeStatus",
            "Failed to update coworking space status",
        );
    }
};

export const getCompaniesByCoworkingSpace = async (req: Request, res: Response) => {
    try {
        const coworkingSpaceId = getQueryString(req.params.coworkingSpaceId);
        const scope = getDataScopeFromRequest(req);
        if (!coworkingSpaceId) {
            return res.status(400).json({
                success: false,
                message: "Coworking space ID is required"
            });
        }

        const accessWhere: any = { id: coworkingSpaceId };
        applyScopeToStateCityWhere(accessWhere, scope);
        const accessibleCoworkingSpace = await prismaInstance.coworkingSpace.findFirst({
            where: accessWhere,
            select: { id: true },
        });
        if (!accessibleCoworkingSpace) {
            return res.status(404).json({
                success: false,
                message: "Coworking space not found"
            });
        }

        const page = parseInt(getQueryString(req.query.page) || "1", 10) || 1;
        const limit = parseInt(getQueryString(req.query.limit) || "10", 10) || 10;
        const search = getQueryString(req.query.search);
        const offset = (page - 1) * limit;
        const where: any = {
            coworkingSpaceId: coworkingSpaceId,
            ...buildCoworkingCompanyScopeWhere(scope),
        };
        if (search && search.trim()) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { operator: { contains: search, mode: 'insensitive' } },
                { contact_phone: { contains: search, mode: 'insensitive' } },
                { contact_email: { contains: search, mode: 'insensitive' } },
                { business_status: { contains: search, mode: 'insensitive' } },
            ];
        }

        const totalCompanies = await prismaInstance.coworkingCompany.count({
            where,
        });
        const companies = await prismaInstance.coworkingCompany.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: limit,
        });

        const allCompanies = await prismaInstance.coworkingCompany.findMany({
            where: {
                coworkingSpaceId: coworkingSpaceId,
                ...buildCoworkingCompanyScopeWhere(scope),
            },
            select: { business_status: true },
        });

        const analytics = calculateStatusAnalytics(
            allCompanies.map(c => ({ status: c.business_status || 'NOT_CONTACTED' }))
        );

        const items = companies.map((c: CoworkingCompany, index: number) => ({
            id: c.id,
            name: c.name,
            description: c.description || '',
            business_status: c.business_status || 'NOT_CONTACTED',
            operator: c.operator || '',
            contact_phone: c.contact_phone || '',
            contact_email: c.contact_email || '',
            contact_international_phone: c.contact_international_phone || '',
            serialNumber: offset + index + 1,
        }));

        const totalPages = Math.max(1, Math.ceil(totalCompanies / limit));

        res.json({
            success: true,
            data: {
                stats: {
                    totalCompanies: analytics.total,
                    contactedCompanies: analytics.contactedCount,
                    positiveResponses: analytics.positiveResponseCount,
                    responseRate: analytics.responseRate,
                },
                statusBreakdown: analytics.statusCounts,
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
        return sendCoworkingSafeError(
            res,
            error,
            "getCompaniesByCoworkingSpace",
            "Failed to fetch companies",
        );
    }
};

export const addCompanyToCoworkingSpace = async (req: Request, res: Response) => {
    try {
        const coworkingSpaceId = getQueryString(req.params.coworkingSpaceId);
        const scope = getDataScopeFromRequest(req);
        const payload = req.body || {};

        if (!coworkingSpaceId) {
            return res.status(400).json({
                success: false,
                message: "Coworking space ID is required"
            });
        }
        if (!payload.name) {
            return res.status(400).json({
                success: false,
                message: "Company name is required"
            });
        }

        // Ensure Coworking Space exists
        const coworkingSpaceWhere: any = { id: coworkingSpaceId };
        applyScopeToStateCityWhere(coworkingSpaceWhere, scope);
        const coworkingSpace = await prismaInstance.coworkingSpace.findFirst({
            where: coworkingSpaceWhere
        });
        if (!coworkingSpace) {
            return res.status(404).json({
                success: false,
                message: "Coworking space not found"
            });
        }

        const created = await prismaInstance.coworkingCompany.create({
            data: {
                coworkingSpaceId: coworkingSpaceId,
                name: payload.name,
                description: payload.description || null,
                business_status: payload.business_status || 'NOT_CONTACTED',
                operator: payload.operator || null,
                contact_phone: payload.contact_phone || null,
                contact_email: payload.contact_email || null,
                contact_international_phone: payload.contact_international_phone || null,
            },
        });

        res.status(201).json({
            success: true,
            message: 'Company created',
            data: created
        });
    } catch (error: any) {
        console.error('Error in addCompanyToCoworkingSpace:', error);
        if (error?.code === 'P2003') {
            return res.status(400).json({
                success: false,
                message: 'Invalid Coworking Space reference'
            });
        }
        return sendCoworkingSafeError(
            res,
            error,
            "addCompanyToCoworkingSpace",
            "Failed to add company",
        );
    }
};

export const updateCompany = async (req: Request, res: Response) => {
    try {
        const companyId = getQueryString(req.params.companyId);
        const data = req.body || {};
        const scope = getDataScopeFromRequest(req);

        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: "Company ID is required"
            });
        }

        const existingCompany = await prismaInstance.coworkingCompany.findFirst({
            where: { id: companyId, ...buildCoworkingCompanyScopeWhere(scope) }
        });

        if (!existingCompany) {
            return res.status(404).json({
                success: false,
                message: "Company not found"
            });
        }

        const updateData: any = {};

        if (data.name !== undefined && data.name !== null && data.name !== '') {
            updateData.name = data.name;
        }
        if (data.description !== undefined) updateData.description = data.description;
        if (data.operator !== undefined) updateData.operator = data.operator;
        if (data.contact_phone !== undefined) updateData.contact_phone = data.contact_phone;
        if (data.contact_email !== undefined) updateData.contact_email = data.contact_email;
        if (data.contact_international_phone !== undefined) updateData.contact_international_phone = data.contact_international_phone;
        if (data.business_status !== undefined && data.business_status !== null && data.business_status !== '') {
            updateData.business_status = data.business_status;
        }

        const updated = await prismaInstance.coworkingCompany.update({
            where: { id: companyId },
            data: updateData,
        });

        res.json({
            success: true,
            message: 'Company updated',
            data: updated
        });
    } catch (error: any) {
        console.error('Error in updateCompany:', error);

        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: "Company not found"
            });
        }
        if (error.code === 'P2002') {
            return res.status(409).json({
                success: false,
                message: "Duplicate entry"
            });
        }
        if (error.code === 'P2003') {
            return res.status(400).json({
                success: false,
                message: "Invalid reference"
            });
        }

        return sendCoworkingSafeError(
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
            return res.status(400).json({
                success: false,
                message: "Company ID is required"
            });
        }
        const existingCompany = await prismaInstance.coworkingCompany.findFirst({
            where: { id: companyId, ...buildCoworkingCompanyScopeWhere(scope) },
            select: { id: true },
        });
        if (!existingCompany) {
            return res.status(404).json({
                success: false,
                message: "Company not found"
            });
        }
        await prismaInstance.coworkingCompany.delete({ where: { id: companyId } });
        res.json({
            success: true,
            message: "Company deleted"
        });
    } catch (error) {
        return sendCoworkingSafeError(
            res,
            error,
            "deleteCompany",
            "Failed to delete company",
        );
    }
};

export const getCompanyById = async (req: Request, res: Response) => {
    try {
        const companyId = getQueryString(req.params.companyId);
        const scope = getDataScopeFromRequest(req);
        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: "Company ID is required"
            });
        }
        const company = await prismaInstance.coworkingCompany.findFirst({
            where: { id: companyId, ...buildCoworkingCompanyScopeWhere(scope) }
        });
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }
        res.json({
            success: true,
            data: company
        });
    } catch (error) {
        return sendCoworkingSafeError(
            res,
            error,
            "getCompanyById",
            "Failed to fetch company",
        );
    }
};

export const changeCompanyStatus = async (req: Request, res: Response) => {
    try {
        const companyId = getQueryString(req.params.companyId);
        const { updatedStatus } = req.body;
        const scope = getDataScopeFromRequest(req);

        if (!companyId || typeof updatedStatus !== "string") {
            return res.status(400).json({
                success: false,
                message: "Missing or invalid company ID or status"
            });
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
            return res.status(400).json({
                success: false,
                message: "Invalid status value"
            });
        }

        const existingCompany = await prismaInstance.coworkingCompany.findFirst({
            where: { id: companyId, ...buildCoworkingCompanyScopeWhere(scope) },
            select: { id: true },
        });
        if (!existingCompany) {
            return res.status(404).json({
                success: false,
                message: "Company not found"
            });
        }

        const updatedCompany = await prismaInstance.coworkingCompany.update({
            where: { id: companyId },
            data: { business_status: updatedStatus as (typeof validStatuses)[number] },
        });

        res.json({
            success: true,
            data: updatedCompany
        });
    } catch (error: any) {
        return sendCoworkingSafeError(
            res,
            error,
            "changeCompanyStatus",
            "Failed to update company status",
        );
    }
};
export const verifyCoworkingSpaceDetails = async (req: Request, res: Response) => {
    try {
        const id = getQueryString(req.params.id);
        const userId = req.user?.userId;

        if (!id) {
            return res.status(400).json({ success: false, message: "ID parameter is required" });
        }

        const existing = await prismaInstance.coworkingSpace.findUnique({
            where: { id },
        });

        if (!existing) {
            return res.status(404).json({ success: false, message: "Coworking space not found" });
        }

        const updated = await prismaInstance.coworkingSpace.update({
            where: { id },
            data: {
                isVerified: true,
                verifiedAt: new Date(),
                verifiedByUserId: userId || null,
            },
        });

        // Log activity
        await prismaInstance.activityLog.create({
            data: {
                performedById: userId || null,
                performedByName: (req as any).user?.name || req.user?.identifier || "SYSTEM",
                performedByRole: req.user?.role || "SYSTEM",
                action: "VERIFY",
                entityType: "COWORKING",
                entityId: id,
                summary: `Verified coworking space: ${existing.name}`,
                meta: {
                    verified: true,
                },
            },
        });

        res.json({
            success: true,
            message: "Coworking space verified successfully",
            data: updated,
        });
    } catch (error: any) {
        return sendCoworkingSafeError(
            res,
            error,
            "verifyCoworkingSpaceDetails",
            "Failed to verify coworking space",
        );
    }
};

export const unverifyCoworkingSpaceDetails = async (req: Request, res: Response) => {
    try {
        const id = getQueryString(req.params.id);
        const userId = req.user?.userId;

        if (!id) {
            return res.status(400).json({ success: false, message: "ID parameter is required" });
        }

        const existing = await prismaInstance.coworkingSpace.findUnique({
            where: { id },
        });

        if (!existing) {
            return res.status(404).json({ success: false, message: "Coworking space not found" });
        }

        const updated = await prismaInstance.coworkingSpace.update({
            where: { id },
            data: {
                isVerified: false,
                verifiedAt: null,
                verifiedByUserId: null,
            },
        });

        // Log activity
        await prismaInstance.activityLog.create({
            data: {
                performedById: userId || null,
                performedByName: (req as any).user?.name || req.user?.identifier || "SYSTEM",
                performedByRole: req.user?.role || "SYSTEM",
                action: "UPDATE",
                entityType: "COWORKING",
                entityId: id,
                summary: `Unverified coworking space: ${existing.name}`,
                meta: {
                    verified: false,
                },
            },
        });

        res.json({
            success: true,
            message: "Coworking space unverified successfully",
            data: updated,
        });
    } catch (error: any) {
        return sendCoworkingSafeError(
            res,
            error,
            "unverifyCoworkingSpaceDetails",
            "Failed to unverify coworking space",
        );
    }
};
