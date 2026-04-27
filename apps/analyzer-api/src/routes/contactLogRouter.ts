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

export const contactLogRouter: Router = Router();

contactLogRouter.use(
  authenticateToken,
  checkPermission(["TECHPARKS.VIEW", "COWORKING.VIEW"], {
    mode: "any",
  }),
);

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
