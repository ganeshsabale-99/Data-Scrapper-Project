import {
  prismaInstance,
  type Prisma,
  DEFAULT_DEPARTMENT_ID,
  DEFAULT_DEPARTMENT_NAME,
  DEFAULT_DEPARTMENT_NORMALIZED,
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_ORGANIZATION_NAME,
  DEFAULT_ORGANIZATION_SLUG,
  DEFAULT_SYSTEM_ROLE_TEMPLATES,
  RBAC_PERMISSION_CATALOG,
  normalizePermissionKey,
  normalizeRoleName,
} from "@repo/db";
import { withDbRetry } from "../../utils/dbRetry";

type CacheEntry = {
  expiresAt: number;
  value: ResolvedUserAccess;
};

const ACCESS_CACHE_TTL_MS = Number.parseInt(
  process.env.RBAC_PERMISSION_CACHE_TTL_MS || "60000",
  10,
);
const RBAC_SINGLE_ORGANIZATION_MODE =
  (process.env.RBAC_SINGLE_ORGANIZATION_MODE || "true").toLowerCase() !== "false";
const RBAC_BOOTSTRAP_TX_MAX_WAIT_MS = Number.parseInt(
  process.env.RBAC_BOOTSTRAP_TX_MAX_WAIT_MS || "10000",
  10,
);
const RBAC_BOOTSTRAP_TX_TIMEOUT_MS = Number.parseInt(
  process.env.RBAC_BOOTSTRAP_TX_TIMEOUT_MS || "120000",
  10,
);
const accessCache = new Map<string, CacheEntry>();
let bootstrapPromise: Promise<void> | null = null;
let isBootstrapComplete = false;

export type ResolvedUserAccess = {
  userId: string;
  organizationId: string;
  effectiveRole: string;
  permissions: string[];
  permissionSet: Set<string>;
  roleIds: string[];
  roleNames: string[];
  departments: string[];
  hasSuperAdmin: boolean;
};

export type FrontendAccessFlags = {
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



const RBAC_INFRA_KEYWORDS = [
  "organization",
  "department",
  "accessrole",
  "accesspermission",
  "accessrolepermission",
  "adminuseraccessrole",
];

const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const dedupe = <T>(items: T[]) => Array.from(new Set(items));
const resolveOrganizationId = (organizationId?: string | null) => {
  if (RBAC_SINGLE_ORGANIZATION_MODE) return DEFAULT_ORGANIZATION_ID;
  const normalized = (organizationId || "").trim();
  return normalized || DEFAULT_ORGANIZATION_ID;
};



const toPermissionSet = (permissions: string[]) =>
  new Set(permissions.map((permission) => normalizePermissionKey(permission)).filter(Boolean));

const resolveRoleFromAssignments = (
  assignedRoles: Array<{ normalizedName: string | null; name: string | null; id: string | null }>,
  fallbackRole: string,
): string => {
  const normalizedTokens = assignedRoles.map(r => (r.normalizedName || "").toUpperCase());
  const nameTokens = assignedRoles.map(r => (r.name || "").toUpperCase());
  const idTokens = assignedRoles.map(r => (r.id || "").toUpperCase());

  const isSuperAdmin =
    normalizedTokens.includes("SUPER_ADMIN") ||
    normalizedTokens.includes("SUPERADMIN") ||
    nameTokens.includes("SUPER ADMIN") ||
    nameTokens.includes("SUPER_ADMIN") ||
    idTokens.includes("ROLE_SUPER_ADMIN");

  if (isSuperAdmin) return "SUPER_ADMIN";

  const isAdmin =
    normalizedTokens.includes("ADMIN") ||
    nameTokens.includes("ADMIN") ||
    idTokens.includes("ROLE_ADMIN");

  if (isAdmin) return "ADMIN";

  if (assignedRoles.length > 0) {
    const firstRole = assignedRoles[0];
    if (firstRole) {
      return firstRole.normalizedName || firstRole.name || fallbackRole;
    }
  }
  return fallbackRole;
};

const includesRbacInfraKeyword = (message: string) => {
  const normalized = message.toLowerCase();
  return RBAC_INFRA_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

export const isRbacInfrastructureError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;

  const code =
    "code" in error && typeof (error as { code?: unknown }).code === "string"
      ? ((error as { code: string }).code || "").toUpperCase()
      : "";

  if (!["P2021", "P2022", "P2010", "P1001"].includes(code)) {
    return false;
  }

  const message =
    "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";

  return includesRbacInfraKeyword(message);
};

export const buildLegacyAccessContext = (
  userId: string,
  fallback: { role: string; organizationId?: string | null },
): ResolvedUserAccess => {
  const permissionSet = new Set<string>();

  // Legacy fallback should ideally be removed, but for now we'll 
  // only grant based on the 'role' string if it matches known system patterns.
  if (fallback.role.toUpperCase() === "ADMIN" || fallback.role.toUpperCase() === "SUPER_ADMIN") {
    permissionSet.add("SYSTEM.ADMIN");
  }

  return {
    userId,
    organizationId: fallback.organizationId || DEFAULT_ORGANIZATION_ID,
    effectiveRole: fallback.role,
    permissions: Array.from(permissionSet.values()).sort(),
    permissionSet,
    roleIds: [],
    roleNames: [fallback.role],
    departments: [],
    hasSuperAdmin: fallback.role.toUpperCase() === "SUPER_ADMIN",
  };
};

export type AccessResolution = {
  access: ResolvedUserAccess;
  source: "dynamic" | "legacy_fallback";
  reason?: string;
};

const toCacheTtl = () =>
  Number.isFinite(ACCESS_CACHE_TTL_MS) && ACCESS_CACHE_TTL_MS > 0
    ? ACCESS_CACHE_TTL_MS
    : 60_000;

const getCachedAccess = (userId: string): ResolvedUserAccess | null => {
  const entry = accessCache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    accessCache.delete(userId);
    return null;
  }
  return entry.value;
};

const setCachedAccess = (userId: string, value: ResolvedUserAccess) => {
  accessCache.set(userId, {
    value,
    expiresAt: Date.now() + toCacheTtl(),
  });
};

export const invalidateAccessCache = (userId?: string) => {
  if (!userId) {
    accessCache.clear();
    return;
  }
  accessCache.delete(userId);
};

const getRoleIdForLegacyRole = (legacyRole: string): string => {
  const template = DEFAULT_SYSTEM_ROLE_TEMPLATES.find((role) => role.normalizedName === legacyRole);
  if (!template) {
    throw new Error(`No default access role template found for ${legacyRole}`);
  }
  return template.id;
};

export const ensureRbacBootstrap = async () => {
  if (isBootstrapComplete) return;
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const start = Date.now();

    // Quick check: If permissions already exist, we consider bootstrap done for runtime.
    // Full sync should be handled by 'npx prisma db seed'.
    const permissionCount = await prismaInstance.accessPermission.count();
    if (permissionCount > 0) {
      isBootstrapComplete = true;
      console.log(`[RBAC] Found ${permissionCount} permissions. Bootstrap skipped.`);
      return;
    }

    console.log("[RBAC] Database appears empty. Running lightweight bootstrap...");
    await prismaInstance.$transaction(
      async (tx) => {
        // ... (minimal survival logic if needed, but for production we prefer the seed)
        // I'll keep the existing logic but optimized for 'only if missing'
        // to ensure the app doesn't break if someone forgets to seed in dev.

        // 1. Organization
        await tx.organization.upsert({
          where: { id: DEFAULT_ORGANIZATION_ID },
          create: {
            id: DEFAULT_ORGANIZATION_ID,
            name: DEFAULT_ORGANIZATION_NAME,
            slug: DEFAULT_ORGANIZATION_SLUG,
          },
          update: {},
        });

        // 2. Department
        await tx.department.upsert({
          where: { id: DEFAULT_DEPARTMENT_ID },
          create: {
            id: DEFAULT_DEPARTMENT_ID,
            name: DEFAULT_DEPARTMENT_NAME,
            normalizedName: DEFAULT_DEPARTMENT_NORMALIZED,
            organizationId: DEFAULT_ORGANIZATION_ID,
          },
          update: {},
        });

        // 3. Permissions (Upsert is fine but we only do it if count was 0)
        for (const definition of RBAC_PERMISSION_CATALOG) {
          await tx.accessPermission.upsert({
            where: { key: definition.key },
            create: {
              key: definition.key,
              name: definition.name,
              module: definition.module,
              description: definition.description,
              isSystem: definition.isSystem ?? false,
            },
            update: {},
          });
        }
      },
      {
        maxWait: RBAC_BOOTSTRAP_TX_MAX_WAIT_MS,
        timeout: RBAC_BOOTSTRAP_TX_TIMEOUT_MS,
      }
    );

    isBootstrapComplete = true;
    console.log(`[RBAC] Lightweight bootstrap completed in ${Date.now() - start}ms`);
  })()
    .catch((error) => {
      isBootstrapComplete = false;
      console.error("[RBAC] Bootstrap failed:", error);
      throw error;
    })
    .finally(() => {
      bootstrapPromise = null;
    });

  return bootstrapPromise;
};

export const getUserAccessContext = async (
  userId: string,
  fallback: { role: string; organizationId?: string | null },
): Promise<ResolvedUserAccess> => {
  const cached = getCachedAccess(userId);
  if (cached) return cached;

  await ensureRbacBootstrap();

  const user = await withDbRetry(
    () =>
      prismaInstance.adminUser.findUnique({
        where: { id: userId },
        select: {
          id: true,
          organizationId: true,
          accessRoles: {
            where: {
              role: { isActive: true },
            },
            select: {
              role: {
                select: {
                  id: true,
                  name: true,
                  normalizedName: true,
                  permissions: {
                    select: {
                      permission: {
                        select: { key: true },
                      },
                    },
                  },
                  department: {
                    select: { name: true },
                  },
                },
              },
            },
          },
        },
      }),
    { context: "rbac.getUserAccessContext" },
  );

  if (!user) {
    throw Object.assign(new Error("User not found"), { statusCode: 404, code: "USER_NOT_FOUND" });
  }

  const roleIdentifiers = user.accessRoles.map(a => ({
    normalizedName: a.role.normalizedName || "",
    name: a.role.name || "",
    id: a.role.id || ""
  }));
  const effectiveRole = resolveRoleFromAssignments(roleIdentifiers, fallback.role);
  const dynamicPermissions = user.accessRoles.flatMap((assignment) =>
    assignment.role.permissions.map((permission) => permission.permission.key),
  );
  const permissionSet = new Set<string>(dynamicPermissions.map((key) => normalizePermissionKey(key)));



  const hasSuperAdmin = permissionSet.has("SYSTEM.SUPER_ADMIN");

  if (hasSuperAdmin) {
    permissionSet.add("SYSTEM.ADMIN");
    permissionSet.add("*");
  }

  const context: ResolvedUserAccess = {
    userId,
    organizationId:
      user.organizationId || fallback.organizationId || DEFAULT_ORGANIZATION_ID,
    effectiveRole,
    permissions: Array.from(permissionSet.values()).sort(),
    permissionSet,
    roleIds: dedupe(user.accessRoles.map((assignment) => assignment.role.id)),
    roleNames: dedupe(user.accessRoles.map((assignment) => assignment.role.name)),
    departments: dedupe(
      user.accessRoles
        .map((assignment) => assignment.role.department.name)
        .filter((value): value is string => Boolean(value)),
    ),
    hasSuperAdmin,
  };

  setCachedAccess(userId, context);
  return context;
};

const checkSinglePermission = (permissionSet: Set<string>, permission: string): boolean => {
  const normalized = normalizePermissionKey(permission);
  if (!normalized) return false;
  if (permissionSet.has("*")) return true;
  if (permissionSet.has(normalized)) return true;
  if (permissionSet.has("SYSTEM.ADMIN")) return true;
  const moduleKey = normalized.split(".")[0];
  if (moduleKey && permissionSet.has(`${moduleKey}.*`)) return true;
  return false;
};

export const hasPermissions = (
  permissionSet: Set<string>,
  requiredPermissions: string[],
  mode: "all" | "any" = "all",
): boolean => {
  if (requiredPermissions.length === 0) return true;
  if (mode === "any") {
    return requiredPermissions.some((permission) =>
      checkSinglePermission(permissionSet, permission),
    );
  }
  return requiredPermissions.every((permission) =>
    checkSinglePermission(permissionSet, permission),
  );
};

export const canSatisfyRoleGate = (
  access: ResolvedUserAccess,
  allowedRoles: string[],
): boolean => {
  if (allowedRoles.includes(access.effectiveRole)) return true;
  return false;
};

export const getFrontendAccessFlags = (access: ResolvedUserAccess): FrontendAccessFlags => ({
  national: hasPermissions(access.permissionSet, ["SCOPE.NATIONAL_VIEW"], "any"),
  state: hasPermissions(access.permissionSet, ["SCOPE.STATE_VIEW"], "any"),
  city: hasPermissions(access.permissionSet, ["SCOPE.CITY_VIEW"], "any"),
  fundingNews: hasPermissions(access.permissionSet, ["FUNDING.NEWS_VIEW"], "any"),
  users: hasPermissions(access.permissionSet, ["USERS.VIEW", "USERS.MANAGE"], "any"),
  analytics: hasPermissions(access.permissionSet, ["ANALYTICS.VIEW"], "any"),
  techParks: hasPermissions(access.permissionSet, ["TECHPARKS.VIEW", "TECHPARKS.MANAGE"], "any"),
  coworkingSpaces: hasPermissions(
    access.permissionSet,
    ["COWORKING.VIEW", "COWORKING.MANAGE"],
    "any",
  ),
  notifications: hasPermissions(access.permissionSet, ["NOTIFICATIONS.VIEW"], "any"),
  rbac: hasPermissions(access.permissionSet, ["RBAC.MANAGE"], "any"),
});

export const resolveUserAccessContext = async (
  userId: string,
  fallback: { role: string; organizationId?: string | null },
  options?: { allowLegacyFallback?: boolean; fallbackReason?: string },
): Promise<AccessResolution> => {
  try {
    const access = await getUserAccessContext(userId, fallback);
    return { access, source: "dynamic" };
  } catch (error) {
    const allowLegacyFallback = options?.allowLegacyFallback ?? true;
    if (!allowLegacyFallback) {
      throw error;
    }

    if (!isRbacInfrastructureError(error)) {
      const reason = error instanceof Error ? error.message : "unknown_rbac_error";
      console.warn("[rbac.resolve.fallback]", { userId, reason });
    }

    return {
      access: buildLegacyAccessContext(userId, fallback),
      source: "legacy_fallback",
      reason: options?.fallbackReason || "legacy_fallback_enabled",
    };
  }
};

export const toAccessResponse = (access: ResolvedUserAccess) => ({
  organizationId: access.organizationId,
  effectiveRole: access.effectiveRole,
  permissions: access.permissions,
  roleIds: access.roleIds,
  roleNames: access.roleNames,
  departments: access.departments,
  hasSuperAdmin: access.hasSuperAdmin,
  flags: getFrontendAccessFlags(access),
});

export const syncLegacyRoleAssignmentForUser = async (
  userId: string,
  legacyRole: string,
  assignedByUserId?: string,
) => {
  await ensureRbacBootstrap();

  const targetRoleId = getRoleIdForLegacyRole(legacyRole);

  await prismaInstance.$transaction(async (tx) => {
    const existing = await tx.adminUserAccessRole.findMany({
      where: { userId },
      select: {
        roleId: true,
        role: { select: { id: true, isSystem: true } },
      },
    });

    const removableRoleIds = existing
      .filter(
        (assignment) =>
          assignment.role.isSystem &&
          assignment.role.id !== targetRoleId,
      )
      .map((assignment) => assignment.roleId);

    if (removableRoleIds.length > 0) {
      await tx.adminUserAccessRole.deleteMany({
        where: {
          userId,
          roleId: { in: removableRoleIds },
        },
      });
    }

    await tx.adminUserAccessRole.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId: targetRoleId,
        },
      },
      create: {
        userId,
        roleId: targetRoleId,
        assignedByUserId: assignedByUserId || null,
      },
      update: {
        assignedByUserId: assignedByUserId || null,
      },
    });
  });

  invalidateAccessCache(userId);
};

type RolePermissionSelection = {
  permissionKeys: string[];
};

const resolvePermissionsForKeys = async (
  tx: Prisma.TransactionClient,
  permissionKeys: string[],
) => {
  const normalized = dedupe(permissionKeys.map((key) => normalizePermissionKey(key)).filter(Boolean));
  if (normalized.length === 0) return [];
  const permissions = await tx.accessPermission.findMany({
    where: { key: { in: normalized } },
    select: { id: true, key: true },
  });
  if (permissions.length !== normalized.length) {
    const foundKeys = new Set(permissions.map((permission) => permission.key));
    const missingKeys = normalized.filter((key) => !foundKeys.has(key));
    throw Object.assign(new Error(`Unknown permission keys: ${missingKeys.join(", ")}`), {
      statusCode: 400,
      code: "PERMISSION_NOT_FOUND",
      details: { missingKeys },
    });
  }
  return permissions;
};

export const rbacAdminService = {
  async listOrganizations() {
    await ensureRbacBootstrap();
    if (RBAC_SINGLE_ORGANIZATION_MODE) {
      return prismaInstance.organization.findMany({
        where: { id: DEFAULT_ORGANIZATION_ID },
        include: {
          _count: {
            select: {
              users: true,
              departments: true,
              roles: true,
            },
          },
        },
      });
    }
    return prismaInstance.organization.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: {
        _count: {
          select: {
            users: true,
            departments: true,
            roles: true,
          },
        },
      },
    });
  },

  async createOrganization(payload: { name: string; slug?: string; isActive?: boolean }) {
    await ensureRbacBootstrap();
    if (RBAC_SINGLE_ORGANIZATION_MODE) {
      throw Object.assign(new Error("Organization management is disabled in single-org mode"), {
        statusCode: 400,
        code: "ORGANIZATION_LAYER_DISABLED",
      });
    }
    const name = (payload.name || "").trim();
    if (!name) {
      throw Object.assign(new Error("Organization name is required"), {
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
    }

    const slug = normalizeSlug(payload.slug || name);
    if (!slug) {
      throw Object.assign(new Error("Organization slug is invalid"), {
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
    }

    return prismaInstance.organization.create({
      data: {
        name,
        slug,
        isActive: payload.isActive ?? true,
      },
    });
  },

  async listDepartments(organizationId?: string) {
    await ensureRbacBootstrap();
    const scopedOrganizationId = resolveOrganizationId(organizationId);
    return prismaInstance.department.findMany({
      where: { organizationId: scopedOrganizationId },
      orderBy: [{ organization: { name: "asc" } }, { name: "asc" }],
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        _count: { select: { roles: true } },
      },
    });
  },

  async createDepartment(payload: {
    organizationId?: string;
    name: string;
    isActive?: boolean;
  }) {
    await ensureRbacBootstrap();
    const name = (payload.name || "").trim();
    const organizationId = resolveOrganizationId(payload.organizationId);
    if (!name) {
      throw Object.assign(new Error("name is required"), {
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
    }

    return prismaInstance.department.create({
      data: {
        organizationId,
        name,
        normalizedName: normalizeRoleName(name),
        isActive: payload.isActive ?? true,
      },
    });
  },

  async updateDepartment(departmentId: string, payload: { name?: string; isActive?: boolean }) {
    await ensureRbacBootstrap();
    const updateData: Record<string, unknown> = {};
    if (payload.name !== undefined) {
      const name = payload.name.trim();
      if (!name) {
        throw Object.assign(new Error("Department name cannot be empty"), {
          statusCode: 400,
          code: "VALIDATION_ERROR",
        });
      }
      updateData.name = name;
      updateData.normalizedName = normalizeRoleName(name);
    }
    if (payload.isActive !== undefined) updateData.isActive = payload.isActive;

    return prismaInstance.department.update({
      where: { id: departmentId },
      data: updateData,
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        _count: { select: { roles: true } },
      },
    });
  },

  async deleteDepartment(departmentId: string) {
    await ensureRbacBootstrap();
    const rolesCount = await prismaInstance.accessRole.count({ where: { departmentId } });
    if (rolesCount > 0) {
      throw Object.assign(new Error("Cannot delete department with existing roles"), {
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
    }
    await prismaInstance.department.delete({ where: { id: departmentId } });
    return { success: true };
  },

  async listPermissions(module?: string) {
    await ensureRbacBootstrap();
    return prismaInstance.accessPermission.findMany({
      where: module ? { module: module.trim().toUpperCase() } : undefined,
      orderBy: [{ module: "asc" }, { key: "asc" }],
    });
  },

  async createPermission(payload: {
    key: string;
    name: string;
    module: string;
    description?: string;
  }) {
    await ensureRbacBootstrap();
    const key = normalizePermissionKey(payload.key || "");
    const name = (payload.name || "").trim();
    const module = normalizePermissionKey(payload.module || "").replace(/\..*$/, "");

    if (!key || !name || !module) {
      throw Object.assign(new Error("key, name, and module are required"), {
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
    }

    return prismaInstance.accessPermission.create({
      data: {
        key,
        name,
        module,
        description: payload.description?.trim() || null,
        isSystem: false,
      },
    });
  },

  async listRoles(filters?: { organizationId?: string; departmentId?: string; includeInactive?: boolean }) {
    await ensureRbacBootstrap();
    const scopedOrganizationId = resolveOrganizationId(filters?.organizationId);
    return prismaInstance.accessRole.findMany({
      where: {
        organizationId: scopedOrganizationId,
        ...(filters?.departmentId ? { departmentId: filters.departmentId } : {}),
        ...(filters?.includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ organization: { name: "asc" } }, { department: { name: "asc" } }, { name: "asc" }],
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        department: { select: { id: true, name: true } },
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: { select: { userAssignments: true } },
      },
    });
  },

  async createRole(payload: {
    organizationId?: string;
    departmentId: string;
    name: string;
    legacyRole?: string | null;
    permissionKeys?: string[];
    isActive?: boolean;
  }) {
    await ensureRbacBootstrap();
    const organizationId = resolveOrganizationId(payload.organizationId);
    const departmentId = (payload.departmentId || "").trim();
    const name = (payload.name || "").trim();

    if (!departmentId || !name) {
      throw Object.assign(new Error("departmentId and name are required"), {
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
    }

    const normalizedName = normalizeRoleName(name);
    const permissionKeys = payload.permissionKeys || [];

    return prismaInstance.$transaction(async (tx) => {
      const department = await tx.department.findFirst({
        where: {
          id: departmentId,
          organizationId,
          isActive: true,
        },
        select: { id: true },
      });
      if (!department) {
        throw Object.assign(new Error("Invalid departmentId for current organization scope"), {
          statusCode: 400,
          code: "VALIDATION_ERROR",
        });
      }

      const role = await tx.accessRole.create({
        data: {
          organizationId,
          departmentId,
          name,
          normalizedName,
          isSystem: false,
          isActive: payload.isActive ?? true,
        },
      });

      if (permissionKeys.length > 0) {
        const permissions = await resolvePermissionsForKeys(tx, permissionKeys);
        await tx.accessRolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId: role.id,
            permissionId: permission.id,
          })),
          skipDuplicates: true,
        });
      }

      return tx.accessRole.findUnique({
        where: { id: role.id },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          department: { select: { id: true, name: true } },
          permissions: { include: { permission: true } },
          _count: { select: { userAssignments: true } },
        },
      });
    });
  },

  async updateRole(
    roleId: string,
    payload: { name?: string; isActive?: boolean },
  ) {
    await ensureRbacBootstrap();
    const updateData: Record<string, unknown> = {};
    if (payload.name !== undefined) {
      const name = payload.name.trim();
      if (!name) {
        throw Object.assign(new Error("Role name cannot be empty"), {
          statusCode: 400,
          code: "VALIDATION_ERROR",
        });
      }
      updateData.name = name;
      updateData.normalizedName = normalizeRoleName(name);
    }

    if (payload.isActive !== undefined) updateData.isActive = payload.isActive;

    const updated = await prismaInstance.accessRole.update({
      where: { id: roleId },
      data: updateData,
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        department: { select: { id: true, name: true } },
        permissions: { include: { permission: true } },
        _count: { select: { userAssignments: true } },
      },
    });

    const impactedUserAssignments = await prismaInstance.adminUserAccessRole.findMany({
      where: { roleId },
      select: { userId: true },
    });
    impactedUserAssignments.forEach((assignment) => invalidateAccessCache(assignment.userId));

    return updated;
  },

  async deleteRole(roleId: string) {
    await ensureRbacBootstrap();
    const assignmentsCount = await prismaInstance.adminUserAccessRole.count({ where: { roleId } });
    if (assignmentsCount > 0) {
      throw Object.assign(new Error("Cannot delete role assigned to users"), {
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
    }

    return prismaInstance.$transaction(async (tx) => {
      await tx.accessRolePermission.deleteMany({ where: { roleId } });
      await tx.accessRole.delete({ where: { id: roleId } });
      return { success: true };
    });
  },

  async replaceRolePermissions(roleId: string, payload: RolePermissionSelection) {
    await ensureRbacBootstrap();
    const keys = payload.permissionKeys || [];
    return prismaInstance.$transaction(async (tx) => {
      const permissions = await resolvePermissionsForKeys(tx, keys);
      await tx.accessRolePermission.deleteMany({ where: { roleId } });
      if (permissions.length > 0) {
        await tx.accessRolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId,
            permissionId: permission.id,
          })),
          skipDuplicates: true,
        });
      }

      const impactedUserAssignments = await tx.adminUserAccessRole.findMany({
        where: { roleId },
        select: { userId: true },
      });
      impactedUserAssignments.forEach((assignment) => invalidateAccessCache(assignment.userId));

      return tx.accessRole.findUnique({
        where: { id: roleId },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          department: { select: { id: true, name: true } },
          permissions: { include: { permission: true } },
          _count: { select: { userAssignments: true } },
        },
      });
    });
  },

  async getUserRoleAssignments(userId: string) {
    await ensureRbacBootstrap();
    return prismaInstance.adminUserAccessRole.findMany({
      where: { userId },
      orderBy: [{ role: { name: "asc" } }],
      include: {
        role: {
          include: {
            department: { select: { id: true, name: true } },
            organization: { select: { id: true, name: true, slug: true } },
            permissions: {
              include: { permission: true },
            },
          },
        },
        assignedByUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  },

  async assignUserRoles(payload: {
    userId: string;
    roleIds: string[];
    mode?: "replace" | "append";
    assignedByUserId?: string;
  }) {
    await ensureRbacBootstrap();
    const userId = payload.userId;
    const roleIds = dedupe(payload.roleIds || []);
    const mode = payload.mode || "replace";

    if (roleIds.length === 0 && mode === "append") {
      throw Object.assign(new Error("At least one roleId is required for append mode"), {
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
    }

    return prismaInstance.$transaction(async (tx) => {
      if (mode === "replace") {
        await tx.adminUserAccessRole.deleteMany({ where: { userId } });
      }

      if (roleIds.length > 0) {
        await tx.adminUserAccessRole.createMany({
          data: roleIds.map((roleId) => ({
            userId,
            roleId,
            assignedByUserId: payload.assignedByUserId || null,
          })),
          skipDuplicates: true,
        });
      }



      return tx.adminUserAccessRole.findMany({
        where: { userId },
        include: {
          role: {
            include: {
              department: { select: { id: true, name: true } },
              organization: { select: { id: true, name: true, slug: true } },
              permissions: { include: { permission: true } },
            },
          },
          assignedByUser: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    }).finally(() => {
      invalidateAccessCache(userId);
    });
  },
};
