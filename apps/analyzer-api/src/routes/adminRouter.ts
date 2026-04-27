import { Router, type Router as ExpressRouter } from "express";
import { authenticateToken, checkPermission } from "../middleware/auth";
import { prismaInstance } from "@repo/db";
import { getEmailService } from "../libs/emailService";
import { getQueryString } from "../utils/queryUtils";
import { upsertCityCatalogEntry } from "../utils/cityCatalog";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";
import { withDbRetry } from "../utils/dbRetry";
import {
  rbacAdminService,
} from "../modules/rbac/accessControlService";
import {
  listExternalClients,
  createExternalClient,
  issueExternalApiKey,
  revokeExternalApiKey,
  deleteExternalClient,
} from "../controller/externalApiKeyManagementController";

export const adminRouter: ExpressRouter = Router();
const requireUsersView = [
  authenticateToken,
  checkPermission(["USERS.VIEW", "USERS.MANAGE"], {
    mode: "any",
  }),
] as const;
const requireUsersManage = [
  authenticateToken,
  checkPermission(["USERS.MANAGE"], {
    mode: "any",
  }),
] as const;

const requireSuperAdmin = [
  authenticateToken,
  checkPermission(["SYSTEM.SUPER_ADMIN"]),
] as const;

const getPrismaErrorCode = (error: unknown): string => {
  if (!error || typeof error !== "object") return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code.toUpperCase() : "";
};

const isValidEmailAddress = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

type AssignableAccessRole = {
  id: string;
  name: string;
  normalizedName: string;
  isSystem: boolean;
};

const normalizeRoleToken = (value: string) =>
  value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");

const listAssignableAccessRoles = async (): Promise<AssignableAccessRole[]> =>
  withDbRetry(
    () =>
      prismaInstance.accessRole.findMany({
        where: {
          isActive: true,
          // Keep critical system-administration roles out of UI assignment.
          permissions: {
            none: {
              permission: {
                key: {
                  in: ["SYSTEM.ADMIN", "SYSTEM.SUPER_ADMIN"],
                },
              },
            },
          },
        },
        select: {
          id: true,
          name: true,
          normalizedName: true,
          isSystem: true,
        },
        orderBy: [{ isSystem: "asc" }, { name: "asc" }],
      }),
    { context: "admin.roles.listAssignable" },
  );

const resolveAssignableAccessRole = (
  roleToken: string | null | undefined,
  roleOptions: AssignableAccessRole[],
): AssignableAccessRole | null => {
  const token = typeof roleToken === "string" ? roleToken.trim() : "";
  if (!token) return null;
  const normalized = normalizeRoleToken(token);
  return (
    roleOptions.find((role) => role.id === token) ||
    roleOptions.find((role) => role.normalizedName === normalized) ||
    roleOptions.find((role) => role.name.toLowerCase() === token.toLowerCase()) ||
    null
  );
};

const getRequestedRoleName = (
  roleToken: string | null | undefined,
  roleOptions: AssignableAccessRole[],
): string | null => {
  const role = resolveAssignableAccessRole(roleToken, roleOptions);
  return role?.name || null;
};



adminRouter.get("/roles/options", ...requireUsersView, async (_req, res) => {
  try {
    const roles = await listAssignableAccessRoles();
    return res.json({
      success: true,
      data: roles.map((role) => ({
        id: role.id,
        value: role.id,
        label: role.name,
        isSystem: role.isSystem,
      })),
    });
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "admin.roles.options",
      "Unable to load role options right now. Please try again.",
    );
  }
});

adminRouter.get("/users/by-phone/:phoneNumber", ...requireUsersView, async (req, res) => {
  try {
    const phoneNumber = getQueryString(req.params.phoneNumber)?.trim();

    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: "Phone number is required" });
    }

    const user = await prismaInstance.adminUser.findUnique({
      where: { phoneNumber },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        requestedRole: true,
        city: true,
        state: true,
        status: true,
        isEmailVerified: true,
        isMobileVerified: true,
        isApprovedByAdmin: true,
        createdAt: true,
        updatedAt: true,
        accessRoles: {
          orderBy: { assignedAt: "desc" },
          take: 1,
          select: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const roleOptions = await listAssignableAccessRoles();
    const { accessRoles, ...userWithoutAccessRoles } = user;
    const dynamicRole = accessRoles[0]?.role;
    const requestedRole = resolveAssignableAccessRole(user.requestedRole, roleOptions);
    const requestedRoleName = requestedRole?.name || null;

    return res.json({
      success: true,
      data: {
        ...userWithoutAccessRoles,
        roleId: dynamicRole?.id || requestedRole?.id || null,
        roleName: dynamicRole?.name || requestedRole?.name || "",
        requestedRoleName,
      },
      checks: {
        hasRequestedRole: Boolean(user.requestedRole),
        hasState: Boolean(user.state),
        hasCity: Boolean(user.city),
      },
    });
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "admin.users.byPhone",
      "Unable to load user details right now. Please try again.",
    );
  }
});

adminRouter.get("/users", ...requireUsersView, async (req, res) => {
  try {
    const parsedPage = parseInt(getQueryString(req.query.page) || "1", 10);
    const parsedPageSize = parseInt(getQueryString(req.query.pageSize) || "20", 10);
    const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
    const pageSize = Number.isFinite(parsedPageSize)
      ? Math.max(1, Math.min(parsedPageSize, 100))
      : 20;
    const skip = (page - 1) * pageSize;
    const statusQuery = getQueryString(req.query.status)?.toUpperCase();
    let statusFilter: string | undefined;
    if (statusQuery) {
      if (statusQuery === 'PENDING' || statusQuery === 'ADMIN_APPROVAL_PENDING') statusFilter = 'ADMIN_APPROVAL_PENDING';
      else if (statusQuery === 'OTP_PENDING') statusFilter = 'OTP_PENDING';
      else if (statusQuery === 'ACTIVE') statusFilter = 'ACTIVE';
      else if (statusQuery === 'REJECTED') statusFilter = 'REJECTED';
      else if (statusQuery === 'REGISTERED') statusFilter = 'REGISTERED';
    }

    const where = statusFilter ? { status: statusFilter as any } : undefined;

    const [items, totalItems] = await Promise.all([
      prismaInstance.adminUser.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          city: true,
          state: true,
          isActive: true,
          mfaEnabled: true,
          status: true,
          isEmailVerified: true,
          isMobileVerified: true,
          isApprovedByAdmin: true,
          requestedRole: true,
          companyName: true,
          companyDetails: true,
          rejectionReason: true,
          createdAt: true,
          accessRoles: {
            orderBy: { assignedAt: "desc" },
            take: 1,
            select: {
              role: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        }
      }),
      prismaInstance.adminUser.count({ where })
    ]);

    const roleOptions = await listAssignableAccessRoles();
    const mappedItems = items.map((item, index) => {
      const { accessRoles, ...itemWithoutAccessRoles } = item;
      const dynamicRole = accessRoles[0]?.role;
      const requestedRole = resolveAssignableAccessRole(item.requestedRole, roleOptions);
      return {
        ...itemWithoutAccessRoles,
        roleId: dynamicRole?.id || requestedRole?.id || null,
        roleName: dynamicRole?.name || requestedRole?.name || "",
        requestedRoleName: requestedRole?.name || null,
        serialNumber: skip + index + 1,
      };
    });

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    return res.json({
      success: true,
      data: mappedItems,
      pagination: { page, pageSize, totalItems, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 }
    });
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "admin.users.list",
      "Unable to load users right now. Please try again shortly.",
    );
  }
});

adminRouter.delete("/users/:id", ...requireUsersManage, async (req, res) => {
  try {
    const id = getQueryString(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: "User id is required" });
    }
    // Nullify / delete all related records that don't have cascade rules before deleting the user
    await prismaInstance.$transaction(async (tx) => {
      // 1. Remove role assignments where this user is the subject (has cascade but do it explicitly too)
      await tx.adminUserAccessRole.deleteMany({ where: { userId: id } });
      // 2. Nullify role assignments where this user was the assigner
      await tx.adminUserAccessRole.updateMany({
        where: { assignedByUserId: id },
        data: { assignedByUserId: null },
      });
      // 3. Nullify ActivityLog references (no cascade on this FK)
      await tx.activityLog.updateMany({
        where: { performedById: id },
        data: { performedById: null },
      });
      // 4. Nullify TechPark verifiedByUserId references
      await tx.newTechPark.updateMany({
        where: { verifiedByUserId: id },
        data: { verifiedByUserId: null },
      });
      // 5. Nullify CoworkingSpace verifiedByUserId references
      await tx.coworkingSpace.updateMany({
        where: { verifiedByUserId: id },
        data: { verifiedByUserId: null },
      });
      // 6. Finally delete the user
      await tx.adminUser.delete({ where: { id } });
    });
    return res.json({ success: true });
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "admin.users.delete",
      "Unable to delete this user right now. Please try again.",
    );
  }
});

adminRouter.patch("/users/:id", ...requireUsersManage, async (req, res) => {
  try {
    const id = getQueryString(req.params.id);
    const { name, email, phoneNumber, roleId, city, state, isActive, mfaEnabled } = req.body as {
      name?: string;
      email?: string;
      phoneNumber?: string;
      roleId?: string;
      city?: string | null;
      state?: string | null;
      isActive?: boolean;
      mfaEnabled?: boolean;
    };

    const updateData: any = {};
    if (typeof name === "string") updateData.name = name;
    if (typeof email === "string") updateData.email = email;
    if (typeof phoneNumber === "string") updateData.phoneNumber = phoneNumber;
    if (city !== undefined) updateData.city = city === null ? null : String(city);
    if (state !== undefined) updateData.state = state === null ? null : String(state);
    if (typeof isActive === "boolean") updateData.isActive = isActive;
    if (typeof mfaEnabled === "boolean") updateData.mfaEnabled = mfaEnabled;

    const existing = await prismaInstance.adminUser.findUnique({
      where: { id },
      select: {
        id: true,
        city: true,
        state: true,
        isActive: true,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: "User not found",
      });
    }

    const requestedRoleToken = roleId;
    let selectedAccessRole: AssignableAccessRole | null = null;
    if (typeof requestedRoleToken === "string" && requestedRoleToken.trim()) {
      const roleOptions = await listAssignableAccessRoles();
      selectedAccessRole = resolveAssignableAccessRole(requestedRoleToken, roleOptions);
      if (!selectedAccessRole) {
        return res.status(400).json({
          success: false,
          code: "INVALID_ROLE",
          message: "Invalid role selected",
        });
      }
      updateData.requestedRole = selectedAccessRole.id;
    }

    const updated = await prismaInstance.adminUser.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        city: true,
        state: true,
        isActive: true,
        mfaEnabled: true,
        status: true,
        isEmailVerified: true,
        isMobileVerified: true,
        isApprovedByAdmin: true,
        requestedRole: true,
        companyName: true,
        companyDetails: true,
        rejectionReason: true,
        createdAt: true,
        accessRoles: {
          orderBy: { assignedAt: "desc" },
          take: 1,
          select: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    await upsertCityCatalogEntry(updated.state, updated.city);

    if (selectedAccessRole) {
      await rbacAdminService.assignUserRoles({
        userId: updated.id,
        roleIds: [selectedAccessRole.id],
        mode: "replace",
        assignedByUserId: req.user?.userId,
      });
    }

    const changes: string[] = [];

    if ((existing.city || null) !== (updated.city || null)) {
      changes.push(`City updated to ${updated.city || "-"}`);
    }
    if ((existing.state || null) !== (updated.state || null)) {
      changes.push(`State updated to ${updated.state || "-"}`);
    }
    if (existing.isActive !== updated.isActive) {
      changes.push(`Account marked ${updated.isActive ? "active" : "inactive"}`);
    }



    return res.json({
      success: true,
      data: {
        ...(() => {
          const { accessRoles, ...updatedWithoutAccessRoles } = updated;
          return updatedWithoutAccessRoles;
        })(),
        roleId: updated.accessRoles[0]?.role.id || selectedAccessRole?.id || null,
        roleName: updated.accessRoles[0]?.role.name || selectedAccessRole?.name || "",
      },
    });
  } catch (error) {
    if (getPrismaErrorCode(error) === "P2002") {
      return res.status(409).json({
        success: false,
        code: "USER_ALREADY_EXISTS",
        message: "User already exists with this phone number or email",
      });
    }

    return sendSafeErrorResponse(
      res,
      error,
      "admin.users.update",
      "Unable to update this user right now. Please try again.",
    );
  }
});

adminRouter.post("/users/:id/approve", ...requireUsersManage, async (req, res) => {
  try {
    const id = getQueryString(req.params.id);
    const user = await prismaInstance.adminUser.findUnique({ where: { id } });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const hasOtpVerified = Boolean(user.isEmailVerified || user.isMobileVerified);
    if (!hasOtpVerified) {
      return res.status(400).json({ success: false, message: "User must verify email OTP before approval" });
    }

    const roleOptions = await listAssignableAccessRoles();
    const requestedAccessRole = resolveAssignableAccessRole(user.requestedRole, roleOptions);
    if (!requestedAccessRole) {
      return res.status(400).json({
        success: false,
        code: "REQUESTED_ROLE_UNAVAILABLE",
        message: "Requested role is unavailable. Please set a role before approval.",
      });
    }

    await rbacAdminService.assignUserRoles({
      userId: user.id,
      roleIds: [requestedAccessRole.id],
      mode: "replace",
      assignedByUserId: req.user?.userId,
    });


    const updated = await prismaInstance.adminUser.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        isApprovedByAdmin: true,
        isActive: true,
        approvedAt: new Date(),
        rejectedAt: null,
        rejectionReason: null
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        city: true,
        state: true,
        isActive: true,
        status: true,
        isEmailVerified: true,
        isMobileVerified: true,
        isApprovedByAdmin: true,
        requestedRole: true,
        companyName: true,
        companyDetails: true,
        rejectionReason: true,
        createdAt: true,
        accessRoles: {
          orderBy: { assignedAt: "desc" },
          take: 1,
          select: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      }
    });

    let approvalEmailSent: boolean | null = null;
    if (updated.email) {
      const emailService = getEmailService();
      const loginUrl = process.env.WEB_APP_URL || process.env.FRONTEND_URL || "http://localhost:3000/login";
      approvalEmailSent = await emailService.sendApprovalEmail({
        to: updated.email,
        name: updated.name,
        loginUrl,
        username: updated.email
      });

      if (!approvalEmailSent) {
        console.warn("[admin.users.approve.emailDeliveryFailed]", {
          userId: updated.id,
          email: updated.email,
          requestId: req.requestId,
        });
      }
    }



    return res.json({
      success: true,
      data: {
        ...(() => {
          const { accessRoles, ...updatedWithoutAccessRoles } = updated;
          return updatedWithoutAccessRoles;
        })(),
        roleId: updated.accessRoles[0]?.role.id || requestedAccessRole?.id || null,
        roleName: updated.accessRoles[0]?.role.name || requestedAccessRole?.name || "",
        requestedRoleName: getRequestedRoleName(updated.requestedRole, roleOptions),
      },
      notifications: {
        approvalEmailSent,
      },
    });
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "admin.users.approve",
      "Unable to approve this user right now. Please try again.",
    );
  }
});

adminRouter.post("/users/:id/reject", ...requireUsersManage, async (req, res) => {
  try {
    const id = getQueryString(req.params.id);
    const { reason } = req.body as { reason?: string };

    const updated = await prismaInstance.adminUser.update({
      where: { id },
      data: {
        status: 'REJECTED',
        isApprovedByAdmin: false,
        isActive: false,
        rejectedAt: new Date(),
        rejectionReason: reason || null
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        city: true,
        state: true,
        isActive: true,
        status: true,
        isEmailVerified: true,
        isMobileVerified: true,
        isApprovedByAdmin: true,
        requestedRole: true,
        companyName: true,
        companyDetails: true,
        rejectionReason: true,
        createdAt: true
      }
    });

    let rejectionEmailSent: boolean | null = null;
    if (updated.email) {
      const emailService = getEmailService();
      const supportUrl = process.env.SUPPORT_URL || undefined;
      rejectionEmailSent = await emailService.sendRejectionEmail({
        to: updated.email,
        name: updated.name,
        reason: updated.rejectionReason,
        supportUrl
      });

      if (!rejectionEmailSent) {
        console.warn("[admin.users.reject.emailDeliveryFailed]", {
          userId: updated.id,
          email: updated.email,
          requestId: req.requestId,
        });
      }
    }



    return res.json({
      success: true,
      data: updated,
      notifications: {
        rejectionEmailSent,
      },
    });
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "admin.users.reject",
      "Unable to reject this user right now. Please try again.",
    );
  }
});

adminRouter.post("/reports/daily/email", ...requireUsersManage, async (req, res) => {
  try {
    const { to, date } = req.body as {
      to?: string;
      date?: string;
    };

    const targetEmail = typeof to === "string" ? to.trim().toLowerCase() : "";
    if (!targetEmail || !isValidEmailAddress(targetEmail)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EMAIL",
        message: "A valid recipient email is required.",
      });
    }

    const reportDate = typeof date === "string" && date.trim().length > 0
      ? date.trim()
      : new Date().toISOString().slice(0, 10);
    const reportStart = new Date(`${reportDate}T00:00:00.000Z`);
    const reportEnd = new Date(`${reportDate}T23:59:59.999Z`);

    const [visited, verified, pending] = await Promise.all([
      prismaInstance.newTechPark.count({
        where: {
          updatedAt: {
            gte: reportStart,
            lte: reportEnd,
          },
        },
      }),
      prismaInstance.newTechPark.count({
        where: {
          isVerified: true,
          verifiedAt: {
            gte: reportStart,
            lte: reportEnd,
          },
        },
      }),
      prismaInstance.newTechPark.count({
        where: {
          isVerified: false,
        },
      }),
    ]);

    const emailService = getEmailService();
    const reportEmailSent = await emailService.sendDailyReportEmail({
      to: targetEmail,
      date: reportDate,
      metrics: {
        visited,
        verified,
        pending,
      },
    });

    if (!reportEmailSent) {
      console.warn("[admin.reports.daily.emailDeliveryFailed]", {
        to: targetEmail,
        date: reportDate,
        requestId: req.requestId,
      });
    }

    return res.json({
      success: true,
      message: reportEmailSent
        ? "Daily report email sent successfully."
        : "Daily report request processed but email delivery failed.",
      data: {
        date: reportDate,
        metrics: {
          visited,
          verified,
          pending,
        },
      },
      notifications: {
        reportEmailSent,
      },
    });
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "admin.reports.daily.email",
      "Unable to send daily report email right now. Please try again.",
    );
  }
});

// External API Key Management (SuperAdmin Only)
adminRouter.get("/external/clients", ...requireSuperAdmin, listExternalClients);
adminRouter.post("/external/clients", ...requireSuperAdmin, createExternalClient);
adminRouter.post("/external/keys", ...requireSuperAdmin, issueExternalApiKey);
adminRouter.post("/external/keys/:id/revoke", ...requireSuperAdmin, revokeExternalApiKey);
adminRouter.delete("/external/clients/:id", ...requireSuperAdmin, deleteExternalClient);
