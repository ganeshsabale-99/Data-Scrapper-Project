import { Request } from "express";

type AnyWhere = Record<string, any>;

export interface DataScope {
  role?: string;
  state?: string;
  city?: string;
  denyAll: boolean;
}

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const equalsIgnoreCase = (left?: string, right?: string): boolean => {
  if (!left || !right) return false;
  return left.trim().toLowerCase() === right.trim().toLowerCase();
};

const caseInsensitiveEquals = (value: string) => ({
  equals: value,
  mode: "insensitive" as const,
});

const normalizePermission = (value: string) =>
  value.trim().toUpperCase().replace(/[^A-Z0-9.]+/g, "_");

const hasPermission = (permissionSet: Set<string>, permission: string): boolean => {
  const normalized = normalizePermission(permission);
  if (!normalized) return false;
  if (
    permissionSet.has("*") ||
    permissionSet.has("SYSTEM.ADMIN") ||
    permissionSet.has("SYSTEM.SUPER_ADMIN")
  ) {
    return true;
  }
  if (permissionSet.has(normalized)) return true;
  const moduleKey = normalized.split(".")[0];
  return Boolean(moduleKey && permissionSet.has(`${moduleKey}.*`));
};

const hasAnyPermission = (permissionSet: Set<string>, permissions: string[]) =>
  permissions.some((permission) => hasPermission(permissionSet, permission));

export const getDataScopeFromRequest = (req: Request): DataScope => {
  const role = normalizeText(req.user?.role);
  const state = normalizeText(req.user?.state);
  const city = normalizeText(req.user?.city);
  const permissionSet = new Set(
    (req.user?.permissions || [])
      .map((permission) => normalizePermission(permission))
      .filter(Boolean),
  );
  const flags = req.user?.accessFlags;

  const hasNationalScope =
    Boolean(flags?.national) || hasAnyPermission(permissionSet, ["SCOPE.NATIONAL_VIEW"]);
  const hasStateScope =
    Boolean(flags?.state) || hasAnyPermission(permissionSet, ["SCOPE.STATE_VIEW"]);
  const hasCityScope =
    Boolean(flags?.city) || hasAnyPermission(permissionSet, ["SCOPE.CITY_VIEW"]);

  if (hasNationalScope) {
    return { role, denyAll: false };
  }

  if (hasStateScope) {
    return {
      role,
      state,
      denyAll: !state,
    };
  }

  if (hasCityScope) {
    return {
      role,
      state,
      city,
      denyAll: !state || !city,
    };
  }

  return { role, state, city, denyAll: true };
};

export const canAccessStateCity = (
  scope: DataScope,
  state?: string | null,
  city?: string | null,
): boolean => {
  if (scope.denyAll) return false;

  const normalizedState = normalizeText(state);
  const normalizedCity = normalizeText(city);

  // Scoped users must not access records with missing location fields.
  if (scope.state && !normalizedState) {
    return false;
  }
  if (scope.city && !normalizedCity) {
    return false;
  }

  if (scope.state && normalizedState && !equalsIgnoreCase(scope.state, normalizedState)) {
    return false;
  }
  if (scope.city && normalizedCity && !equalsIgnoreCase(scope.city, normalizedCity)) {
    return false;
  }

  return true;
};

export const applyScopeToStateCityWhere = (
  where: AnyWhere,
  scope: DataScope,
  opts: { stateField?: string; cityField?: string } = {},
): AnyWhere => {
  if (scope.denyAll) {
    where.id = "__NO_SCOPE_ACCESS__";
    return where;
  }

  const stateField = opts.stateField || "state";
  const cityField = opts.cityField || "city";
  const andClauses: AnyWhere[] = [];

  if (scope.state) {
    andClauses.push({ [stateField]: caseInsensitiveEquals(scope.state) });
  }
  if (scope.city) {
    andClauses.push({ [cityField]: caseInsensitiveEquals(scope.city) });
  }

  if (andClauses.length === 0) return where;

  if (Array.isArray(where.AND)) {
    where.AND.push(...andClauses);
  } else if (where.AND) {
    where.AND = [where.AND, ...andClauses];
  } else {
    where.AND = andClauses;
  }

  return where;
};

export const buildTechParkCompanyScopeWhere = (scope: DataScope): AnyWhere => {
  if (scope.denyAll) {
    return { id: "__NO_SCOPE_ACCESS__" };
  }

  const newTechParkFilter: AnyWhere = {};
  if (scope.state) {
    newTechParkFilter.state = caseInsensitiveEquals(scope.state);
  }
  if (scope.city) {
    newTechParkFilter.city = caseInsensitiveEquals(scope.city);
  }

  return Object.keys(newTechParkFilter).length > 0
    ? { newTechPark: newTechParkFilter }
    : {};
};

export const buildCoworkingCompanyScopeWhere = (scope: DataScope): AnyWhere => {
  if (scope.denyAll) {
    return { id: "__NO_SCOPE_ACCESS__" };
  }

  const coworkingSpaceFilter: AnyWhere = {};
  if (scope.state) {
    coworkingSpaceFilter.state = caseInsensitiveEquals(scope.state);
  }
  if (scope.city) {
    coworkingSpaceFilter.city = caseInsensitiveEquals(scope.city);
  }

  return Object.keys(coworkingSpaceFilter).length > 0
    ? { coworkingSpace: coworkingSpaceFilter }
    : {};
};
