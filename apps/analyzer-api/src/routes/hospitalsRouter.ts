import { Router } from "express";
import { authenticateToken, checkPermission } from "../middleware/auth";
import {
  getOverviewData,
  getStateWiseOverview,
  getCityWiseOverview,
  getVenueById,
  addVenue,
  updateVenue,
  deleteVenue,
  changeStatus,
  verifyVenue,
  unverifyVenue,
} from "../controller/hospitalController";
import { triggerHospitalScrape, getHospitalScrapeStatus } from "../controller/hospitalScraperController";

export const hospitalsRouter: Router = Router();

const canView = checkPermission(["HOSPITALS.VIEW", "HOSPITALS.MANAGE"], { mode: "any" });
const canManage = checkPermission(["HOSPITALS.MANAGE"], { mode: "any" });
const canVerify = checkPermission(["HOSPITALS.VERIFY", "HOSPITALS.MANAGE"], { mode: "any" });
const isSuperAdmin = checkPermission(["SUPER_ADMIN"], { mode: "any" });

hospitalsRouter.get("/overview", authenticateToken, canView, getOverviewData);
hospitalsRouter.get("/state-wise-overview/:state", authenticateToken, canView, getStateWiseOverview);
hospitalsRouter.get("/city-wise-overview/:state/:city", authenticateToken, canView, getCityWiseOverview);
hospitalsRouter.post("/scrape", authenticateToken, isSuperAdmin, triggerHospitalScrape);
hospitalsRouter.get("/scrape/status", authenticateToken, isSuperAdmin, getHospitalScrapeStatus);
hospitalsRouter.get("/:id", authenticateToken, canView, getVenueById);
hospitalsRouter.post("/city-wise-overview/:state/:city/add", authenticateToken, canManage, addVenue);
hospitalsRouter.patch("/status/:id", authenticateToken, canManage, changeStatus);
hospitalsRouter.patch("/:id", authenticateToken, canManage, updateVenue);
hospitalsRouter.delete("/:id", authenticateToken, canManage, deleteVenue);
hospitalsRouter.post("/:id/verify", authenticateToken, canVerify, verifyVenue);
hospitalsRouter.post("/:id/unverify", authenticateToken, canVerify, unverifyVenue);
