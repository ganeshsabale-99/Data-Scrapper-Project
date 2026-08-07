import { Request, Response } from "express";
import { prismaInstance } from "@repo/db";
import { getQueryString } from "../utils/queryUtils";
import { applyScopeToStateCityWhere, getDataScopeFromRequest } from "../utils/dataScope";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";

const OWNER_SELECT = { owner: { select: { id: true, name: true, email: true } } };

// Shared "claim this lead" / "release this lead" logic for models that don't go through
// venueControllerFactory.ts (Tech Parks and Coworking Spaces have bespoke controllers).
export function createAssignmentHandlers(model: any, entityLabel: string, errorPrefix: string) {
  const sendError = (res: Response, error: unknown, context: string, fallback: string) =>
    sendSafeErrorResponse(res, error, `${errorPrefix}.${context}`, fallback);

  const assignVenue = async (req: Request, res: Response) => {
    try {
      const id = getQueryString(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, message: `${entityLabel} ID is required` });
      }

      const scope = getDataScopeFromRequest(req);
      const accessWhere: any = { id };
      applyScopeToStateCityWhere(accessWhere, scope);
      const existing = await model.findFirst({ where: accessWhere, select: { id: true, ownerId: true } });
      if (!existing) {
        return res.status(404).json({ success: false, message: `${entityLabel} not found` });
      }

      const requestedOwnerId = getQueryString(req.body?.userId);
      const ownerId = requestedOwnerId || req.user?.userId;
      if (!ownerId) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }

      if (existing.ownerId && existing.ownerId !== ownerId) {
        const currentOwner = await prismaInstance.adminUser.findUnique({
          where: { id: existing.ownerId },
          select: { name: true },
        });
        return res.status(409).json({
          success: false,
          code: "ALREADY_ASSIGNED",
          message: `This ${entityLabel} is already assigned to ${currentOwner?.name || "another user"}.`,
        });
      }

      const updated = await model.update({
        where: { id },
        data: { ownerId, assignedAt: new Date() },
        include: OWNER_SELECT,
      });

      return res.json({ success: true, message: `${entityLabel} assigned successfully`, data: updated });
    } catch (error) {
      return sendError(res, error, "assignVenue", `Failed to assign ${entityLabel}`);
    }
  };

  const unassignVenue = async (req: Request, res: Response) => {
    try {
      const id = getQueryString(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, message: `${entityLabel} ID is required` });
      }

      const scope = getDataScopeFromRequest(req);
      const accessWhere: any = { id };
      applyScopeToStateCityWhere(accessWhere, scope);
      const existing = await model.findFirst({ where: accessWhere, select: { id: true } });
      if (!existing) {
        return res.status(404).json({ success: false, message: `${entityLabel} not found` });
      }

      const updated = await model.update({
        where: { id },
        data: { ownerId: null, assignedAt: null },
        include: OWNER_SELECT,
      });

      return res.json({ success: true, message: `${entityLabel} unassigned successfully`, data: updated });
    } catch (error) {
      return sendError(res, error, "unassignVenue", `Failed to unassign ${entityLabel}`);
    }
  };

  return { assignVenue, unassignVenue };
}

export const { assignVenue: assignTechPark, unassignVenue: unassignTechPark } = createAssignmentHandlers(
  prismaInstance.newTechPark,
  "Tech park",
  "techPark",
);

export const { assignVenue: assignCoworkingSpace, unassignVenue: unassignCoworkingSpace } = createAssignmentHandlers(
  prismaInstance.coworkingSpace,
  "Coworking space",
  "coworkingSpace",
);
