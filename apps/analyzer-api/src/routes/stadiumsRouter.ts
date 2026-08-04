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
} from "../controller/stadiumController";
import { triggerStadiumScrape, getStadiumScrapeStatus } from "../controller/stadiumScraperController";

export const stadiumsRouter: Router = Router();

const canView = checkPermission(["STADIUMS.VIEW", "STADIUMS.MANAGE"], { mode: "any" });
const canManage = checkPermission(["STADIUMS.MANAGE"], { mode: "any" });
const canVerify = checkPermission(["STADIUMS.VERIFY", "STADIUMS.MANAGE"], { mode: "any" });
const isSuperAdmin = checkPermission(["SUPER_ADMIN"], { mode: "any" });

stadiumsRouter.get("/overview", authenticateToken, canView, getOverviewData);
stadiumsRouter.get("/state-wise-overview/:state", authenticateToken, canView, getStateWiseOverview);
stadiumsRouter.get("/city-wise-overview/:state/:city", authenticateToken, canView, getCityWiseOverview);
stadiumsRouter.post("/scrape", authenticateToken, isSuperAdmin, triggerStadiumScrape);
stadiumsRouter.get("/scrape/status", authenticateToken, isSuperAdmin, getStadiumScrapeStatus);
stadiumsRouter.get("/:id", authenticateToken, canView, getVenueById);
stadiumsRouter.post("/city-wise-overview/:state/:city/add", authenticateToken, canManage, addVenue);
stadiumsRouter.patch("/status/:id", authenticateToken, canManage, changeStatus);
stadiumsRouter.patch("/:id", authenticateToken, canManage, updateVenue);
stadiumsRouter.delete("/:id", authenticateToken, canManage, deleteVenue);
stadiumsRouter.post("/:id/verify", authenticateToken, canVerify, verifyVenue);
stadiumsRouter.post("/:id/unverify", authenticateToken, canVerify, unverifyVenue);
