import { axiosInstance } from "@/config/axios";
import {
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  isAuthenticated,
  setUser,
  clearUser,
  type AccessFlags,
  type StoredUser,
} from "@/lib/token";

export interface AuthResponse {
  success: boolean;
  message: string;
  code?: string;
  deliveryChannel?: "EMAIL" | "SMS";
  deliveryAddress?: string;
  mfaRequired?: boolean;
  mfaToken?: string;
  verificationData?: {
    hash: string;
    timestamp: number;
    counter: number;
    expiresAt: number;
  };
  otp?: string;
  user?: {
    id?: string;
    phoneNumber: string;
    name: string;
    email: string;
    role?: string;
    city?: string;
    state?: string;
    permissions?: string[];
    accessFlags?: AccessFlags;
  };
  access?: {
    organizationId?: string;
    effectiveRole?: string;
    permissions?: string[];
    roleIds?: string[];
    roleNames?: string[];
    departments?: string[];
    hasSuperAdmin?: boolean;
    flags?: AccessFlags;
  };
  sessionToken?: string;
}

export interface SendOTPRequest {
  email?: string;
  phoneNumber?: string;
}

export interface VerifyOTPRequest {
  email?: string;
  phoneNumber?: string;
  otp: string;
  verificationData: {
    hash: string;
    timestamp: number;
    counter: number;
    expiresAt: number;
  };
  mfaToken?: string;
}

// Re-export for existing imports in other files
export { getAuthToken, setAuthToken, clearAuthToken, isAuthenticated };

const readResponseData = <T>(error: unknown): T | null => {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return null;
  }
  const response = (error as { response?: unknown }).response;
  if (typeof response !== "object" || response === null || !("data" in response)) {
    return null;
  }
  return ((response as { data?: unknown }).data as T | undefined) ?? null;
};

const readResponseMessage = (error: unknown): string | null => {
  const data = readResponseData<{ message?: unknown }>(error);
  return data && typeof data.message === "string" ? data.message : null;
};

const runSafely = (fn: () => void): void => {
  try {
    fn();
  } catch (error) {
    if (import.meta.env.DEV) {
      console.debug("[auth] ignored client storage write error", error);
    }
  }
};

const buildOtpIdentifierPayload = (identifier: string): SendOTPRequest => {
  const normalized = identifier.trim();
  if (normalized.includes("@")) {
    return { email: normalized.toLowerCase() };
  }
  return { phoneNumber: normalized };
};

export const loginWithPassword = async (email: string, password: string): Promise<AuthResponse> => {
  try {
    const response = await axiosInstance.post("/auth/login", {
      email,
      password,
    });
    const data: AuthResponse = response.data;
    if (data.success && data.sessionToken && data.user) {
      const u: StoredUser = {
        id: data.user.id,
        name: data.user.name,
        phoneNumber: data.user.phoneNumber,
        email: data.user.email,
        role: data.access?.effectiveRole || data.user.role || "USER",
        city: data.user.city,
        state: data.user.state,
        permissions: data.user.permissions || data.access?.permissions || [],
        accessFlags: data.user.accessFlags || data.access?.flags,
      };
      runSafely(() => setUser(u));
      runSafely(() => setAuthToken(data.sessionToken as string));
    }
    return data;
  } catch (error: unknown) {
    const responseData = readResponseData<AuthResponse>(error);
    if (responseData) {
      return responseData;
    }
    throw new Error("Failed to login");
  }
};

export interface SignupRequest {
  name: string;
  email: string;
  phoneNumber?: string;
  password: string;
  city?: string;
  state?: string;
  requestedRole?: string;
}

export interface RequestedRoleOption {
  id: string;
  value: string;
  label: string;
};

export const signup = async (payload: SignupRequest): Promise<AuthResponse> => {
  try {
    const response = await axiosInstance.post("/auth/signup", payload);
    return response.data;
  } catch (error: unknown) {
    const responseData = readResponseData<AuthResponse>(error);
    if (responseData) {
      return responseData;
    }
    throw new Error("Failed to sign up");
  }
};

export const fetchRequestedRoleOptions = async (): Promise<RequestedRoleOption[]> => {
  try {
    const response = await axiosInstance.get<{ success: boolean; data: RequestedRoleOption[] }>(
      "/auth/requested-roles/options",
    );
    return response.data.data || [];
  } catch (error: unknown) {
    const message =
      readResponseMessage(error) ||
      "Unable to load role options right now. Please try again.";
    throw new Error(message);
  }
};

// API calls
export const sendOTP = async (identifier: string): Promise<AuthResponse> => {
  try {
    const response = await axiosInstance.post("/auth/send-otp", buildOtpIdentifierPayload(identifier));
    return response.data;
  } catch (error: unknown) {
    const responseData = readResponseData<AuthResponse>(error);
    if (responseData) {
      return responseData;
    }
    throw new Error("Failed to send OTP");
  }
};

export const resendSignupOtp = async (identifier: string): Promise<AuthResponse> => {
  try {
    const response = await axiosInstance.post("/auth/resend-otp", buildOtpIdentifierPayload(identifier));
    return response.data;
  } catch (error: unknown) {
    const responseData = readResponseData<AuthResponse>(error);
    if (responseData) {
      return responseData;
    }
    throw new Error("Failed to resend OTP");
  }
};

export const verifyOTP = async (
  identifier: string,
  otp: string,
  verificationData: {
    hash: string;
    timestamp: number;
    counter: number;
    expiresAt: number;
  },
  mfaToken?: string
): Promise<AuthResponse> => {
  try {
    const response = await axiosInstance.post("/auth/verify-otp", {
      ...buildOtpIdentifierPayload(identifier),
      otp,
      verificationData,
      mfaToken,
    });
    const data: AuthResponse = response.data;
    if (data.success && data.sessionToken && data.user) {
      // Prefer effective role from dynamic RBAC payload, fallback to user.role.
      const userRole = data.access?.effectiveRole || data.user.role;

      if (!userRole) {
        console.warn('No role received from backend for user:', data.user.phoneNumber);
      }

      const u: StoredUser = {
        id: data.user.id,
        name: data.user.name,
        phoneNumber: data.user.phoneNumber,
        email: data.user.email,
        role: data.access?.effectiveRole || userRole || "USER",
        city: data.user.city,
        state: data.user.state,
        permissions: data.user.permissions || data.access?.permissions || [],
        accessFlags: data.user.accessFlags || data.access?.flags,
      };
      runSafely(() => setUser(u));
      runSafely(() => setAuthToken(data.sessionToken as string));
    }
    return data;
  } catch (error: unknown) {
    const responseData = readResponseData<AuthResponse>(error);
    if (responseData) {
      return responseData;
    }
    throw new Error("Failed to verify OTP");
  }
};

export const verifySignupOtp = async (
  identifier: string,
  otp: string,
  verificationData: {
    hash: string;
    timestamp: number;
    counter: number;
    expiresAt: number;
  }
): Promise<AuthResponse> => {
  try {
    const response = await axiosInstance.post("/auth/verify-otp", {
      ...buildOtpIdentifierPayload(identifier),
      otp,
      verificationData,
    });
    return response.data;
  } catch (error: unknown) {
    const responseData = readResponseData<AuthResponse>(error);
    if (responseData) {
      return responseData;
    }
    throw new Error("Failed to verify OTP");
  }
};

export const logout = async (): Promise<void> => {
  clearAuthToken();
  clearUser();
};

export interface TokenStatusResponse {
  success: boolean;
  message: string;
  code?: string;
  data?: {
    isValid: boolean;
    expiresAt: string;
    timeRemaining: number;
    timeRemainingFormatted: string;
    isExpired: boolean;
  };
  details?: {
    expiredAt: string;
    message: string;
  };
}

export const checkTokenStatus = async (): Promise<TokenStatusResponse> => {
  try {
    const token = getAuthToken();
    if (!token) {
      return {
        success: false,
        message: 'No token found',
        code: 'TOKEN_MISSING'
      };
    }

    const response = await axiosInstance.get("/auth/token-status");
    return response.data;
  } catch (error: unknown) {
    const responseData = readResponseData<TokenStatusResponse>(error);
    if (responseData) {
      return responseData;
    }
    throw new Error("Failed to check token status");
  }
};

export const requestPasswordReset = async (email: string): Promise<AuthResponse> => {
  try {
    const response = await axiosInstance.post("/auth/forgot-password", {
      email,
    });
    return response.data;
  } catch (error: unknown) {
    const responseData = readResponseData<AuthResponse>(error);
    if (responseData) {
      return responseData;
    }
    throw new Error("Failed to request password reset");
  }
};

export const resetPassword = async (
  email: string,
  otp: string,
  verificationData: {
    hash: string;
    timestamp: number;
    counter: number;
    expiresAt: number;
  },
  newPassword: string
): Promise<AuthResponse> => {
  try {
    const response = await axiosInstance.post("/auth/reset-password", {
      email,
      otp,
      verificationData,
      newPassword,
    });
    return response.data;
  } catch (error: unknown) {
    const responseData = readResponseData<AuthResponse>(error);
    if (responseData) {
      return responseData;
    }
    throw new Error("Failed to reset password");
  }
};

export const resendMfaOtp = async (identifier: string, mfaToken: string): Promise<AuthResponse> => {
  try {
    const response = await axiosInstance.post("/auth/resend-mfa-otp", {
      ...buildOtpIdentifierPayload(identifier),
      mfaToken,
    });
    return response.data;
  } catch (error: unknown) {
    const responseData = readResponseData<AuthResponse>(error);
    if (responseData) {
      return responseData;
    }
    throw new Error("Failed to resend OTP");
  }
};
