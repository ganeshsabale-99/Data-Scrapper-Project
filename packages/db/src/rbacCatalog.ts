

export const DEFAULT_ORGANIZATION_ID = "org_default";
export const DEFAULT_ORGANIZATION_NAME = "Default Organization";
export const DEFAULT_ORGANIZATION_SLUG = "default-org";
export const DEFAULT_DEPARTMENT_ID = "dept_system";
export const DEFAULT_DEPARTMENT_NAME = "System Access";
export const DEFAULT_DEPARTMENT_NORMALIZED = "SYSTEM_ACCESS";

export type PermissionKey =
  | "SYSTEM.ADMIN"
  | "SYSTEM.SUPER_ADMIN"
  | "SCOPE.NATIONAL_VIEW"
  | "SCOPE.STATE_VIEW"
  | "SCOPE.CITY_VIEW"
  | "USERS.VIEW"
  | "USERS.MANAGE"
  | "ANALYTICS.VIEW"

  | "TECHPARKS.VIEW"
  | "TECHPARKS.MANAGE"
  | "TECHPARKS.VERIFY"
  | "COWORKING.VIEW"
  | "COWORKING.MANAGE"
  | "MALLS.VIEW"
  | "MALLS.MANAGE"
  | "MALLS.VERIFY"
  | "HOSPITALS.VIEW"
  | "HOSPITALS.MANAGE"
  | "HOSPITALS.VERIFY"
  | "STADIUMS.VIEW"
  | "STADIUMS.MANAGE"
  | "STADIUMS.VERIFY"
  | "AIRPORTS.VIEW"
  | "AIRPORTS.MANAGE"
  | "AIRPORTS.VERIFY"
  | "FUNDING.NEWS_VIEW"
  | "REPORTS.VIEW"
  | "NOTIFICATIONS.VIEW"
  | "RBAC.MANAGE";

export type PermissionDefinition = {
  key: PermissionKey;
  name: string;
  module: string;
  description: string;
  isSystem?: boolean;
};

export type RoleTemplate = {
  id: string;
  name: string;
  normalizedName: string;
  permissionKeys: PermissionKey[];
  isSystem?: boolean;
};

export const RBAC_PERMISSION_CATALOG: PermissionDefinition[] = [
  {
    key: "SYSTEM.ADMIN",
    name: "System Admin Access",
    module: "SYSTEM",
    description: "Grants admin-level access override",
    isSystem: true,
  },
  {
    key: "SYSTEM.SUPER_ADMIN",
    name: "Super Admin Access",
    module: "SYSTEM",
    description: "Grants unrestricted super-admin access",
    isSystem: true,
  },
  {
    key: "SCOPE.NATIONAL_VIEW",
    name: "View National Scope",
    module: "SCOPE",
    description: "Can access national dashboards",
    isSystem: true,
  },
  {
    key: "SCOPE.STATE_VIEW",
    name: "View State Scope",
    module: "SCOPE",
    description: "Can access state dashboards",
    isSystem: true,
  },
  {
    key: "SCOPE.CITY_VIEW",
    name: "View City Scope",
    module: "SCOPE",
    description: "Can access city dashboards",
    isSystem: true,
  },
  {
    key: "USERS.VIEW",
    name: "View Users",
    module: "USERS",
    description: "Can view user details",
    isSystem: true,
  },
  {
    key: "USERS.MANAGE",
    name: "Manage Users",
    module: "USERS",
    description: "Can approve/edit/deactivate users",
    isSystem: true,
  },
  {
    key: "ANALYTICS.VIEW",
    name: "View Analytics",
    module: "ANALYTICS",
    description: "Can view analytics pages and charts",
    isSystem: true,
  },

  {
    key: "TECHPARKS.VIEW",
    name: "View Tech Parks",
    module: "TECHPARKS",
    description: "Can view tech park inventory",
    isSystem: true,
  },
  {
    key: "TECHPARKS.MANAGE",
    name: "Manage Tech Parks",
    module: "TECHPARKS",
    description: "Can create/update tech parks",
    isSystem: true,
  },
  {
    key: "TECHPARKS.VERIFY",
    name: "Verify Tech Parks",
    module: "TECHPARKS",
    description: "Can verify/unverify tech parks",
    isSystem: true,
  },
  {
    key: "COWORKING.VIEW",
    name: "View Coworking Spaces",
    module: "COWORKING",
    description: "Can view coworking spaces",
    isSystem: true,
  },
  {
    key: "COWORKING.MANAGE",
    name: "Manage Coworking Spaces",
    module: "COWORKING",
    description: "Can manage coworking spaces and companies",
    isSystem: true,
  },
  {
    key: "MALLS.VIEW",
    name: "View Malls",
    module: "MALLS",
    description: "Can view mall inventory",
    isSystem: true,
  },
  {
    key: "MALLS.MANAGE",
    name: "Manage Malls",
    module: "MALLS",
    description: "Can create/update/delete malls",
    isSystem: true,
  },
  {
    key: "MALLS.VERIFY",
    name: "Verify Malls",
    module: "MALLS",
    description: "Can verify/unverify malls",
    isSystem: true,
  },
  {
    key: "HOSPITALS.VIEW",
    name: "View Hospitals",
    module: "HOSPITALS",
    description: "Can view hospital inventory",
    isSystem: true,
  },
  {
    key: "HOSPITALS.MANAGE",
    name: "Manage Hospitals",
    module: "HOSPITALS",
    description: "Can create/update/delete hospitals",
    isSystem: true,
  },
  {
    key: "HOSPITALS.VERIFY",
    name: "Verify Hospitals",
    module: "HOSPITALS",
    description: "Can verify/unverify hospitals",
    isSystem: true,
  },
  {
    key: "STADIUMS.VIEW",
    name: "View Stadiums",
    module: "STADIUMS",
    description: "Can view stadium inventory",
    isSystem: true,
  },
  {
    key: "STADIUMS.MANAGE",
    name: "Manage Stadiums",
    module: "STADIUMS",
    description: "Can create/update/delete stadiums",
    isSystem: true,
  },
  {
    key: "STADIUMS.VERIFY",
    name: "Verify Stadiums",
    module: "STADIUMS",
    description: "Can verify/unverify stadiums",
    isSystem: true,
  },
  {
    key: "AIRPORTS.VIEW",
    name: "View Airports",
    module: "AIRPORTS",
    description: "Can view airport inventory",
    isSystem: true,
  },
  {
    key: "AIRPORTS.MANAGE",
    name: "Manage Airports",
    module: "AIRPORTS",
    description: "Can create/update/delete airports",
    isSystem: true,
  },
  {
    key: "AIRPORTS.VERIFY",
    name: "Verify Airports",
    module: "AIRPORTS",
    description: "Can verify/unverify airports",
    isSystem: true,
  },
  {
    key: "FUNDING.NEWS_VIEW",
    name: "View Funding News",
    module: "FUNDING",
    description: "Can view funding news",
    isSystem: true,
  },
  {
    key: "REPORTS.VIEW",
    name: "View Reports",
    module: "REPORTS",
    description: "Can view and generate reports",
    isSystem: true,
  },
  {
    key: "NOTIFICATIONS.VIEW",
    name: "View Notifications",
    module: "NOTIFICATIONS",
    description: "Can access notifications",
    isSystem: true,
  },
  {
    key: "RBAC.MANAGE",
    name: "Manage RBAC",
    module: "RBAC",
    description: "Can manage departments, roles, and permissions",
    isSystem: true,
  },
];



export const DEFAULT_SYSTEM_ROLE_TEMPLATES: RoleTemplate[] = [
  {
    id: "role_super_admin",
    name: "Super Admin",
    normalizedName: "SUPER_ADMIN",
    permissionKeys: RBAC_PERMISSION_CATALOG.map((p) => p.key),
    isSystem: true,
  },
  {
    id: "role_admin",
    name: "Admin",
    normalizedName: "ADMIN",
    permissionKeys: RBAC_PERMISSION_CATALOG.map((p) => p.key),
    isSystem: true,
  },
  {
    id: "role_sales_manager",
    name: "Sales Manager",
    normalizedName: "SALES_MANAGER",
    permissionKeys: [
      "SCOPE.STATE_VIEW",
      "SCOPE.CITY_VIEW",
      "ANALYTICS.VIEW",

      "TECHPARKS.VIEW",
      "TECHPARKS.MANAGE",
      "TECHPARKS.VERIFY",
      "COWORKING.VIEW",
      "COWORKING.MANAGE",
      "MALLS.VIEW",
      "MALLS.MANAGE",
      "MALLS.VERIFY",
      "HOSPITALS.VIEW",
      "HOSPITALS.MANAGE",
      "HOSPITALS.VERIFY",
      "STADIUMS.VIEW",
      "STADIUMS.MANAGE",
      "STADIUMS.VERIFY",
      "AIRPORTS.VIEW",
      "AIRPORTS.MANAGE",
      "AIRPORTS.VERIFY",
      "FUNDING.NEWS_VIEW",
      "REPORTS.VIEW",
      "NOTIFICATIONS.VIEW",
    ],
    isSystem: true,
  },
  {
    id: "role_sales_team",
    name: "Sales Team",
    normalizedName: "SALES_TEAM",
    permissionKeys: [
      "SCOPE.CITY_VIEW",

      "TECHPARKS.VIEW",
      "COWORKING.VIEW",
      "COWORKING.MANAGE",
      "MALLS.VIEW",
      "MALLS.MANAGE",
      "HOSPITALS.VIEW",
      "HOSPITALS.MANAGE",
      "STADIUMS.VIEW",
      "STADIUMS.MANAGE",
      "AIRPORTS.VIEW",
      "AIRPORTS.MANAGE",
      "FUNDING.NEWS_VIEW",
      "NOTIFICATIONS.VIEW",
    ],
    isSystem: true,
  },
  {
    id: "role_sales_executive",
    name: "Sales Executive",
    normalizedName: "SALES_EXECUTIVE",
    permissionKeys: [
      "SCOPE.CITY_VIEW",

      "TECHPARKS.VIEW",
      "COWORKING.VIEW",
      "COWORKING.MANAGE",
      "MALLS.VIEW",
      "MALLS.MANAGE",
      "HOSPITALS.VIEW",
      "HOSPITALS.MANAGE",
      "STADIUMS.VIEW",
      "STADIUMS.MANAGE",
      "AIRPORTS.VIEW",
      "AIRPORTS.MANAGE",
      "FUNDING.NEWS_VIEW",
      "NOTIFICATIONS.VIEW",
    ],
    isSystem: true,
  },
  {
    id: "role_user",
    name: "User",
    normalizedName: "USER",
    permissionKeys: ["NOTIFICATIONS.VIEW"],
    isSystem: true,
  },
];



export const normalizePermissionKey = (value: string): string =>
  value.trim().toUpperCase().replace(/[^A-Z0-9.]+/g, "_").replace(/_+/g, "_");

export const normalizeRoleName = (value: string): string =>
  value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/_+/g, "_");
