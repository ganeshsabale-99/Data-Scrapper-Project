import { Router } from "express";
import { authenticateToken, checkPermission } from "../middleware/auth";
import {
  getContactLogsByCompany,
  createContactLog,
  updateContactLog,
  deleteContactLog,
  getContactLogById,
  getContactLogStats,
  getContactLogsByCoworkingCompany,
  createCoworkingContactLog,
  getCoworkingContactLogStats,
  getContactLogsByTechPark,
  createTechParkContactLog,
  getContactLogsByCoworkingSpace,
  createCoworkingSpaceContactLog
} from "../controller/contactLogController";
import {
  getContactLogsByVenue,
  createVenueContactLog,
  getVenueContactLogStats,
  type GenericVenueType,
} from "../controller/genericVenueContactLogController";

export const contactLogRouter: Router = Router();

contactLogRouter.use(
  authenticateToken,
  checkPermission(
    [
      "TECHPARKS.VIEW",
      "COWORKING.VIEW",
      "MALLS.VIEW",
      "HOSPITALS.VIEW",
      "STADIUMS.VIEW",
      "AIRPORTS.VIEW",
    ],
    { mode: "any" },
  ),
);

const GENERIC_VENUE_TYPES: GenericVenueType[] = ["mall", "hospital", "stadium", "airport"];

for (const venueType of GENERIC_VENUE_TYPES) {
  contactLogRouter.get(`/${venueType}/:venueId`, getContactLogsByVenue(venueType));
  contactLogRouter.get(`/${venueType}/:venueId/stats`, getVenueContactLogStats(venueType));
  contactLogRouter.post(`/${venueType}/:venueId`, createVenueContactLog(venueType));
}

contactLogRouter.get("/company/:companyId", getContactLogsByCompany);
contactLogRouter.get("/company/:companyId/stats", getContactLogStats);
contactLogRouter.post("/company/:companyId", createContactLog);

contactLogRouter.get("/tech-park/:techParkId", getContactLogsByTechPark);
contactLogRouter.post("/tech-park/:techParkId", createTechParkContactLog);

contactLogRouter.get("/coworking-company/:companyId", getContactLogsByCoworkingCompany);
contactLogRouter.get("/coworking-company/:companyId/stats", getCoworkingContactLogStats);
contactLogRouter.post("/coworking-company/:companyId", createCoworkingContactLog);

contactLogRouter.get("/coworking-space/:coworkingSpaceId", getContactLogsByCoworkingSpace);
contactLogRouter.post("/coworking-space/:coworkingSpaceId", createCoworkingSpaceContactLog);

contactLogRouter.get("/:logId", getContactLogById);
contactLogRouter.patch("/:logId", updateContactLog);
contactLogRouter.delete("/:logId", deleteContactLog);
