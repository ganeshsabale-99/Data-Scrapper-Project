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
} from "../controller/airportController";
import { triggerAirportScrape, getAirportScrapeStatus } from "../controller/airportScraperController";

export const airportsRouter: Router = Router();

const canView = checkPermission(["AIRPORTS.VIEW", "AIRPORTS.MANAGE"], { mode: "any" });
const canManage = checkPermission(["AIRPORTS.MANAGE"], { mode: "any" });
const canVerify = checkPermission(["AIRPORTS.VERIFY", "AIRPORTS.MANAGE"], { mode: "any" });
const isSuperAdmin = checkPermission(["SUPER_ADMIN"], { mode: "any" });

airportsRouter.get("/overview", authenticateToken, canView, getOverviewData);
airportsRouter.get("/state-wise-overview/:state", authenticateToken, canView, getStateWiseOverview);
airportsRouter.get("/city-wise-overview/:state/:city", authenticateToken, canView, getCityWiseOverview);
airportsRouter.post("/scrape", authenticateToken, isSuperAdmin, triggerAirportScrape);
airportsRouter.get("/scrape/status", authenticateToken, isSuperAdmin, getAirportScrapeStatus);
airportsRouter.get("/:id", authenticateToken, canView, getVenueById);
airportsRouter.post("/city-wise-overview/:state/:city/add", authenticateToken, canManage, addVenue);
airportsRouter.patch("/status/:id", authenticateToken, canManage, changeStatus);
airportsRouter.patch("/:id", authenticateToken, canManage, updateVenue);
airportsRouter.delete("/:id", authenticateToken, canManage, deleteVenue);
airportsRouter.post("/:id/verify", authenticateToken, canVerify, verifyVenue);
airportsRouter.post("/:id/unverify", authenticateToken, canVerify, unverifyVenue);
