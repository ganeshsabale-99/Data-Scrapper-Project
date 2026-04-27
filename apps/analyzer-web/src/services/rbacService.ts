import { axiosInstance } from "@/config/axios";

export type AccessPermission = {
  id: string;
  key: string;
  name: string;
  module: string;
  description?: string | null;
  isSystem?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AccessRolePermissionEdge = {
  roleId: string;
  permissionId: string;
  grantedAt?: string;
  permission: AccessPermission;
};

export type AccessRole = {
  id: string;
  name: string;
  normalizedName: string;
  organizationId: string;
  departmentId: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
  department?: {
    id: string;
    name: string;
  };
  permissions: AccessRolePermissionEdge[];
  legacyRole?: string;
  _count?: {
    userAssignments: number;
  };
};

export type AccessDepartment = {
  id: string;
  name: string;
  normalizedName: string;
  organizationId: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
  _count?: {
    roles: number;
  };
};

export type UserRoleAssignment = {
  userId: string;
  roleId: string;
  assignedByUserId?: string | null;
  assignedAt: string;
  role: AccessRole;
  assignedByUser?: {
    id: string;
    name: string;
    email?: string;
    role?: string;
  } | null;
};

export type AccessProfile = {
  organizationId: string;
  effectiveRole: string;
  permissions: string[];
  roleIds: string[];
  roleNames: string[];
  departments: string[];
  hasSuperAdmin: boolean;
  flags: {
    national: boolean;
    state: boolean;
    city: boolean;
    fundingNews: boolean;
    users: boolean;
    analytics: boolean;
    performance: boolean;
    techParks: boolean;
    coworkingSpaces: boolean;
    notifications: boolean;
    rbac: boolean;
  };
};

const normalizePermissionKey = (value: string) =>
  value.trim().toUpperCase().replace(/[^A-Z0-9.]+/g, "_");

const dedupe = (items: string[]) => Array.from(new Set(items));

export const rbacService = {
  async getMyAccessProfile() {
    const res = await axiosInstance.get<{ success: boolean; data: AccessProfile }>("/rbac/me");
    return res.data.data;
  },

  async listPermissions(moduleName?: string) {
    const res = await axiosInstance.get<{ success: boolean; data: AccessPermission[] }>(
      "/rbac/permissions",
      {
        params: moduleName ? { module: moduleName } : undefined,
      },
    );
    return res.data.data;
  },

  async listDepartments() {
    const res = await axiosInstance.get<{ success: boolean; data: AccessDepartment[] }>(
      "/rbac/departments",
    );
    return res.data.data;
  },

  async createDepartment(payload: { name: string; isActive?: boolean }) {
    const res = await axiosInstance.post<{ success: boolean; data: AccessDepartment }>(
      "/rbac/departments",
      payload,
    );
    return res.data.data;
  },

  async updateDepartment(departmentId: string, payload: { name?: string; isActive?: boolean }) {
    const res = await axiosInstance.patch<{ success: boolean; data: AccessDepartment }>(
      `/rbac/departments/${encodeURIComponent(departmentId)}`,
      payload,
    );
    return res.data.data;
  },

  async deleteDepartment(departmentId: string) {
    const res = await axiosInstance.delete<{ success: boolean }>(
      `/rbac/departments/${encodeURIComponent(departmentId)}`,
    );
    return res.data;
  },

  async listRoles(params?: {
    departmentId?: string;
    includeInactive?: boolean;
  }) {
    const res = await axiosInstance.get<{ success: boolean; data: AccessRole[] }>("/rbac/roles", {
      params: {
        departmentId: params?.departmentId,
        includeInactive: params?.includeInactive ? "true" : undefined,
      },
    });
    return res.data.data;
  },

  async createRole(payload: {
    departmentId: string;
    name: string;
    permissionKeys?: string[];
    isActive?: boolean;
  }) {
    const permissionKeys = dedupe(
      (payload.permissionKeys || [])
        .map((key) => normalizePermissionKey(key))
        .filter(Boolean),
    );
    const res = await axiosInstance.post<{ success: boolean; data: AccessRole }>(
      "/rbac/roles",
      {
        ...payload,
        permissionKeys,
      },
    );
    return res.data.data;
  },

  async updateRole(roleId: string, payload: { name?: string; isActive?: boolean }) {
    const res = await axiosInstance.patch<{ success: boolean; data: AccessRole }>(
      `/rbac/roles/${encodeURIComponent(roleId)}`,
      payload,
    );
    return res.data.data;
  },

  async deleteRole(roleId: string) {
    const res = await axiosInstance.delete<{ success: boolean }>(
      `/rbac/roles/${encodeURIComponent(roleId)}`,
    );
    return res.data;
  },

  async replaceRolePermissions(roleId: string, permissionKeys: string[]) {
    const keys = dedupe(permissionKeys.map((key) => normalizePermissionKey(key)).filter(Boolean));
    const res = await axiosInstance.put<{ success: boolean; data: AccessRole }>(
      `/rbac/roles/${encodeURIComponent(roleId)}/permissions`,
      { permissionKeys: keys },
    );
    return res.data.data;
  },

  async getUserRoleAssignments(userId: string) {
    const res = await axiosInstance.get<{ success: boolean; data: UserRoleAssignment[] }>(
      `/rbac/users/${encodeURIComponent(userId)}/roles`,
    );
    return res.data.data;
  },

  async assignUserRoles(userId: string, roleIds: string[], mode: "replace" | "append" = "replace") {
    const payload = {
      roleIds: dedupe(roleIds.filter(Boolean)),
      mode,
    };
    const res = await axiosInstance.put<{ success: boolean; data: UserRoleAssignment[] }>(
      `/rbac/users/${encodeURIComponent(userId)}/roles`,
      payload,
    );
    return res.data.data;
  },
};
