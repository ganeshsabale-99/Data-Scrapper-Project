import { db as prisma, ActivityEntityType, ActivityAction } from "@repo/db";

interface CreateActivityLogParams {
    entityType: ActivityEntityType;
    entityId: string;
    action: ActivityAction;
    summary?: string;
    changedFields?: any;
    meta?: {
        note?: string;
        type?: string;
        outcome?: string;
        nextFollowUpAt?: Date | string;
        location?: {
            lat: number;
            lng: number;
            accuracy?: number;
            method?: string;
        };
        [key: string]: any;
    };
    actor: {
        id: string;
        name: string;
        role: string;
    };
    reqContext?: {
        ipAddress?: string;
        userAgent?: string;
    };
}

/**
 * Creates an immutable activity log entry.
 */
export async function createActivityLog({
    entityType,
    entityId,
    action,
    summary,
    changedFields,
    meta,
    actor,
    reqContext
}: CreateActivityLogParams) {
    try {
        const activityLog = await prisma.activityLog.create({
            data: {
                entityType,
                entityId,
                action,
                summary,
                changedFields: changedFields ?? undefined,
                meta: meta ?? undefined,
                performedById: actor.id,
                performedByName: actor.name,
                performedByRole: actor.role,
                ipAddress: reqContext?.ipAddress,
                userAgent: reqContext?.userAgent,
            }
        });
        return activityLog;
    } catch (error) {
        console.error("Failed to create activity log", error);
        // Depending on strictness, we might want to throw or just swallow log errors.
        // Swallowing to avoid breaking core flows if logging fails.
        return null;
    }
}
