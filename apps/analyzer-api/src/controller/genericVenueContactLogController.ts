import { prismaInstance } from "@repo/db";
import { Request, Response } from "express";
import { getQueryString } from "../utils/queryUtils";
import { canAccessStateCity, getDataScopeFromRequest } from "../utils/dataScope";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";
import { calculateLocationTrust } from "./contactLogController";

export type GenericVenueType = "mall" | "hospital" | "stadium" | "airport";

const VENUE_ID_FIELD: Record<GenericVenueType, string> = {
  mall: "mallId",
  hospital: "hospitalId",
  stadium: "stadiumId",
  airport: "airportId",
};

const getVenueModel = (venueType: GenericVenueType) => {
  const models: Record<GenericVenueType, any> = {
    mall: prismaInstance.mall,
    hospital: prismaInstance.hospital,
    stadium: prismaInstance.stadium,
    airport: prismaInstance.airport,
  };
  return models[venueType];
};

export const getContactLogsByVenue = (venueType: GenericVenueType) =>
  async (req: Request, res: Response) => {
    try {
      const venueId = getQueryString(req.params.venueId);
      const scope = getDataScopeFromRequest(req);

      if (!venueId) {
        return res.status(400).json({ success: false, message: "Venue ID is required" });
      }

      const venue = await getVenueModel(venueType).findFirst({ where: { id: venueId } });
      if (!venue || !canAccessStateCity(scope, venue.state, venue.city)) {
        return res.status(404).json({ success: false, message: "Venue not found" });
      }

      const contactLogs = await prismaInstance.contactLog.findMany({
        where: { [VENUE_ID_FIELD[venueType]]: venueId },
        orderBy: { createdAt: "desc" },
      });

      res.json({ success: true, data: contactLogs });
    } catch (error) {
      return sendSafeErrorResponse(
        res,
        error,
        `genericVenueContactLog.get.${venueType}`,
        "Failed to fetch contact logs",
      );
    }
  };

export const createVenueContactLog = (venueType: GenericVenueType) =>
  async (req: Request, res: Response) => {
    try {
      const venueId = getQueryString(req.params.venueId);
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
        return res.status(401).json({ success: false, message: "Authentication required" });
      }
      if (!venueId || !type || !status || !notes) {
        return res.status(400).json({ success: false, message: "Missing required fields: venueId, type, status, notes" });
      }

      const venueModel = getVenueModel(venueType);
      const venue = await venueModel.findFirst({ where: { id: venueId } });
      if (!venue || !canAccessStateCity(scope, venue.state, venue.city)) {
        return res.status(404).json({ success: false, message: "Venue not found" });
      }

      const trustScore = calculateLocationTrust(venue.lat, venue.lng, actualLat, actualLng);
      const idField = VENUE_ID_FIELD[venueType];

      const contactLog = await prismaInstance.$transaction(async (tx) => {
        const createdLog = await tx.contactLog.create({
          data: {
            [idField]: venueId,
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
          },
        });

        if (venue.status !== status) {
          await (tx as any)[venueType].update({
            where: { id: venueId },
            data: { status },
          });
        }

        return createdLog;
      });

      res.status(201).json({ success: true, data: contactLog, message: "Contact log created successfully" });
    } catch (error) {
      return sendSafeErrorResponse(
        res,
        error,
        `genericVenueContactLog.create.${venueType}`,
        "Failed to create contact log",
      );
    }
  };

export const getVenueContactLogStats = (venueType: GenericVenueType) =>
  async (req: Request, res: Response) => {
    try {
      const venueId = getQueryString(req.params.venueId);
      const scope = getDataScopeFromRequest(req);

      if (!venueId) {
        return res.status(400).json({ success: false, message: "Venue ID is required" });
      }

      const venue = await getVenueModel(venueType).findFirst({ where: { id: venueId } });
      if (!venue || !canAccessStateCity(scope, venue.state, venue.city)) {
        return res.status(404).json({ success: false, message: "Venue not found" });
      }

      const where = { [VENUE_ID_FIELD[venueType]]: venueId };

      const [stats, totalLogs, lastContact] = await Promise.all([
        prismaInstance.contactLog.groupBy({ by: ["type", "status"], where, _count: { id: true } }),
        prismaInstance.contactLog.count({ where }),
        prismaInstance.contactLog.findFirst({
          where,
          orderBy: { createdAt: "desc" },
          select: { createdAt: true, type: true, status: true },
        }),
      ]);

      res.json({ success: true, data: { totalLogs, lastContact, breakdown: stats } });
    } catch (error) {
      return sendSafeErrorResponse(
        res,
        error,
        `genericVenueContactLog.stats.${venueType}`,
        "Failed to fetch contact log statistics",
      );
    }
  };
