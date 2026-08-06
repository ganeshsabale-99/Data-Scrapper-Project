import { prismaInstance } from "@repo/db";
import { Request, Response } from "express";
import { getQueryString } from "../utils/queryUtils";
import {
    buildCoworkingCompanyScopeWhere,
    buildTechParkCompanyScopeWhere,
    canAccessStateCity,
    getDataScopeFromRequest,
} from "../utils/dataScope";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";
import { calculateDistance } from "../utils/verificationUtils";

export const calculateLocationTrust = (
    expectedLat: number | null | undefined,
    expectedLng: number | null | undefined,
    actualLat: number | null | undefined,
    actualLng: number | null | undefined
): number => {
    if (!expectedLat || !expectedLng || !actualLat || !actualLng) return 0;
    const distanceKm = calculateDistance(expectedLat, expectedLng, actualLat, actualLng);
    const distanceMeters = distanceKm * 1000;

    if (distanceMeters <= 50) return 100; // Pinpoint
    if (distanceMeters <= 200) return 90;  // Very Close
    if (distanceMeters <= 500) return 70;  // Nearby
    if (distanceMeters <= 1000) return 40; // Marginal
    return 10; // Far
};

const hasContactLogScopeAccess = (
    scope: ReturnType<typeof getDataScopeFromRequest>,
    entry: {
        company?: { newTechPark?: { state?: string | null; city?: string | null } | null } | null;
        coworkingCompany?: { coworkingSpace?: { state?: string | null; city?: string | null } | null } | null;
        newTechPark?: { state?: string | null; city?: string | null } | null;
        coworkingSpace?: { state?: string | null; city?: string | null } | null;
        mall?: { state?: string | null; city?: string | null } | null;
        hospital?: { state?: string | null; city?: string | null } | null;
        stadium?: { state?: string | null; city?: string | null } | null;
        airport?: { state?: string | null; city?: string | null } | null;
    },
) => {
    if (scope.denyAll) return false;
    if (!scope.state && !scope.city) return true;

    const techParkState = entry.company?.newTechPark?.state ?? entry.newTechPark?.state ?? null;
    const techParkCity = entry.company?.newTechPark?.city ?? entry.newTechPark?.city ?? null;
    if ((entry.company || entry.newTechPark) && canAccessStateCity(scope, techParkState, techParkCity)) {
        return true;
    }

    const coworkingState = entry.coworkingCompany?.coworkingSpace?.state ?? entry.coworkingSpace?.state ?? null;
    const coworkingCity = entry.coworkingCompany?.coworkingSpace?.city ?? entry.coworkingSpace?.city ?? null;
    if ((entry.coworkingCompany || entry.coworkingSpace) && canAccessStateCity(scope, coworkingState, coworkingCity)) {
        return true;
    }

    for (const venue of [entry.mall, entry.hospital, entry.stadium, entry.airport]) {
        if (venue && canAccessStateCity(scope, venue.state, venue.city)) {
            return true;
        }
    }

    return false;
};

const sendContactLogSafeError = (
    res: Response,
    error: unknown,
    context: string,
    fallbackMessage: string,
) =>
    sendSafeErrorResponse(
        res,
        error,
        `contactLog.${context}`,
        fallbackMessage,
    );


export const getContactLogsByCompany = async (req: Request, res: Response) => {
    try {
        const companyId = getQueryString(req.params.companyId);
        const scope = getDataScopeFromRequest(req);

        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: "Company ID is required"
            });
        }

        const accessibleCompany = await prismaInstance.techParkCompany.findFirst({
            where: { id: companyId, ...buildTechParkCompanyScopeWhere(scope) },
            select: { id: true },
        });
        if (!accessibleCompany) {
            return res.status(404).json({
                success: false,
                message: "Company not found"
            });
        }

        const contactLogs = await prismaInstance.contactLog.findMany({
            where: {
                companyId: companyId
            },
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                company: {
                    select: {
                        name: true,
                        city: true
                    }
                }
            }
        });

        res.json({
            success: true,
            data: contactLogs
        });
    } catch (error) {
        return sendContactLogSafeError(
            res,
            error,
            "getContactLogsByCompany",
            "Failed to fetch contact logs",
        );
    }
};

export const createContactLog = async (req: Request, res: Response) => {
    try {
        const companyId = getQueryString(req.params.companyId);
        const scope = getDataScopeFromRequest(req);
        const actorUserId = req.user?.userId;
        const {
            type,
            status,
            subject,
            notes,
            timestamp,
            attachments,
            followUpAt,
            actualLat,
            actualLng,
            metWithSpoc,
        } = req.body;

        if (!actorUserId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        if (!companyId || !type || !status || !notes) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: companyId, type, status, notes"
            });
        }

        const company = await prismaInstance.techParkCompany.findFirst({
            where: { id: companyId, ...buildTechParkCompanyScopeWhere(scope) },
            include: { newTechPark: true }
        });

        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company not found"
            });
        }

        const trustScore = calculateLocationTrust(
            company.newTechPark?.lat,
            company.newTechPark?.lng,
            actualLat,
            actualLng
        );

        const contactLog = await prismaInstance.$transaction(async (tx) => {
            const createdLog = await tx.contactLog.create({
                data: {
                    companyId,
                    type,
                    status,
                    subject,
                    notes,
                    timestamp: timestamp ? new Date(timestamp) : new Date(),
                    attachments,
                    createdBy: actorUserId,
                    updatedBy: actorUserId,
                    followUpAt: followUpAt ? new Date(followUpAt) : null,
                    actualLat: actualLat ? Number(actualLat) : null,
                    actualLng: actualLng ? Number(actualLng) : null,
                    locationTrust: trustScore,
                    metWithSpoc: metWithSpoc || null,
                }
            });

            if (company.business_status !== status) {
                await tx.techParkCompany.update({
                    where: { id: companyId },
                    data: { business_status: status }
                });
            }

            return createdLog;
        });

        res.status(201).json({
            success: true,
            data: contactLog,
            message: "Contact log created successfully"
        });
    } catch (error) {
        return sendContactLogSafeError(
            res,
            error,
            "createContactLog",
            "Failed to create contact log",
        );
    }
};

export const updateContactLog = async (req: Request, res: Response) => {
    try {
        const logId = getQueryString(req.params.logId);
        const scope = getDataScopeFromRequest(req);
        const actorUserId = req.user?.userId;
        const {
            type,
            status,
            subject,
            notes,
            timestamp,
            attachments,
        } = req.body;

        if (!actorUserId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        if (!logId) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: logId"
            });
        }

        const existingLog = await prismaInstance.contactLog.findUnique({
            where: { id: logId },
            include: {
                company: {
                    select: {
                        id: true,
                        business_status: true,
                        newTechPark: { select: { state: true, city: true } },
                    },
                },
                coworkingCompany: {
                    select: {
                        id: true,
                        business_status: true,
                        coworkingSpace: { select: { state: true, city: true } },
                    },
                },
                newTechPark: {
                    select: {
                        id: true,
                        status: true,
                        state: true,
                        city: true,
                    }
                },
                coworkingSpace: {
                    select: {
                        id: true,
                        status: true,
                        state: true,
                        city: true,
                    }
                },
                mall: { select: { id: true, status: true, state: true, city: true } },
                hospital: { select: { id: true, status: true, state: true, city: true } },
                stadium: { select: { id: true, status: true, state: true, city: true } },
                airport: { select: { id: true, status: true, state: true, city: true } },
            }
        });

        if (!existingLog) {
            return res.status(404).json({
                success: false,
                message: "Contact log not found"
            });
        }

        if (!hasContactLogScopeAccess(scope, existingLog)) {
            return res.status(404).json({
                success: false,
                message: "Contact log not found"
            });
        }

        const updatedLog = await prismaInstance.$transaction(async (tx) => {
            const nextLog = await tx.contactLog.update({
                where: { id: logId },
                data: {
                    type,
                    status,
                    subject,
                    notes,
                    timestamp: timestamp ? new Date(timestamp) : undefined,
                    attachments,
                    updatedBy: actorUserId,
                    updatedAt: new Date()
                }
            });

            if (existingLog.company?.business_status !== status && existingLog.companyId) {
                await tx.techParkCompany.update({
                    where: { id: existingLog.companyId },
                    data: { business_status: status ?? undefined }
                });
            }

            if (existingLog.coworkingCompany?.business_status !== status && existingLog.coworkingCompanyId) {
                await tx.coworkingCompany.update({
                    where: { id: existingLog.coworkingCompanyId },
                    data: { business_status: status ?? undefined }
                });
            }

            if (existingLog.newTechPark?.status !== status && existingLog.newTechParkId) {
                await tx.newTechPark.update({
                    where: { id: existingLog.newTechParkId },
                    data: { status: status ?? undefined }
                });
            }

            if (existingLog.coworkingSpace?.status !== status && existingLog.coworkingSpaceId) {
                await tx.coworkingSpace.update({
                    where: { id: existingLog.coworkingSpaceId },
                    data: { status: status ?? undefined }
                });
            }

            if (existingLog.mall?.status !== status && existingLog.mallId) {
                await tx.mall.update({ where: { id: existingLog.mallId }, data: { status: status ?? undefined } });
            }

            if (existingLog.hospital?.status !== status && existingLog.hospitalId) {
                await tx.hospital.update({ where: { id: existingLog.hospitalId }, data: { status: status ?? undefined } });
            }

            if (existingLog.stadium?.status !== status && existingLog.stadiumId) {
                await tx.stadium.update({ where: { id: existingLog.stadiumId }, data: { status: status ?? undefined } });
            }

            if (existingLog.airport?.status !== status && existingLog.airportId) {
                await tx.airport.update({ where: { id: existingLog.airportId }, data: { status: status ?? undefined } });
            }

            return nextLog;
        });

        res.json({
            success: true,
            data: updatedLog,
            message: "Contact log updated successfully"
        });
    } catch (error) {
        return sendContactLogSafeError(
            res,
            error,
            "updateContactLog",
            "Failed to update contact log",
        );
    }
};

export const deleteContactLog = async (req: Request, res: Response) => {
    try {
        const logId = getQueryString(req.params.logId);
        const scope = getDataScopeFromRequest(req);

        if (!logId) {
            return res.status(400).json({
                success: false,
                message: "Log ID is required"
            });
        }

        const existingLog = await prismaInstance.contactLog.findUnique({
            where: { id: logId },
            include: {
                company: {
                    select: {
                        newTechPark: { select: { state: true, city: true } },
                    },
                },
                coworkingCompany: {
                    select: {
                        coworkingSpace: { select: { state: true, city: true } },
                    },
                },
                newTechPark: {
                    select: { state: true, city: true }
                },
                coworkingSpace: {
                    select: { state: true, city: true }
                },
                mall: { select: { state: true, city: true } },
                hospital: { select: { state: true, city: true } },
                stadium: { select: { state: true, city: true } },
                airport: { select: { state: true, city: true } },
            },
        });

        if (!existingLog) {
            return res.status(404).json({
                success: false,
                message: "Contact log not found"
            });
        }

        if (!hasContactLogScopeAccess(scope, existingLog)) {
            return res.status(404).json({
                success: false,
                message: "Contact log not found"
            });
        }

        await prismaInstance.contactLog.delete({
            where: { id: logId }
        });

        res.json({
            success: true,
            message: "Contact log deleted successfully"
        });
    } catch (error) {
        return sendContactLogSafeError(
            res,
            error,
            "deleteContactLog",
            "Failed to delete contact log",
        );
    }
};

export const getContactLogById = async (req: Request, res: Response) => {
    try {
        const logId = getQueryString(req.params.logId);
        const scope = getDataScopeFromRequest(req);

        if (!logId) {
            return res.status(400).json({
                success: false,
                message: "Log ID is required"
            });
        }

        const contactLog = await prismaInstance.contactLog.findUnique({
            where: { id: logId },
            include: {
                company: {
                    select: {
                        name: true,
                        city: true,
                        business_status: true,
                        newTechPark: {
                            select: {
                                state: true,
                                city: true
                            }
                        }
                    }
                },
                coworkingCompany: {
                    select: {
                        name: true,
                        business_status: true,
                        coworkingSpace: {
                            select: {
                                state: true,
                                city: true
                            }
                        }
                    }
                },
                newTechPark: {
                    select: {
                        name: true,
                        city: true,
                        state: true,
                        status: true,
                    }
                },
                coworkingSpace: {
                    select: {
                        name: true,
                        city: true,
                        state: true,
                        status: true,
                    }
                },
                mall: { select: { name: true, city: true, state: true, status: true } },
                hospital: { select: { name: true, city: true, state: true, status: true } },
                stadium: { select: { name: true, city: true, state: true, status: true } },
                airport: { select: { name: true, city: true, state: true, status: true } },
            }
        });

        if (!contactLog) {
            return res.status(404).json({
                success: false,
                message: "Contact log not found"
            });
        }

        if (!hasContactLogScopeAccess(scope, contactLog)) {
            return res.status(404).json({
                success: false,
                message: "Contact log not found"
            });
        }

        res.json({
            success: true,
            data: contactLog
        });
    } catch (error) {
        return sendContactLogSafeError(
            res,
            error,
            "getContactLogById",
            "Failed to fetch contact log",
        );
    }
};

export const getContactLogStats = async (req: Request, res: Response) => {
    try {
        const companyId = getQueryString(req.params.companyId);
        const scope = getDataScopeFromRequest(req);

        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: "Company ID is required"
            });
        }

        const accessibleCompany = await prismaInstance.techParkCompany.findFirst({
            where: { id: companyId, ...buildTechParkCompanyScopeWhere(scope) },
            select: { id: true },
        });
        if (!accessibleCompany) {
            return res.status(404).json({
                success: false,
                message: "Company not found"
            });
        }

        const stats = await prismaInstance.contactLog.groupBy({
            by: ['type', 'status'],
            where: {
                companyId: companyId
            },
            _count: {
                id: true
            }
        });

        const totalLogs = await prismaInstance.contactLog.count({
            where: { companyId: companyId }
        });

        const lastContact = await prismaInstance.contactLog.findFirst({
            where: { companyId: companyId },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true, type: true, status: true }
        });

        res.json({
            success: true,
            data: {
                totalLogs,
                lastContact,
                breakdown: stats
            }
        });
    } catch (error) {
        return sendContactLogSafeError(
            res,
            error,
            "getContactLogStats",
            "Failed to fetch contact log statistics",
        );
    }
};

export const getContactLogsByCoworkingCompany = async (req: Request, res: Response) => {
    try {
        const companyId = getQueryString(req.params.companyId);
        const scope = getDataScopeFromRequest(req);

        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: "Company ID is required"
            });
        }

        const accessibleCompany = await prismaInstance.coworkingCompany.findFirst({
            where: { id: companyId, ...buildCoworkingCompanyScopeWhere(scope) },
            select: { id: true },
        });
        if (!accessibleCompany) {
            return res.status(404).json({
                success: false,
                message: "Company not found"
            });
        }

        const contactLogs = await prismaInstance.contactLog.findMany({
            where: {
                coworkingCompanyId: companyId
            },
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                coworkingCompany: {
                    select: {
                        name: true,
                        coworkingSpace: {
                            select: {
                                name: true,
                                city: true
                            }
                        }
                    }
                }
            }
        });

        res.json({
            success: true,
            data: contactLogs
        });
    } catch (error) {
        return sendContactLogSafeError(
            res,
            error,
            "getContactLogsByCoworkingCompany",
            "Failed to fetch contact logs",
        );
    }
};

export const createCoworkingContactLog = async (req: Request, res: Response) => {
    try {
        const companyId = getQueryString(req.params.companyId);
        const scope = getDataScopeFromRequest(req);
        const actorUserId = req.user?.userId;
        const {
            type,
            status,
            subject,
            notes,
            attachments,
            followUpAt,
            actualLat,
            actualLng,
            metWithSpoc,
        } = req.body;

        if (!actorUserId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: "Company ID is required"
            });
        }

        if (!type || !status || !notes) {
            return res.status(400).json({
                success: false,
                message: "Type, status, and notes are required"
            });
        }

        const coworkingCompany = await prismaInstance.coworkingCompany.findFirst({
            where: { id: companyId, ...buildCoworkingCompanyScopeWhere(scope) },
            include: { coworkingSpace: true }
        });

        if (!coworkingCompany) {
            return res.status(404).json({
                success: false,
                message: "Coworking company not found"
            });
        }

        const trustScore = calculateLocationTrust(
            coworkingCompany.coworkingSpace?.lat,
            coworkingCompany.coworkingSpace?.lng,
            actualLat,
            actualLng
        );

        const contactLog = await prismaInstance.$transaction(async (tx) => {
            const createdLog = await tx.contactLog.create({
                data: {
                    coworkingCompanyId: companyId,
                    type,
                    status,
                    subject: subject || null,
                    notes,
                    attachments: attachments || null,
                    createdBy: actorUserId,
                    updatedBy: actorUserId,
                    followUpAt: followUpAt ? new Date(followUpAt) : null,
                    actualLat: actualLat ? Number(actualLat) : null,
                    actualLng: actualLng ? Number(actualLng) : null,
                    locationTrust: trustScore,
                    metWithSpoc: metWithSpoc || null,
                },
                include: {
                    coworkingCompany: {
                        select: {
                            name: true,
                            coworkingSpace: {
                                select: {
                                    name: true,
                                    city: true
                                }
                            }
                        }
                    }
                }
            });

            if (coworkingCompany.business_status !== status) {
                await tx.coworkingCompany.update({
                    where: { id: companyId },
                    data: { business_status: status }
                });
            }

            return createdLog;
        });

        res.status(201).json({
            success: true,
            data: contactLog
        });
    } catch (error) {
        return sendContactLogSafeError(
            res,
            error,
            "createCoworkingContactLog",
            "Failed to create contact log",
        );
    }
};

export const getCoworkingContactLogStats = async (req: Request, res: Response) => {
    try {
        const companyId = getQueryString(req.params.companyId);
        const scope = getDataScopeFromRequest(req);

        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: "Company ID is required"
            });
        }

        const accessibleCompany = await prismaInstance.coworkingCompany.findFirst({
            where: { id: companyId, ...buildCoworkingCompanyScopeWhere(scope) },
            select: { id: true },
        });
        if (!accessibleCompany) {
            return res.status(404).json({
                success: false,
                message: "Company not found"
            });
        }

        const stats = await prismaInstance.contactLog.groupBy({
            by: ['type', 'status'],
            where: {
                coworkingCompanyId: companyId
            },
            _count: {
                id: true
            }
        });

        const totalLogs = await prismaInstance.contactLog.count({
            where: { coworkingCompanyId: companyId }
        });

        const lastContact = await prismaInstance.contactLog.findFirst({
            where: { coworkingCompanyId: companyId },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true, type: true, status: true }
        });

        res.json({
            success: true,
            data: {
                totalLogs,
                lastContact,
                breakdown: stats
            }
        });
    } catch (error) {
        return sendContactLogSafeError(
            res,
            error,
            "getCoworkingContactLogStats",
            "Failed to fetch contact log statistics",
        );
    }
};

export const getContactLogsByTechPark = async (req: Request, res: Response) => {
    try {
        const techParkId = getQueryString(req.params.techParkId);
        const scope = getDataScopeFromRequest(req);

        if (!techParkId) {
            return res.status(400).json({ success: false, message: "Tech Park ID is required" });
        }

        const accessiblePark = await prismaInstance.newTechPark.findFirst({
            where: { id: techParkId, is_active: true }
        });
        if (!accessiblePark || !canAccessStateCity(scope, accessiblePark.state, accessiblePark.city)) {
            return res.status(404).json({ success: false, message: "Tech Park not found" });
        }

        const contactLogs = await prismaInstance.contactLog.findMany({
            where: { newTechParkId: techParkId },
            orderBy: { createdAt: 'desc' },
            include: {
                newTechPark: {
                    select: { name: true, city: true }
                }
            }
        });

        res.json({ success: true, data: contactLogs });
    } catch (error) {
        return sendContactLogSafeError(res, error, "getContactLogsByTechPark", "Failed to fetch contact logs");
    }
};

export const createTechParkContactLog = async (req: Request, res: Response) => {
    try {
        const techParkId = getQueryString(req.params.techParkId);
        const scope = getDataScopeFromRequest(req);
        const actorUserId = req.user?.userId;
        const {
            type,
            status,
            subject,
            notes,
            timestamp,
            attachments,
            followUpAt,
            actualLat,
            actualLng,
            metWithSpoc,
        } = req.body;

        if (!actorUserId) return res.status(401).json({ success: false, message: "Authentication required" });
        if (!techParkId || !type || !status || !notes) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const techPark = await prismaInstance.newTechPark.findFirst({
            where: { id: techParkId, is_active: true }
        });
        if (!techPark || !canAccessStateCity(scope, techPark.state, techPark.city)) {
            return res.status(404).json({ success: false, message: "Tech Park not found" });
        }

        const trustScore = calculateLocationTrust(
            techPark.lat,
            techPark.lng,
            actualLat,
            actualLng
        );

        const contactLog = await prismaInstance.$transaction(async (tx) => {
            const createdLog = await tx.contactLog.create({
                data: {
                    newTechParkId: techParkId,
                    type,
                    status: status as any,
                    subject,
                    notes,
                    timestamp: timestamp ? new Date(timestamp) : new Date(),
                    attachments,
                    createdBy: actorUserId,
                    updatedBy: actorUserId,
                    followUpAt: followUpAt ? new Date(followUpAt) : null,
                    actualLat: actualLat ? Number(actualLat) : null,
                    actualLng: actualLng ? Number(actualLng) : null,
                    locationTrust: trustScore,
                    metWithSpoc: metWithSpoc || null,
                }
            });

            if (techPark.status !== status) {
                await tx.newTechPark.update({
                    where: { id: techParkId },
                    data: { status: status as any }
                });
            }

            return createdLog;
        });

        res.status(201).json({ success: true, data: contactLog, message: "Contact log created successfully" });
    } catch (error) {
        return sendContactLogSafeError(res, error, "createTechParkContactLog", "Failed to create contact log");
    }
};

export const getContactLogsByCoworkingSpace = async (req: Request, res: Response) => {
    try {
        const coworkingSpaceId = getQueryString(req.params.coworkingSpaceId);
        const scope = getDataScopeFromRequest(req);

        if (!coworkingSpaceId) {
            return res.status(400).json({ success: false, message: "Coworking Space ID is required" });
        }

        const accessibleSpace = await prismaInstance.coworkingSpace.findFirst({
            where: { id: coworkingSpaceId }
        });
        if (!accessibleSpace || !canAccessStateCity(scope, accessibleSpace.state, accessibleSpace.city)) {
            return res.status(404).json({ success: false, message: "Coworking Space not found" });
        }

        const contactLogs = await prismaInstance.contactLog.findMany({
            where: { coworkingSpaceId: coworkingSpaceId },
            orderBy: { createdAt: 'desc' },
            include: {
                coworkingSpace: {
                    select: { name: true, city: true }
                }
            }
        });

        res.json({ success: true, data: contactLogs });
    } catch (error) {
        return sendContactLogSafeError(res, error, "getContactLogsByCoworkingSpace", "Failed to fetch contact logs");
    }
};

export const createCoworkingSpaceContactLog = async (req: Request, res: Response) => {
    try {
        const coworkingSpaceId = getQueryString(req.params.coworkingSpaceId);
        const scope = getDataScopeFromRequest(req);
        const actorUserId = req.user?.userId;
        const {
            type,
            status,
            subject,
            notes,
            timestamp,
            attachments,
            followUpAt,
            actualLat,
            actualLng,
            metWithSpoc,
        } = req.body;

        if (!actorUserId) return res.status(401).json({ success: false, message: "Authentication required" });
        if (!coworkingSpaceId || !type || !status || !notes) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const coworkingSpace = await prismaInstance.coworkingSpace.findFirst({
            where: { id: coworkingSpaceId }
        });
        if (!coworkingSpace || !canAccessStateCity(scope, coworkingSpace.state, coworkingSpace.city)) {
            return res.status(404).json({ success: false, message: "Coworking Space not found" });
        }

        const trustScore = calculateLocationTrust(
            coworkingSpace.lat,
            coworkingSpace.lng,
            actualLat,
            actualLng
        );

        const contactLog = await prismaInstance.$transaction(async (tx) => {
            const createdLog = await tx.contactLog.create({
                data: {
                    coworkingSpaceId: coworkingSpaceId,
                    type,
                    status: status as any,
                    subject,
                    notes,
                    timestamp: timestamp ? new Date(timestamp) : new Date(),
                    attachments,
                    createdBy: actorUserId,
                    updatedBy: actorUserId,
                    followUpAt: followUpAt ? new Date(followUpAt) : null,
                    actualLat: actualLat ? Number(actualLat) : null,
                    actualLng: actualLng ? Number(actualLng) : null,
                    locationTrust: trustScore,
                    metWithSpoc: metWithSpoc || null,
                }
            });

            if (coworkingSpace.status !== status) {
                await tx.coworkingSpace.update({
                    where: { id: coworkingSpaceId },
                    data: { status: status as any }
                });
            }

            return createdLog;
        });

        res.status(201).json({ success: true, data: contactLog, message: "Contact log created successfully" });
    } catch (error) {
        return sendContactLogSafeError(res, error, "createCoworkingSpaceContactLog", "Failed to create contact log");
    }
};
