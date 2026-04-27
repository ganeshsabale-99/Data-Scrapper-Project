import { Router, type Router as ExpressRouter } from "express";
import type { AdminUser } from "@repo/db";
import {
  authenticateToken,
  checkPermission,
} from "../middleware/auth";
import {
  rbacAdminService,
  toAccessResponse,
} from "../modules/rbac/accessControlService";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";
import { getQueryString } from "../utils/queryUtils";

const MANAGE_RBAC_PERMISSION = "RBAC.MANAGE";


const asBoolean = (value: string | undefined, fallback = false) => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const requireRbacAdmin = [
  authenticateToken,
  checkPermission(MANAGE_RBAC_PERMISSION),
] as const;

export const rbacRouter: ExpressRouter = Router();

rbacRouter.get("/me", authenticateToken, async (req, res) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message: "Authentication required",
      });
    }

    const access = toAccessResponse({
      userId: req.user.userId,
      organizationId: req.user.organizationId || "org_default",
      effectiveRole: req.user.role || "USER",
      permissions: req.user.permissions || [],
      permissionSet: new Set(req.user.permissions || []),
      roleIds: req.user.roleIds || [],
      roleNames: req.user.roleNames || [],
      departments: req.user.departments || [],
      hasSuperAdmin: Boolean(req.user.hasSuperAdmin),
    });

    return res.json({
      success: true,
      data: access,
    });
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "rbac.me",
      "Unable to load access profile right now. Please try again.",
    );
  }
});

rbacRouter.get("/departments", ...requireRbacAdmin, async (req, res) => {
  try {
    const organizationId = getQueryString(req.query.organizationId);
    const data = await rbacAdminService.listDepartments(organizationId);
    return res.json({ success: true, data });
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "rbac.departments.list",
      "Unable to load departments right now. Please try again.",
    );
  }
});

rbacRouter.post("/departments", ...requireRbacAdmin, async (req, res) => {
  try {
    const payload = {
      organizationId:
        req.body?.organizationId !== undefined
          ? String(req.body.organizationId)
          : undefined,
      name: String(req.body?.name || ""),
      isActive:
        typeof req.body?.isActive === "boolean" ? req.body.isActive : undefined,
    };
    const data = await rbacAdminService.createDepartment(payload);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "rbac.departments.create",
      "Unable to create department right now. Please try again.",
    );
  }
});

rbacRouter.patch("/departments/:departmentId", ...requireRbacAdmin, async (req, res) => {
  try {
    const departmentId = getQueryString(req.params.departmentId);
    if (!departmentId) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "departmentId is required",
      });
    }

    const payload: { name?: string; isActive?: boolean } = {};
    if (typeof req.body?.name === "string") payload.name = req.body.name;
    if (typeof req.body?.isActive === "boolean") payload.isActive = req.body.isActive;

    const data = await rbacAdminService.updateDepartment(departmentId, payload);
    return res.json({ success: true, data });
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "rbac.departments.update",
      "Unable to update department right now. Please try again.",
    );
  }
});

rbacRouter.delete("/departments/:departmentId", ...requireRbacAdmin, async (req, res) => {
  try {
    const departmentId = getQueryString(req.params.departmentId);
    if (!departmentId) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "departmentId is required",
      });
    }

    const data = await rbacAdminService.deleteDepartment(departmentId);
    return res.json({ success: true, data });
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "rbac.departments.delete",
      "Unable to delete department right now. Please try again.",
    );
  }
});

rbacRouter.get("/permissions", ...requireRbacAdmin, async (req, res) => {
  try {
    const moduleName = getQueryString(req.query.module);
    const data = await rbacAdminService.listPermissions(moduleName);
    return res.json({ success: true, data });
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "rbac.permissions.list",
      "Unable to load permissions right now. Please try again.",
    );
  }
});

rbacRouter.post("/permissions", ...requireRbacAdmin, async (req, res) => {
  try {
    const payload = {
      key: String(req.body?.key || ""),
      name: String(req.body?.name || ""),
      module: String(req.body?.module || ""),
      description:
        req.body?.description !== undefined ? String(req.body.description) : undefined,
    };
    const data = await rbacAdminService.createPermission(payload);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "rbac.permissions.create",
      "Unable to create permission right now. Please try again.",
    );
  }
});

rbacRouter.get("/roles", ...requireRbacAdmin, async (req, res) => {
  try {
    const organizationId = getQueryString(req.query.organizationId);
    const departmentId = getQueryString(req.query.departmentId);
    const includeInactive = asBoolean(getQueryString(req.query.includeInactive), false);
    const data = await rbacAdminService.listRoles({
      organizationId: organizationId || undefined,
      departmentId: departmentId || undefined,
      includeInactive,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "rbac.roles.list",
      "Unable to load roles right now. Please try again.",
    );
  }
});

rbacRouter.post("/roles", ...requireRbacAdmin, async (req, res) => {
  try {


    const payload = {
      organizationId:
        req.body?.organizationId !== undefined
          ? String(req.body.organizationId)
          : undefined,
      departmentId: String(req.body?.departmentId || ""),
      name: String(req.body?.name || ""),
      permissionKeys: Array.isArray(req.body?.permissionKeys)
        ? req.body.permissionKeys.map((value: unknown) => String(value))
        : [],
      isActive:
        typeof req.body?.isActive === "boolean" ? req.body.isActive : undefined,
    };
    const data = await rbacAdminService.createRole(payload);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "rbac.roles.create",
      "Unable to create role right now. Please try again.",
    );
  }
});

rbacRouter.patch("/roles/:roleId", ...requireRbacAdmin, async (req, res) => {
  try {
    const roleId = getQueryString(req.params.roleId);
    if (!roleId) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "roleId is required",
      });
    }


    const payload: { name?: string; isActive?: boolean } = {};
    if (typeof req.body?.name === "string") payload.name = req.body.name;
    if (typeof req.body?.isActive === "boolean") payload.isActive = req.body.isActive;

    const data = await rbacAdminService.updateRole(roleId, payload);
    return res.json({ success: true, data });
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "rbac.roles.update",
      "Unable to update role right now. Please try again.",
    );
  }
});

rbacRouter.delete("/roles/:roleId", ...requireRbacAdmin, async (req, res) => {
  try {
    const roleId = getQueryString(req.params.roleId);
    if (!roleId) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "roleId is required",
      });
    }

    const data = await rbacAdminService.deleteRole(roleId);
    return res.json({ success: true, data });
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "rbac.roles.delete",
      "Unable to delete role right now. Please try again.",
    );
  }
});

rbacRouter.put("/roles/:roleId/permissions", ...requireRbacAdmin, async (req, res) => {
  try {
    const roleId = getQueryString(req.params.roleId);
    if (!roleId) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "roleId is required",
      });
    }
    const permissionKeys = Array.isArray(req.body?.permissionKeys)
      ? req.body.permissionKeys.map((value: unknown) => String(value))
      : [];
    const data = await rbacAdminService.replaceRolePermissions(roleId, { permissionKeys });
    return res.json({ success: true, data });
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "rbac.roles.permissions.replace",
      "Unable to update role permissions right now. Please try again.",
    );
  }
});

rbacRouter.get(
  "/users/:userId/roles",
  ...requireRbacAdmin,
  async (req, res) => {
    try {
      const userId = getQueryString(req.params.userId);
      if (!userId) {
        return res.status(400).json({
          success: false,
          code: "VALIDATION_ERROR",
          message: "userId is required",
        });
      }
      const data = await rbacAdminService.getUserRoleAssignments(userId);
      return res.json({ success: true, data });
    } catch (error) {
      return sendSafeErrorResponse(
        res,
        error,
        "rbac.users.roles.list",
        "Unable to load user role assignments right now. Please try again.",
      );
    }
  },
);

rbacRouter.put(
  "/users/:userId/roles",
  ...requireRbacAdmin,
  async (req, res) => {
    try {
      const userId = getQueryString(req.params.userId);
      if (!userId) {
        return res.status(400).json({
          success: false,
          code: "VALIDATION_ERROR",
          message: "userId is required",
        });
      }

      const roleIds = Array.isArray(req.body?.roleIds)
        ? req.body.roleIds.map((value: unknown) => String(value))
        : [];
      const requestedMode = getQueryString(req.body?.mode)?.toLowerCase();
      const mode = requestedMode === "append" ? "append" : "replace";
      const data = await rbacAdminService.assignUserRoles({
        userId,
        roleIds,
        mode,
        assignedByUserId: req.user?.userId,
      });
      return res.json({ success: true, data });
    } catch (error) {
      return sendSafeErrorResponse(
        res,
        error,
        "rbac.users.roles.assign",
        "Unable to assign user roles right now. Please try again.",
      );
    }
  },
);
