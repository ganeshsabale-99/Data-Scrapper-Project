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
  assignVenue,
  unassignVenue,
} from "../controller/mallController";
import { triggerMallScrape, getMallScrapeStatus } from "../controller/mallScraperController";

export const mallsRouter: Router = Router();

const canView = checkPermission(["MALLS.VIEW", "MALLS.MANAGE"], { mode: "any" });
const canManage = checkPermission(["MALLS.MANAGE"], { mode: "any" });
const canVerify = checkPermission(["MALLS.VERIFY", "MALLS.MANAGE"], { mode: "any" });
const isSuperAdmin = checkPermission(["SUPER_ADMIN"], { mode: "any" });

mallsRouter.get("/overview", authenticateToken, canView, getOverviewData);
mallsRouter.get("/state-wise-overview/:state", authenticateToken, canView, getStateWiseOverview);
mallsRouter.get("/city-wise-overview/:state/:city", authenticateToken, canView, getCityWiseOverview);
mallsRouter.post("/scrape", authenticateToken, isSuperAdmin, triggerMallScrape);
mallsRouter.get("/scrape/status", authenticateToken, isSuperAdmin, getMallScrapeStatus);
mallsRouter.get("/:id", authenticateToken, canView, getVenueById);
mallsRouter.post("/city-wise-overview/:state/:city/add", authenticateToken, canManage, addVenue);
mallsRouter.patch("/status/:id", authenticateToken, canManage, changeStatus);
mallsRouter.patch("/:id", authenticateToken, canManage, updateVenue);
mallsRouter.delete("/:id", authenticateToken, canManage, deleteVenue);
mallsRouter.post("/:id/verify", authenticateToken, canVerify, verifyVenue);
mallsRouter.post("/:id/unverify", authenticateToken, canVerify, unverifyVenue);
mallsRouter.post("/:id/assign", authenticateToken, canManage, assignVenue);
mallsRouter.post("/:id/unassign", authenticateToken, canManage, unassignVenue);
