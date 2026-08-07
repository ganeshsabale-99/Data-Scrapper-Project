import { Router } from "express";
import {
  authenticateToken,
  checkPermission,
} from "../middleware/auth";
import {
  addCityToState,
  getStateByCity,
} from "../controller/cityCatalogController";
import {
  getOverviewData,
  getStateWiseOverview,
  getCityWiseOverview,
  addTechPark,
  changeTechParkStatus,
  verifyTechParkDetails,
  unverifyTechParkDetails,
  rejectTechParkDetails,
  getPendingReviews,
  verifyAllCityTechParks,
  deleteTechPark,
  editTechPark,
  getTechParkById,
  getCompaniesByTechPark,
  discoverCompaniesForTechPark,
  enrichCompaniesForTechParkById,
  addCompanyToTechPark,
  enrichTechParkWebsiteById,
  getCompanyById,
  updateCompany,
  deleteCompany,
  changeCompanyStatus,
} from "../controller/newTechParkController";
import {
  getTechParkActivityLogs,
  addVisitLog,
  addContactLog,
} from "../controller/techParkActivity.controller";
import {
  triggerCoworkingScrape,
  getCoworkingScrapeStatus,
} from "../controller/coworkingScraperController";
import {
  triggerTechParkScrape,
  getTechParkScrapeStatus,
} from "../controller/techParkScraperController";
import {
  assignTechPark,
  unassignTechPark,
} from "../controller/venueAssignmentController";

export const newTechparksRouter: Router = Router();

const canViewTechParks = checkPermission(["TECHPARKS.VIEW", "TECHPARKS.MANAGE"], {
  mode: "any",
});

const canManageTechParks = checkPermission(["TECHPARKS.MANAGE"], {
  mode: "any",
});

const canVerifyTechParks = checkPermission(["TECHPARKS.VERIFY"], {
  mode: "any",
});

const canSuperAdmin = checkPermission(["SYSTEM.SUPER_ADMIN"], {
  mode: "any",
});

newTechparksRouter.get("/overview", authenticateToken, canViewTechParks, getOverviewData);
newTechparksRouter.get(
  "/state-wise-overview/:state",
  authenticateToken,
  canViewTechParks,
  getStateWiseOverview,
);
newTechparksRouter.post(
  "/state/:state/cities",
  authenticateToken,
  canManageTechParks,
  addCityToState,
);
newTechparksRouter.get(
  "/city-wise-overview/:state/:city",
  authenticateToken,
  canViewTechParks,
  getCityWiseOverview,
);
newTechparksRouter.get(
  "/city-catalog/state-by-city/:city",
  authenticateToken,
  canViewTechParks,
  getStateByCity,
);
newTechparksRouter.get(
  "/companies/:companyId",
  authenticateToken,
  canViewTechParks,
  getCompanyById,
);
newTechparksRouter.patch(
  "/companies/status/:companyId",
  authenticateToken,
  canManageTechParks,
  changeCompanyStatus,
);
newTechparksRouter.patch(
  "/companies/:companyId",
  authenticateToken,
  canManageTechParks,
  updateCompany,
);
newTechparksRouter.delete(
  "/companies/:companyId",
  authenticateToken,
  canManageTechParks,
  deleteCompany,
);
newTechparksRouter.post(
  "/scrape-coworking",
  authenticateToken,
  canSuperAdmin,
  triggerCoworkingScrape,
);
newTechparksRouter.get(
  "/scrape-coworking/status",
  authenticateToken,
  canSuperAdmin,
  getCoworkingScrapeStatus,
);
newTechparksRouter.post(
  "/scrape-techparks",
  authenticateToken,
  canSuperAdmin,
  triggerTechParkScrape,
);
newTechparksRouter.get(
  "/scrape-techparks/status",
  authenticateToken,
  canSuperAdmin,
  getTechParkScrapeStatus,
);
newTechparksRouter.get(
  "/pending-reviews",
  authenticateToken,
  canVerifyTechParks,
  getPendingReviews,
);
newTechparksRouter.get("/:id", authenticateToken, canViewTechParks, getTechParkById);
newTechparksRouter.post(
  "/city-wise-overview/:state/:city/add-tech-park",
  authenticateToken,
  canManageTechParks,
  addTechPark,
);
newTechparksRouter.patch(
  "/status/:id",
  authenticateToken,
  canManageTechParks,
  changeTechParkStatus,
);
newTechparksRouter.post(
  "/city-wise-overview/:state/:city/verify-unverified",
  authenticateToken,
  canVerifyTechParks,
  verifyAllCityTechParks,
);
newTechparksRouter.post(
  "/:id/verify",
  authenticateToken,
  canVerifyTechParks,
  verifyTechParkDetails,
);
newTechparksRouter.post(
  "/:id/unverify",
  authenticateToken,
  canVerifyTechParks,
  unverifyTechParkDetails,
);
newTechparksRouter.post(
  "/:id/reject",
  authenticateToken,
  canVerifyTechParks,
  rejectTechParkDetails,
);
newTechparksRouter.post(
  "/:id/assign",
  authenticateToken,
  canManageTechParks,
  assignTechPark,
);
newTechparksRouter.post(
  "/:id/unassign",
  authenticateToken,
  canManageTechParks,
  unassignTechPark,
);
newTechparksRouter.post(
  "/:id/enrich-website-details",
  authenticateToken,
  canManageTechParks,
  enrichTechParkWebsiteById,
);
newTechparksRouter.patch(
  "/:id",
  authenticateToken,
  canManageTechParks,
  editTechPark,
);
newTechparksRouter.delete(
  "/:id",
  authenticateToken,
  canManageTechParks,
  deleteTechPark,
);
newTechparksRouter.get(
  "/:techParkId/companies",
  authenticateToken,
  canViewTechParks,
  getCompaniesByTechPark,
);
newTechparksRouter.post(
  "/:techParkId/companies/discover",
  authenticateToken,
  canManageTechParks,
  discoverCompaniesForTechPark,
);
newTechparksRouter.post(
  "/:techParkId/companies/enrich-details",
  authenticateToken,
  canManageTechParks,
  enrichCompaniesForTechParkById,
);
newTechparksRouter.post(
  "/:techParkId/companies",
  authenticateToken,
  canManageTechParks,
  addCompanyToTechPark,
);


// Activity, Visits, and Contact Logs
newTechparksRouter.get(
  "/:id/activity",
  authenticateToken,
  canViewTechParks,
  getTechParkActivityLogs
);
newTechparksRouter.post(
  "/:id/visits",
  authenticateToken,
  canManageTechParks,
  addVisitLog
);
newTechparksRouter.post(
  "/:id/contact-logs",
  authenticateToken,
  canManageTechParks,
  addContactLog
);

