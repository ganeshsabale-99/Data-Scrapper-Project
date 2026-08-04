import { Router } from "express";
import { authenticateToken, checkPermission } from "../middleware/auth";
import { getNationalOverview } from "../controller/nationalOverviewController";

export const nationalOverviewRouter: Router = Router();

const canView = checkPermission(
  ["TECHPARKS.VIEW", "COWORKING.VIEW", "MALLS.VIEW", "HOSPITALS.VIEW", "STADIUMS.VIEW", "AIRPORTS.VIEW"],
  { mode: "any" },
);

nationalOverviewRouter.get("/", authenticateToken, canView, getNationalOverview);
