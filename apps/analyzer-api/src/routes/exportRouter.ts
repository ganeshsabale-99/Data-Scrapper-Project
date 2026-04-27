import { Router } from "express";
import {
    authenticateToken,
    checkPermission,
} from "../middleware/auth";
import { exportData } from "../controller/exportController";

export const exportRouter: Router = Router();

exportRouter.get(
    "/",
    authenticateToken,
    checkPermission(["TECHPARKS.VIEW", "COWORKING.VIEW"]), // Using existing view permissions, or could add specialized ones
    exportData
);
