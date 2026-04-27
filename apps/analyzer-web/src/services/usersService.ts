import { axiosInstance } from "@/config/axios";

export type AdminUserDto = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: string;
  roleId?: string | null;
  roleName?: string | null;
  city?: string | null;
  state?: string | null;
  isActive: boolean;
  status?: string;
  isEmailVerified?: boolean;
  isMobileVerified?: boolean;
  isApprovedByAdmin?: boolean;
  requestedRole?: string | null;
  requestedRoleName?: string | null;
  companyName?: string | null;
  companyDetails?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  serialNumber?: number;
};

export type PaginatedResponse<T> = {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

const getResponseStatus = (error: unknown): number => {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return 0;
  }
  const response = (error as { response?: unknown }).response;
  if (typeof response !== "object" || response === null || !("status" in response)) {
    return 0;
  }
  const status = (response as { status?: unknown }).status;
  return typeof status === "number" ? status : 0;
};

export async function fetchAdminUsers(page = 1, pageSize = 20, status?: string) {
  const params = { page, pageSize, status };

  try {
    const res = await axiosInstance.get<PaginatedResponse<AdminUserDto>>(
      "/admin/users",
      { params },
    );

    // Compatibility fallback for older backend builds where /admin/users
    // defaults to pending-only records.
    if (!status && (res.data?.pagination?.totalItems ?? 0) === 0) {
      const legacyRes = await axiosInstance.get<PaginatedResponse<AdminUserDto>>(
        "/auth/users",
        { params },
      );
      if ((legacyRes.data?.pagination?.totalItems ?? 0) > 0) {
        return legacyRes.data;
      }
    }

    return res.data;
  } catch (error: unknown) {
    if (getResponseStatus(error) === 404) {
      const legacyRes = await axiosInstance.get<PaginatedResponse<AdminUserDto>>(
        "/auth/users",
        { params },
      );
      return legacyRes.data;
    }
    throw error;
  }
}

export async function deleteAdminUser(id: string) {
  try {
    const res = await axiosInstance.delete<{ success: boolean }>(`/admin/users/${id}`);
    return res.data;
  } catch (error: unknown) {
    if (getResponseStatus(error) === 404) {
      const legacyRes = await axiosInstance.delete<{ success: boolean }>(`/auth/users/${id}`);
      return legacyRes.data;
    }
    throw error;
  }
}

export type UpdateAdminUserPayload = Partial<
  Pick<AdminUserDto, "name" | "email" | "phoneNumber" | "role" | "city" | "state" | "isActive">
> & {
  roleId?: string;
};

export async function updateAdminUser(id: string, payload: UpdateAdminUserPayload) {
  try {
    const res = await axiosInstance.patch<{ success: boolean; data: AdminUserDto }>(`/admin/users/${id}`, payload);
    return res.data;
  } catch (error: unknown) {
    if (getResponseStatus(error) === 404) {
      const legacyRes = await axiosInstance.patch<{ success: boolean; data: AdminUserDto }>(`/auth/users/${id}`, payload);
      return legacyRes.data;
    }
    throw error;
  }
}

export async function approveAdminUser(id: string) {
  const res = await axiosInstance.post<{ success: boolean; data: AdminUserDto }>(`/admin/users/${id}/approve`);
  return res.data;
}

export async function rejectAdminUser(id: string, reason?: string) {
  const res = await axiosInstance.post<{ success: boolean; data: AdminUserDto }>(`/admin/users/${id}/reject`, { reason });
  return res.data;
}

export type AdminRoleOption = {
  id: string;
  value: string;
  label: string;
  description?: string;
  isSystem: boolean;
  legacyRole?: string;
};

export async function fetchAdminRoleOptions() {
  try {
    const res = await axiosInstance.get<{ success: boolean; data: AdminRoleOption[] }>(
      "/admin/roles/options",
    );
    const options = res.data.data || [];
    if (options.length > 0) {
      return options;
    }
  } catch {
    // Intentionally ignored: fallback endpoint below.
  }

  // Fallback to public requested-role options when admin role options are unavailable/empty.
  try {
    const fallback = await axiosInstance.get<{
      success: boolean;
      data: Array<{ id: string; value: string; label: string }>;
    }>("/auth/requested-roles/options");

    return (fallback.data.data || []).map((role) => ({
      id: role.id,
      value: role.value,
      label: role.label,
      isSystem: false,
    }));
  } catch {
    return [];
  }
}
