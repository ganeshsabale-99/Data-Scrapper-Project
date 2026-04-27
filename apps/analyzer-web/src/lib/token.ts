// JWT Token management (use sessionStorage). Fallback migration from localStorage.
const TOKEN_KEY = "gupio_auth_token";
const TOKEN_EXPIRY_KEY = "gupio_token_expiry";
const USER_KEY = "gupio_user";

// User roles const object - matching backend schema

export type UserRoleType = string;
type RoleAccessConfig = {
  canAccessNational: boolean;
  canAccessState: boolean;
  canAccessCity: boolean;
  canAccessFundingNews: boolean;
  canAccessCoworkingSpaces: boolean;

  canAccessNotifications: boolean;
  canManageUsers: boolean;
  canManageRbac: boolean;
  canViewAnalytics: boolean;
  canManageTechParks: boolean;
  canManageCoworkingSpaces: boolean;
  landingPage: string;
};

export type AccessFlags = {
  national: boolean;
  state: boolean;
  city: boolean;
  fundingNews: boolean;
  users: boolean;
  analytics: boolean;

  techParks: boolean;
  coworkingSpaces: boolean;
  notifications: boolean;
  rbac: boolean;
};

const DEFAULT_ROLE_ACCESS: RoleAccessConfig = {
  canAccessNational: false,
  canAccessState: false,
  canAccessCity: false,
  canAccessFundingNews: false,
  canAccessCoworkingSpaces: false,

  canAccessNotifications: false,
  canManageUsers: false,
  canManageRbac: false,
  canViewAnalytics: false,
  canManageTechParks: false,
  canManageCoworkingSpaces: false,
  landingPage: "/dashboard",
};

const EMPTY_ACCESS_FLAGS: AccessFlags = {
  national: false,
  state: false,
  city: false,
  fundingNews: false,
  users: false,
  analytics: false,

  techParks: false,
  coworkingSpaces: false,
  notifications: false,
  rbac: false,
};

const normalizePermission = (permission: string) =>
  permission.trim().toUpperCase().replace(/[^A-Z0-9.]+/g, "_");

const deriveAccessFlagsFromPermissions = (permissions: string[]): AccessFlags => {
  const set = new Set(permissions.map((permission) => normalizePermission(permission)));
  const has = (...keys: string[]) => keys.some((key) => set.has(normalizePermission(key)));
  const admin = has("SYSTEM.ADMIN", "SYSTEM.SUPER_ADMIN", "*");

  if (admin) {
    return {
      national: true,
      state: true,
      city: true,
      fundingNews: true,
      users: true,
      analytics: true,

      techParks: true,
      coworkingSpaces: true,
      notifications: true,
      rbac: true,
    };
  }

  return {
    national: has("SCOPE.NATIONAL_VIEW"),
    state: has("SCOPE.STATE_VIEW"),
    city: has("SCOPE.CITY_VIEW"),
    fundingNews: has("FUNDING.NEWS_VIEW"),
    users: has("USERS.VIEW", "USERS.MANAGE"),
    analytics: has("ANALYTICS.VIEW"),

    techParks: has("TECHPARKS.VIEW", "TECHPARKS.MANAGE", "TECHPARKS.VERIFY"),
    coworkingSpaces: has("COWORKING.VIEW", "COWORKING.MANAGE"),
    notifications: has("NOTIFICATIONS.VIEW"),
    rbac: has("RBAC.MANAGE"),
  };
};

const toRoleAccessFromFlags = (accessFlags: AccessFlags): RoleAccessConfig => {
  const landingPage = accessFlags.national
    ? "/dashboard/national"
    : accessFlags.state
      ? "/dashboard/state"
      : accessFlags.city
        ? "/dashboard/city"
        : "/dashboard";

  return {
    ...DEFAULT_ROLE_ACCESS,
    canAccessNational: accessFlags.national,
    canAccessState: accessFlags.state,
    canAccessCity: accessFlags.city,
    canAccessFundingNews: accessFlags.fundingNews,
    canAccessCoworkingSpaces: accessFlags.coworkingSpaces,

    canAccessNotifications: accessFlags.notifications,
    canManageUsers: accessFlags.users,
    canManageRbac: accessFlags.rbac,
    canViewAnalytics: accessFlags.analytics,
    canManageTechParks: accessFlags.techParks,
    canManageCoworkingSpaces: accessFlags.coworkingSpaces,
    landingPage,
  };
};

const getResolvedAccessForUser = (user: StoredUser | null): RoleAccessConfig | null => {
  if (!user) return null;

  const explicitFlags = user.accessFlags || null;
  const permissionFlags =
    user.permissions && user.permissions.length > 0
      ? deriveAccessFlagsFromPermissions(user.permissions)
      : null;

  if (!explicitFlags && !permissionFlags) {
    return DEFAULT_ROLE_ACCESS;
  }

  return toRoleAccessFromFlags(explicitFlags || permissionFlags || EMPTY_ACCESS_FLAGS);
};

// Helper functions for role-based access
export const getUserRole = (): UserRoleType | null => {
  const user = getUser();
  return user?.role || null;
};

export const getUserPermissions = (): string[] => {
  const user = getUser();
  return user?.permissions || [];
};

export const getUserAccessFlags = (): AccessFlags => {
  const user = getUser();
  if (!user) return EMPTY_ACCESS_FLAGS;
  if (user.accessFlags) return user.accessFlags;
  if (user.permissions && user.permissions.length > 0) {
    return deriveAccessFlagsFromPermissions(user.permissions);
  }
  return EMPTY_ACCESS_FLAGS;
};

export const hasPermission = (permission: string): boolean => {
  const permissions = getUserPermissions().map((entry) => normalizePermission(entry));
  const requested = normalizePermission(permission);
  if (!requested) return false;
  if (permissions.includes("*")) return true;
  if (permissions.includes("SYSTEM.ADMIN") || permissions.includes("SYSTEM.SUPER_ADMIN")) return true;
  if (permissions.includes(requested)) return true;
  const moduleWildcard = `${requested.split(".")[0]}.*`;
  return permissions.includes(moduleWildcard);
};

export const canAccessRoute = (route: string): boolean => {
  const access = getResolvedAccessForUser(getUser());
  if (!access) return false;

  switch (route) {
    case "/dashboard/national":
      return access.canAccessNational;
    case "/dashboard/state":
      return access.canAccessState;
    case "/dashboard/city":
      return access.canAccessCity;
    case "/dashboard/funding-news":
      return access.canAccessFundingNews;
    case "/dashboard/coworking-spaces":
      return access.canAccessCoworkingSpaces;

    default:
      return true; // Allow access to other routes
  }
};

export const canPerformAction = (action: keyof RoleAccessConfig): boolean => {
  const access = getResolvedAccessForUser(getUser());
  if (!access) return false;
  const value = access[action];
  return typeof value === 'boolean' ? value : false;
};

export const getLandingPage = (): string => {
  const access = getResolvedAccessForUser(getUser());
  if (!access) return "/dashboard";
  if (access.canAccessNational) return "/dashboard/national";
  if (access.canAccessState) return "/dashboard/state";
  if (access.canAccessCity) return "/dashboard/city";
  return access.landingPage || "/dashboard";
};

export const getUserCity = (): string | null => {
  const user = getUser();
  return user?.city || null;
};

export const getUserState = (): string | null => {
  const user = getUser();
  return user?.state || null;
};

export const getCityBasedLandingPage = (): string => {
  const accessFlags = getUserAccessFlags();
  const city = getUserCity();
  const state = getUserState();

  if (accessFlags.national) {
    return "/dashboard/national";
  }

  if (accessFlags.state) {
    if (state) {
      return `/dashboard/state/${encodeURIComponent(state)}`;
    }
    return "/dashboard/state";
  }

  if (accessFlags.city) {
    if (city && state) {
      const cityParam = encodeURIComponent(city);
      const stateParam = encodeURIComponent(state);
      return `/dashboard/city/${stateParam}/${cityParam}`;
    }
    if (city) {
      return `/dashboard/city/${encodeURIComponent(city)}`;
    }
    if (state) {
      return `/dashboard/state/${encodeURIComponent(state)}`;
    }
    return "/dashboard/city";
  }

  return "/dashboard";
};

export const getUserDisplayInfo = (): { city?: string; state?: string; role?: string } => {
  const user = getUser();
  return {
    city: user?.city,
    state: user?.state,
    role: user?.role,
  };
};

const debugStorageError = (context: string, error: unknown) => {
  if (import.meta.env.DEV) {
    console.debug(`[token] ${context}`, error);
  }
};

export const setAuthToken = (token: string) => {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    const expiry = Date.now() + 24 * 60 * 60 * 1000; // 1 day
    sessionStorage.setItem(TOKEN_EXPIRY_KEY, expiry.toString());
  } catch (error) {
    debugStorageError("sessionStorage setAuthToken failed", error);
    try {
      localStorage.setItem(TOKEN_KEY, token);
      const expiry = Date.now() + 24 * 60 * 60 * 1000;
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiry.toString());
    } catch (fallbackError) {
      debugStorageError("localStorage setAuthToken failed", fallbackError);
    }
  }
};

export const getAuthToken = (): string | null => {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY);

    if (token && expiry) {
      if (Date.now() > parseInt(expiry)) {
        clearAuthToken();
        return null;
      }
      return token;
    }

    const lsToken = localStorage.getItem(TOKEN_KEY);
    const lsExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (lsToken && lsExpiry && Date.now() <= parseInt(lsExpiry)) {
      sessionStorage.setItem(TOKEN_KEY, lsToken);
      sessionStorage.setItem(TOKEN_EXPIRY_KEY, lsExpiry);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
      return lsToken;
    }
  } catch (error) {
    debugStorageError("getAuthToken failed", error);
  }

  return null;
};

export const clearAuthToken = () => {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch (error) {
    debugStorageError("sessionStorage clearAuthToken failed", error);
  }
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch (error) {
    debugStorageError("localStorage clearAuthToken failed", error);
  }
};

export const isAuthenticated = (): boolean => {
  return getAuthToken() !== null;
};

export type StoredUser = {
  id?: string;
  name?: string;
  phoneNumber?: string;
  email?: string;
  role?: UserRoleType;
  city?: string;
  state?: string;
  permissions?: string[];
  accessFlags?: AccessFlags;
  avatarUrl?: string | null;
};

export const USER_UPDATED_EVENT = "gupio:user-updated";

const emitUserUpdated = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(USER_UPDATED_EVENT));
};

export const setUser = (user: StoredUser) => {
  try {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    debugStorageError("sessionStorage setUser failed", error);
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (fallbackError) {
      debugStorageError("localStorage setUser failed", fallbackError);
    }
  }
  emitUserUpdated();
};

export const getUser = (): StoredUser | null => {
  try {
    const ss = sessionStorage.getItem(USER_KEY);
    if (ss) return JSON.parse(ss);
  } catch (error) {
    debugStorageError("sessionStorage getUser failed", error);
  }

  try {
    const ls = localStorage.getItem(USER_KEY);
    if (ls) {
      // migrate to sessionStorage for consistency
      sessionStorage.setItem(USER_KEY, ls);
      localStorage.removeItem(USER_KEY);
      return JSON.parse(ls);
    }
  } catch (error) {
    debugStorageError("localStorage getUser failed", error);
  }

  return null;
};

export const clearUser = () => {
  try {
    sessionStorage.removeItem(USER_KEY);
  } catch (error) {
    debugStorageError("sessionStorage clearUser failed", error);
  }
  try {
    localStorage.removeItem(USER_KEY);
  } catch (error) {
    debugStorageError("localStorage clearUser failed", error);
  }
  emitUserUpdated();
};
