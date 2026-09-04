import { Router } from "express";
import {
  getExternalNationalTechParks,
  getExternalTechParkById,
  getExternalTechParkCompanies,
} from "../controller/externalTechParkController";
import {
  externalCoworkingSpaces,
  externalMalls,
  externalHospitals,
  externalStadiums,
  externalAirports,
  getExternalCoworkingCompanies,
} from "../controller/externalVenueController";
import { listLeads, getLeadById } from "../controller/leadController";
import { externalApiAuditLogger } from "../middleware/externalApiAudit";
import { externalApiKeyAuth } from "../middleware/externalApiAuth";
import { externalApiRateLimit } from "../middleware/externalApiRateLimit";
import { requireExternalApiScope } from "../middleware/externalApiScope";

export const externalTechparksRouter: Router = Router();


externalTechparksRouter.get("/ping", (req, res) => res.json({ ping: "pong external router" }));

externalTechparksRouter.use(externalApiAuditLogger);
externalTechparksRouter.use(externalApiKeyAuth);
// externalTechparksRouter.use(externalApiRateLimit);

externalTechparksRouter.get(
  "/national-data",
  requireExternalApiScope("techpark:national:read"),
  getExternalNationalTechParks,
);
externalTechparksRouter.get(
  "/techparks/:id",
  requireExternalApiScope("techpark:national:read"),
  getExternalTechParkById,
);
externalTechparksRouter.get(
  "/techparks/:id/companies",
  requireExternalApiScope("techpark:companies:read"),
  getExternalTechParkCompanies,
);

externalTechparksRouter.get(
  "/coworking-spaces",
  requireExternalApiScope("coworking:national:read"),
  externalCoworkingSpaces.list,
);
externalTechparksRouter.get(
  "/coworking-spaces/:id",
  requireExternalApiScope("coworking:national:read"),
  externalCoworkingSpaces.getById,
);
externalTechparksRouter.get(
  "/coworking-spaces/:id/companies",
  requireExternalApiScope("coworking:companies:read"),
  getExternalCoworkingCompanies,
);

externalTechparksRouter.get("/malls", requireExternalApiScope("mall:national:read"), externalMalls.list);
externalTechparksRouter.get("/malls/:id", requireExternalApiScope("mall:national:read"), externalMalls.getById);

externalTechparksRouter.get("/hospitals", requireExternalApiScope("hospital:national:read"), externalHospitals.list);
externalTechparksRouter.get("/hospitals/:id", requireExternalApiScope("hospital:national:read"), externalHospitals.getById);

externalTechparksRouter.get("/stadiums", requireExternalApiScope("stadium:national:read"), externalStadiums.list);
externalTechparksRouter.get("/stadiums/:id", requireExternalApiScope("stadium:national:read"), externalStadiums.getById);

externalTechparksRouter.get("/airports", requireExternalApiScope("airport:national:read"), externalAirports.list);
externalTechparksRouter.get("/airports/:id", requireExternalApiScope("airport:national:read"), externalAirports.getById);

externalTechparksRouter.get("/leads", requireExternalApiScope("leads:read"), listLeads);
externalTechparksRouter.get("/leads/:id", requireExternalApiScope("leads:read"), getLeadById);
