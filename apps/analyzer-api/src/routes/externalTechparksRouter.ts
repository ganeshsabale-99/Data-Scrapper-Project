import { Router } from "express";
import {
  getExternalNationalTechParks,
  getExternalTechParkById,
} from "../controller/externalTechParkController";
import { externalApiAuditLogger } from "../middleware/externalApiAudit";
import { externalApiKeyAuth } from "../middleware/externalApiAuth";
import { externalApiRateLimit } from "../middleware/externalApiRateLimit";
import { requireExternalApiScope } from "../middleware/externalApiScope";

export const externalTechparksRouter: Router = Router();


externalTechparksRouter.get("/ping", (req, res) => res.json({ ping: "pong external router" }));

externalTechparksRouter.use(externalApiAuditLogger);
externalTechparksRouter.use(externalApiKeyAuth);
externalTechparksRouter.use(requireExternalApiScope("techpark:national:read"));
// externalTechparksRouter.use(externalApiRateLimit);

externalTechparksRouter.get("/national-data", getExternalNationalTechParks);
externalTechparksRouter.get("/techparks/:id", getExternalTechParkById);
