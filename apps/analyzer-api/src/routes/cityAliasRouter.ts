import { Router, type IRouter } from "express";
import { authenticateToken, checkPermission } from "../middleware/auth";
import {
  listCityAliases,
  createCityAlias,
  updateCityAlias,
  deleteCityAlias,
  bulkUpsertCityAliases,
  invalidateAliasCache,
} from "../controller/cityAliasController";

export const cityAliasRouter: IRouter = Router();

cityAliasRouter.get("/", authenticateToken, listCityAliases);
cityAliasRouter.post(
  "/",
  authenticateToken,
  checkPermission("CITY_ALIAS.CREATE"),
  createCityAlias,
);
cityAliasRouter.put(
  "/:id",
  authenticateToken,
  checkPermission("CITY_ALIAS.UPDATE"),
  updateCityAlias,
);
cityAliasRouter.delete(
  "/:id",
  authenticateToken,
  checkPermission("CITY_ALIAS.DELETE"),
  deleteCityAlias,
);
cityAliasRouter.post(
  "/bulk",
  authenticateToken,
  checkPermission("CITY_ALIAS.CREATE"),
  bulkUpsertCityAliases,
);
cityAliasRouter.post(
  "/invalidate-cache",
  authenticateToken,
  checkPermission("CITY_ALIAS.UPDATE"),
  invalidateAliasCache,
);
