import { Request, Response, NextFunction } from 'express';
import { verifySessionToken, getTokenExpirationInfo } from '../libs/hashOtpUtils';
import { prismaInstance } from '@repo/db';
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";
import { withDbRetry } from "../utils/dbRetry";
import {
  canSatisfyRoleGate,
  hasPermissions,
  resolveUserAccessContext,
  toAccessResponse,
  type FrontendAccessFlags,
} from "../modules/rbac/accessControlService";
import { normalizePermissionKey } from "@repo/db";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        identifier: string;
        type: 'phone' | 'email';
        role?: string;
        city?: string | null;
        state?: string | null;
        organizationId?: string | null;
        permissions?: string[];
        roleIds?: string[];
        roleNames?: string[];
        departments?: string[];
        hasSuperAdmin?: boolean;
        accessFlags?: FrontendAccessFlags;
      };
      tokenInfo?: {
        isValid: boolean;
        expiresAt: Date;
        timeRemaining: number;
        isExpired: boolean;
      };
    }
  }
}



const normalizePermissionList = (permissions: string[]) =>
  permissions
    .map((permission) => normalizePermissionKey(permission))
    .filter(Boolean);

const attachAccessContext = async (
  req: Request,
  fallback: { role: string; organizationId?: string | null },
  options?: { context?: string; allowLegacyFallback?: boolean },
) => {
  if (!req.user?.userId) return null;

  const resolved = await resolveUserAccessContext(req.user.userId, fallback, {
    allowLegacyFallback: options?.allowLegacyFallback ?? true,
    fallbackReason: options?.context || "auth.middleware",
  });
  const accessResponse = toAccessResponse(resolved.access);

  req.user.role = accessResponse.effectiveRole;
  req.user.organizationId = accessResponse.organizationId;
  req.user.permissions = accessResponse.permissions;
  req.user.roleIds = accessResponse.roleIds;
  req.user.roleNames = accessResponse.roleNames;
  req.user.departments = accessResponse.departments;
  req.user.hasSuperAdmin = accessResponse.hasSuperAdmin;
  req.user.accessFlags = accessResponse.flags;

  return resolved.access;
};

const getRequestPermissionSet = (req: Request) =>
  new Set(normalizePermissionList(req.user?.permissions || []));

export function requireRole(allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    const userId = req.user.userId;

    try {
      if (req.user.role && allowedRoles.includes(req.user.role)) {
        return next();
      }

      const user = await withDbRetry(
        () =>
          prismaInstance.adminUser.findUnique({
            where: { id: userId },
            select: { city: true, state: true, organizationId: true },
          }),
        { context: "auth.middleware.requireRole" },
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      req.user.city = user.city;
      req.user.state = user.state;
      req.user.organizationId = user.organizationId;

      const fallbackRole = "USER";
      const accessContext = await attachAccessContext(
        req,
        { role: fallbackRole, organizationId: user.organizationId },
        { context: "auth.middleware.requireRole", allowLegacyFallback: true },
      );

      const canAccess = accessContext
        ? canSatisfyRoleGate(accessContext, allowedRoles)
        : allowedRoles.includes(fallbackRole);

      if (!canAccess) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions for this action',
          code: 'INSUFFICIENT_PERMISSIONS',
          details: {
            requiredRoles: allowedRoles,
            userRole: req.user.role || fallbackRole
          }
        });
      }

      next();
    } catch (error) {
      return sendSafeErrorResponse(
        res,
        error,
        "auth.middleware.requireRole",
        "Unable to verify your permissions right now. Please try again.",
      );
    }
  };
}

export function checkPermission(
  requiredPermissions: string | string[],
  options?: { mode?: "all" | "any"; allowedRoles?: string[] },
) {
  const permissions = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : [requiredPermissions];
  const normalizedPermissions = normalizePermissionList(permissions);
  const mode = options?.mode || "all";
  const allowedRoles = options?.allowedRoles || [];

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    try {
      if (req.user.role && allowedRoles.includes(req.user.role)) {
        return next();
      }

      if (!req.user.permissions || req.user.permissions.length === 0) {
        const dbUser = await withDbRetry(
          () =>
            prismaInstance.adminUser.findUnique({
              where: { id: req.user!.userId },
              select: { organizationId: true, city: true, state: true },
            }),
          { context: "auth.middleware.checkPermission" },
        );

        if (!dbUser) {
          return res.status(404).json({
            success: false,
            message: "User not found",
            code: "USER_NOT_FOUND",
          });
        }

        const fallbackRole = "USER";
        req.user.role = fallbackRole;
        req.user.organizationId = dbUser.organizationId;
        req.user.city = dbUser.city;
        req.user.state = dbUser.state;
        await attachAccessContext(
          req,
          { role: fallbackRole, organizationId: dbUser.organizationId },
          { context: "auth.middleware.checkPermission", allowLegacyFallback: true },
        );
      }

      const hasRequiredAccess = hasPermissions(
        getRequestPermissionSet(req),
        normalizedPermissions,
        mode,
      );

      if (!hasRequiredAccess) {
        return res.status(403).json({
          success: false,
          message: "Insufficient permissions for this action",
          code: "INSUFFICIENT_PERMISSIONS",
          details: {
            requiredPermissions: normalizedPermissions,
            mode,
            userRole: req.user.role,
          },
        });
      }

      return next();
    } catch (error) {
      return sendSafeErrorResponse(
        res,
        error,
        "auth.middleware.checkPermission",
        "Unable to verify your permissions right now. Please try again.",
      );
    }
  };
}
export const requirePermission = checkPermission;

export const requireAdmin = checkPermission(["SYSTEM.ADMIN"], { mode: "any" });
export const requireSalesManager = checkPermission(["SCOPE.STATE_VIEW"], { mode: "any" });
export const requireSalesTeam = checkPermission(["SCOPE.CITY_VIEW"], { mode: "any" });
export const requireSalesExecutive = checkPermission(["SCOPE.CITY_VIEW"], { mode: "any" });

const readBearerToken = (authHeader: string | undefined): string | null => {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
};

type AuthenticateOptions = {
  allowQueryToken: boolean;
  context: string;
};

const authenticateTokenInternal = async (
  req: Request,
  res: Response,
  next: NextFunction,
  options: AuthenticateOptions,
) => {
  const authHeader = req.headers['authorization'];
  const headerToken = readBearerToken(typeof authHeader === "string" ? authHeader : undefined);
  const queryToken =
    options.allowQueryToken && typeof req.query?.token === "string"
      ? req.query.token
      : undefined;
  const token = headerToken || queryToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required. Please login to continue.',
      code: 'TOKEN_MISSING'
    });
  }

  const user = (() => {
    try {
      return verifySessionToken(token);
    } catch {
      return null;
    }
  })();

  if (!user) {
    const expirationInfo = getTokenExpirationInfo(token);

    if (expirationInfo && expirationInfo.isExpired) {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please login again.',
        code: 'TOKEN_EXPIRED',
        details: {
          expiredAt: expirationInfo.expiresAt.toISOString(),
          message: 'Your session has expired after 24 hours. Please login again.'
        }
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid session token. Please login again.',
      code: 'TOKEN_INVALID'
    });
  }

  try {
    const dbUser = await withDbRetry(
      () =>
        prismaInstance.adminUser.findUnique({
          where: { id: user.userId },
          select: {
            status: true,
            isActive: true,
            isApprovedByAdmin: true,
            isEmailVerified: true,
            isMobileVerified: true,
            city: true,
            state: true,
            organizationId: true,
          },
        }),
      { context: options.context },
    );

    if (!dbUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!dbUser.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account is inactive. Please contact the admin.',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    if (dbUser.status === 'REJECTED') {
      return res.status(403).json({
        success: false,
        message: 'Your registration was rejected. Please contact support.',
        code: 'ACCOUNT_REJECTED'
      });
    }

    const hasOtpVerified = Boolean(dbUser.isEmailVerified || dbUser.isMobileVerified);
    if (!hasOtpVerified || dbUser.status === 'OTP_PENDING') {
      return res.status(403).json({
        success: false,
        message: 'Email OTP verification required before accessing the system.',
        code: 'OTP_NOT_VERIFIED'
      });
    }

    if (!dbUser.isApprovedByAdmin || dbUser.status === 'ADMIN_APPROVAL_PENDING') {
      return res.status(403).json({
        success: false,
        message: 'Your account is awaiting admin approval.',
        code: 'ADMIN_APPROVAL_PENDING'
      });
    }

    if (dbUser.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Your account is not active.',
        code: 'ACCOUNT_NOT_ACTIVE'
      });
    }

    const fallbackRole = "USER";
    req.user = {
      ...user,
      role: fallbackRole,
      city: dbUser.city,
      state: dbUser.state,
      organizationId: dbUser.organizationId,
    };
    await attachAccessContext(
      req,
      { role: fallbackRole, organizationId: dbUser.organizationId },
      { context: options.context, allowLegacyFallback: true },
    );
    next();
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      options.context,
      "Unable to validate your account right now. Please try again.",
    );
  }
};

export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  return authenticateTokenInternal(req, res, next, {
    allowQueryToken: false,
    context: "auth.middleware.authenticateToken",
  });
}

export async function authenticateTokenForEventStream(req: Request, res: Response, next: NextFunction) {
  return authenticateTokenInternal(req, res, next, {
    allowQueryToken: true,
    context: "auth.middleware.authenticateTokenForEventStream",
  });
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const attachUser = async () => {
      try {
        const user = verifySessionToken(token);
        if (!user) return;

        const dbUser = await withDbRetry(
          () =>
            prismaInstance.adminUser.findUnique({
              where: { id: user.userId },
              select: { city: true, state: true, organizationId: true },
            }),
          { context: "auth.middleware.optionalAuth" },
        );

        const fallbackRole = "USER";
        req.user = {
          ...user,
          role: fallbackRole,
          city: dbUser?.city,
          state: dbUser?.state,
          organizationId: dbUser?.organizationId,
        };

        if (fallbackRole) {
          await attachAccessContext(
            req,
            { role: fallbackRole, organizationId: dbUser?.organizationId },
            { context: "auth.middleware.optionalAuth", allowLegacyFallback: true },
          );
        }
      } catch (error) {
        console.warn('Invalid token in optional auth:', error);
      }
    };

    attachUser().then(() => next());
    return;
  }

  next();
}


export function checkTokenStatus(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const user = verifySessionToken(token);
      const expirationInfo = getTokenExpirationInfo(token);

      if (user && expirationInfo) {
        req.user = user;
        req.tokenInfo = {
          isValid: true,
          expiresAt: expirationInfo.expiresAt,
          timeRemaining: expirationInfo.timeRemaining,
          isExpired: expirationInfo.isExpired
        };
      }
    } catch (error) {
      console.warn('Token status check failed:', error);
    }
  }

  next();
} 
