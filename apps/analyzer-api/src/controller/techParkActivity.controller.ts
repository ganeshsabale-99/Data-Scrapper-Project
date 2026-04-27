import { Request, Response } from "express";
import { db as prisma, ActivityEntityType, ActivityAction } from "@repo/db";
import { createActivityLog } from "../libs/activityLogger.service";

/**
 * Handle GET /api/techparks/:id/activity
 * Cursor-based pagination for activity logs.
 */
export async function getTechParkActivityLogs(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { cursor, limit = "10" } = req.query;

        const take = parseInt(limit as string, 10) || 10;
        const cursorObj = cursor ? { id: cursor as string } : undefined;

        const logs = await prisma.activityLog.findMany({
            where: {
                entityType: ActivityEntityType.TECH_PARK,
                entityId: id as string,
            },
            take: take + 1, // Fetch one extra for next cursor
            cursor: cursorObj,
            orderBy: {
                createdAt: "desc",
            },
            skip: cursor ? 1 : 0,
        });

        let nextCursor: string | null = null;
        if (logs.length > take) {
            const nextItem = logs.pop();
            nextCursor = nextItem!.id;
        }

        res.json({
            success: true,
            data: logs,
            nextCursor,
        });
    } catch (error: any) {
        console.error("Error fetching activity logs:", error);
        res.status(500).json({ success: false, error: "Failed to fetch logs" });
    }
}

/**
 * Handle POST /api/techparks/:id/visits
 */
export async function addVisitLog(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        const { visitDateTime, notes, outcome, nextFollowUpAt, location } = req.body;
        const user = (req as any).user;

        const techPark = await prisma.newTechPark.findUnique({ where: { id } });
        if (!techPark) {
            return res.status(404).json({ success: false, error: "TechPark not found" });
        }

        if (location) {
            if (typeof location.lat !== 'number' || typeof location.lng !== 'number') {
                // Invalid location
                delete location.lat;
            }
        }

        const newLog = await createActivityLog({
            entityType: ActivityEntityType.TECH_PARK,
            entityId: id,
            action: ActivityAction.VISIT,
            summary: outcome || "Site Visit",
            meta: {
                visitDateTime: visitDateTime || new Date().toISOString(),
                note: notes,
                outcome,
                nextFollowUpAt,
                location: location?.lat ? location : undefined,
            },
            actor: {
                id: user.userId || user.id || "system",
                name: user.name || user.identifier || "Admin User",
                role: user.role || "USER",
            },
            reqContext: {
                ipAddress: req.ip as string,
                userAgent: (req.headers["user-agent"] as string) || "unknown",
            },
        });

        res.json({ success: true, data: newLog });
    } catch (error: any) {
        console.error("Error adding visit:", error);
        res.status(500).json({ success: false, error: "Failed to add visit log" });
    }
}

/**
 * Handle POST /api/techparks/:id/contact-logs
 */
export async function addContactLog(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        const { type, notes, nextFollowUpAt, location } = req.body;
        const user = (req as any).user;

        const techPark = await prisma.newTechPark.findUnique({ where: { id } });
        if (!techPark) {
            return res.status(404).json({ success: false, error: "TechPark not found" });
        }

        const newLog = await createActivityLog({
            entityType: ActivityEntityType.TECH_PARK,
            entityId: id,
            action: ActivityAction.CONTACTED,
            summary: `${type} Contact`,
            meta: {
                type,
                note: notes,
                nextFollowUpAt,
                location: location?.lat ? location : undefined,
            },
            actor: {
                id: user.userId || user.id || "system",
                name: user.name || user.identifier || "Admin User",
                role: user.role || "USER",
            },
            reqContext: {
                ipAddress: req.ip as string,
                userAgent: (req.headers["user-agent"] as string) || "unknown",
            },
        });

        res.json({ success: true, data: newLog });
    } catch (error: any) {
        console.error("Error adding contact log:", error);
        res.status(500).json({ success: false, error: "Failed to add contact log" });
    }
}
