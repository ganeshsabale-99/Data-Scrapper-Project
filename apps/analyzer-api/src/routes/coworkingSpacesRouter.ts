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
  addCoworkingSpace,
  updateCoworkingSpace,
  deleteCoworkingSpace,
  getCoworkingSpaceById,
  changeStatus,
  getCompaniesByCoworkingSpace,
  addCompanyToCoworkingSpace,
  getCompanyById,
  updateCompany,
  deleteCompany,
  changeCompanyStatus,
  verifyCoworkingSpaceDetails,
  unverifyCoworkingSpaceDetails,
} from "../controller/coworkingSpaceController";
import {
  assignCoworkingSpace,
  unassignCoworkingSpace,
} from "../controller/venueAssignmentController";

export const coworkingSpacesRouter: Router = Router();

const canViewCoworking = checkPermission(["COWORKING.VIEW", "COWORKING.MANAGE"], {
  mode: "any",
});

const canManageCoworking = checkPermission(["COWORKING.MANAGE"], {
  mode: "any",
});

coworkingSpacesRouter.get("/overview", authenticateToken, canViewCoworking, getOverviewData);
coworkingSpacesRouter.get(
  "/state-wise-overview/:state",
  authenticateToken,
  canViewCoworking,
  getStateWiseOverview,
);
coworkingSpacesRouter.post(
  "/state/:state/cities",
  authenticateToken,
  canManageCoworking,
  addCityToState,
);
coworkingSpacesRouter.get(
  "/city-wise-overview/:state/:city",
  authenticateToken,
  canViewCoworking,
  getCityWiseOverview,
);
coworkingSpacesRouter.get(
  "/city-catalog/state-by-city/:city",
  authenticateToken,
  canViewCoworking,
  getStateByCity,
);
coworkingSpacesRouter.get("/:id", authenticateToken, canViewCoworking, getCoworkingSpaceById);
coworkingSpacesRouter.post(
  "/city-wise-overview/:state/:city/add-coworking-space",
  authenticateToken,
  canManageCoworking,
  addCoworkingSpace,
);
coworkingSpacesRouter.patch(
  "/status/:id",
  authenticateToken,
  canManageCoworking,
  changeStatus,
);
coworkingSpacesRouter.patch(
  "/:id",
  authenticateToken,
  canManageCoworking,
  updateCoworkingSpace,
);
coworkingSpacesRouter.delete(
  "/:id",
  authenticateToken,
  canManageCoworking,
  deleteCoworkingSpace,
);

coworkingSpacesRouter.post(
  "/:id/verify",
  authenticateToken,
  checkPermission(["COWORKING.VERIFY", "COWORKING.MANAGE"], { mode: "any" }),
  verifyCoworkingSpaceDetails,
);

coworkingSpacesRouter.post(
  "/:id/unverify",
  authenticateToken,
  checkPermission(["COWORKING.VERIFY", "COWORKING.MANAGE"], { mode: "any" }),
  unverifyCoworkingSpaceDetails,
);

coworkingSpacesRouter.post(
  "/:id/assign",
  authenticateToken,
  canManageCoworking,
  assignCoworkingSpace,
);

coworkingSpacesRouter.post(
  "/:id/unassign",
  authenticateToken,
  canManageCoworking,
  unassignCoworkingSpace,
);

coworkingSpacesRouter.get(
  "/:coworkingSpaceId/companies",
  authenticateToken,
  canViewCoworking,
  getCompaniesByCoworkingSpace,
);
coworkingSpacesRouter.post(
  "/:coworkingSpaceId/companies",
  authenticateToken,
  canManageCoworking,
  addCompanyToCoworkingSpace,
);
coworkingSpacesRouter.get(
  "/companies/:companyId",
  authenticateToken,
  canViewCoworking,
  getCompanyById,
);
coworkingSpacesRouter.patch(
  "/companies/:companyId",
  authenticateToken,
  canManageCoworking,
  updateCompany,
);
coworkingSpacesRouter.patch(
  "/companies/status/:companyId",
  authenticateToken,
  canManageCoworking,
  changeCompanyStatus,
);
coworkingSpacesRouter.delete(
  "/companies/:companyId",
  authenticateToken,
  canManageCoworking,
  deleteCompany,
);
