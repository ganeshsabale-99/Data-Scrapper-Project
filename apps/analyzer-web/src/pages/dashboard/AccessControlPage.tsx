import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save, ShieldCheck, UserRoundCog } from "lucide-react";
import { fetchAdminUsers, type AdminUserDto } from "@/services/usersService";
import {
  rbacService,
  type AccessPermission,
  type AccessRole,
} from "@/services/rbacService";
import { getUser, setUser } from "@/lib/token";

type PermissionMap = Record<string, string[]>;
type ApiErrorShape = {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
};

type SectionPermission = {
  id: string;
  label: string;
  permissionKeys: string[];
};

const SECTION_PERMISSION_MATRIX: SectionPermission[] = [
  { id: "national", label: "National", permissionKeys: ["SCOPE.NATIONAL_VIEW"] },
  { id: "state", label: "State", permissionKeys: ["SCOPE.STATE_VIEW"] },
  { id: "city", label: "City", permissionKeys: ["SCOPE.CITY_VIEW"] },
  {
    id: "tech-parks",
    label: "Tech Parks",
    permissionKeys: ["TECHPARKS.VIEW", "TECHPARKS.MANAGE", "TECHPARKS.VERIFY"],
  },
  {
    id: "coworking-spaces",
    label: "Coworking Spaces",
    permissionKeys: ["COWORKING.VIEW", "COWORKING.MANAGE"],
  },
  { id: "funding-news", label: "Funding News", permissionKeys: ["FUNDING.NEWS_VIEW"] },
  { id: "users", label: "Users", permissionKeys: ["USERS.VIEW", "USERS.MANAGE"] },
  { id: "analytics", label: "Analytics", permissionKeys: ["ANALYTICS.VIEW"] },

  { id: "reports", label: "Reports", permissionKeys: ["REPORTS.VIEW"] },
  { id: "notifications", label: "Notifications", permissionKeys: ["NOTIFICATIONS.VIEW"] },
  { id: "rbac", label: "Permissions", permissionKeys: ["RBAC.MANAGE"] },
];

const normalizePermission = (value: string) =>
  value.trim().toUpperCase().replace(/[^A-Z0-9.]+/g, "_");

const toRolePermissionMap = (roles: AccessRole[]): PermissionMap => {
  const next: PermissionMap = {};
  roles.forEach((role) => {
    const keys = role.permissions.map((entry) => normalizePermission(entry.permission.key));
    next[role.id] = Array.from(new Set(keys)).sort((left, right) => left.localeCompare(right));
  });
  return next;
};

const sortRoles = (roles: AccessRole[]) =>
  [...roles].sort((left, right) => {
    if (left.isSystem !== right.isSystem) return left.isSystem ? -1 : 1;
    if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
    return left.name.localeCompare(right.name);
  });

const hasAnyPermission = (rolePermissions: string[], required: string[]) => {
  const roleSet = new Set(rolePermissions.map((value) => normalizePermission(value)));
  return required.some((item) => roleSet.has(normalizePermission(item)));
};

const sortPermissionKeys = (keys: string[]) =>
  [...keys].sort((left, right) => left.localeCompare(right));

const readApiErrorMessage = (error: unknown, fallback: string): string => {
  const parsedError = error as ApiErrorShape;
  return parsedError.response?.data?.message || parsedError.message || fallback;
};



export default function AccessControlPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [permissions, setPermissions] = useState<AccessPermission[]>([]);
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [permissionDraft, setPermissionDraft] = useState<PermissionMap>({});
  const [dirtyRoleIds, setDirtyRoleIds] = useState<string[]>([]);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedUserRoleIds, setSelectedUserRoleIds] = useState<string[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);


  const loadUserAssignments = useCallback(async (userId: string) => {
    if (!userId) {
      setSelectedUserRoleIds([]);
      return;
    }

    try {
      setLoadingAssignments(true);
      const assignments = await rbacService.getUserRoleAssignments(userId);
      setSelectedUserRoleIds(assignments.map((entry) => entry.roleId));
    } catch (err: unknown) {
      toast.error(readApiErrorMessage(err, "Failed to load user role assignments"));
      setSelectedUserRoleIds([]);
    } finally {
      setLoadingAssignments(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [rolesRes, permissionsRes, usersRes] = await Promise.all([
        rbacService.listRoles({ includeInactive: true }),
        rbacService.listPermissions(),
        fetchAdminUsers(1, 500),
      ]);

      const sortedRoles = sortRoles(rolesRes);
      setRoles(sortedRoles);
      setPermissions(
        [...permissionsRes].sort((left, right) =>
          `${left.module}.${left.key}`.localeCompare(`${right.module}.${right.key}`),
        ),
      );
      setUsers(usersRes.data);
      setPermissionDraft(toRolePermissionMap(sortedRoles));
      setDirtyRoleIds([]);

      const firstUserId = usersRes.data[0]?.id || "";
      setSelectedUserId(firstUserId);
      await loadUserAssignments(firstUserId);
    } catch (err: unknown) {
      setError(readApiErrorMessage(err, "Failed to load access control data"));
    } finally {
      setLoading(false);
    }
  }, [loadUserAssignments]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, AccessPermission[]>();
    permissions.forEach((permission) => {
      const moduleName = (permission.module || "GENERAL").toUpperCase();
      const current = groups.get(moduleName) || [];
      current.push(permission);
      groups.set(moduleName, current);
    });
    return Array.from(groups.entries()).sort((left, right) => left[0].localeCompare(right[0]));
  }, [permissions]);

  const allPermissionKeys = useMemo(
    () =>
      sortPermissionKeys(
        Array.from(new Set(permissions.map((permission) => normalizePermission(permission.key)))),
      ),
    [permissions],
  );

  const toggleRolePermission = (roleId: string, permissionKey: string, checked: boolean) => {
    const normalized = normalizePermission(permissionKey);
    setPermissionDraft((prev) => {
      const roleKeys = new Set((prev[roleId] || []).map((value) => normalizePermission(value)));
      if (checked) roleKeys.add(normalized);
      else roleKeys.delete(normalized);
      return {
        ...prev,
        [roleId]: sortPermissionKeys(Array.from(roleKeys)),
      };
    });
    setDirtyRoleIds((prev) => (prev.includes(roleId) ? prev : [...prev, roleId]));
  };

  const setAllPermissionsForRole = (roleId: string, grant: boolean) => {
    setPermissionDraft((prev) => ({
      ...prev,
      [roleId]: grant ? allPermissionKeys : [],
    }));
    setDirtyRoleIds((prev) => (prev.includes(roleId) ? prev : [...prev, roleId]));
  };





  const saveRolePermissions = async (roleId: string) => {
    try {
      setSavingRoleId(roleId);
      const updated = await rbacService.replaceRolePermissions(roleId, permissionDraft[roleId] || []);
      const nextRoles = roles.map((role) => (role.id === roleId ? updated : role));
      setRoles(sortRoles(nextRoles));
      setPermissionDraft((prev) => ({
        ...prev,
        [roleId]: toRolePermissionMap([updated])[updated.id] || [],
      }));
      setDirtyRoleIds((prev) => prev.filter((id) => id !== roleId));
      toast.success(`Saved permissions for ${updated.name}`);
    } catch (err: unknown) {
      toast.error(readApiErrorMessage(err, "Failed to save role permissions"));
    } finally {
      setSavingRoleId(null);
    }
  };

  const saveAllChangedRoles = async () => {
    if (dirtyRoleIds.length === 0) {
      toast.info("No pending permission changes");
      return;
    }

    try {
      setSavingAll(true);
      for (const roleId of dirtyRoleIds) {
        const updated = await rbacService.replaceRolePermissions(roleId, permissionDraft[roleId] || []);
        setRoles((prev) => sortRoles(prev.map((role) => (role.id === roleId ? updated : role))));
      }
      setDirtyRoleIds([]);
      toast.success("Permission matrix saved");
    } catch (err: unknown) {
      toast.error(readApiErrorMessage(err, "Failed to save permission matrix"));
    } finally {
      setSavingAll(false);
    }
  };

  const toggleUserRole = (roleId: string, checked: boolean) => {
    setSelectedUserRoleIds((prev) => {
      if (checked) {
        if (prev.includes(roleId)) return prev;
        return [...prev, roleId];
      }
      return prev.filter((id) => id !== roleId);
    });
  };

  const saveUserRoleAssignments = async () => {
    if (!selectedUserId) {
      toast.error("Select a user first");
      return;
    }

    try {
      setSavingAssignments(true);
      const updatedAssignments = await rbacService.assignUserRoles(
        selectedUserId,
        selectedUserRoleIds,
        "replace",
      );
      setSelectedUserRoleIds(updatedAssignments.map((entry) => entry.roleId));
      toast.success("User roles updated");

      const currentUserId = getUser()?.id;
      if (currentUserId && currentUserId === selectedUserId) {
        const profile = await rbacService.getMyAccessProfile();
        const existing = getUser();
        if (existing) {
          setUser({
            ...existing,
            role: profile.effectiveRole,
            permissions: profile.permissions,
            accessFlags: profile.flags,
          });
        }
      }
    } catch (err: unknown) {
      toast.error(readApiErrorMessage(err, "Failed to update user roles"));
    } finally {
      setSavingAssignments(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[320px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-slate-600">Loading permission matrix...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Permission Matrix</h1>
          <p className="text-slate-600 mt-2">
            Manage dynamic role permissions and user-role assignments for all sections.
          </p>
        </div>
        <Button
          onClick={saveAllChangedRoles}
          disabled={savingAll || dirtyRoleIds.length === 0}
          className="sm:self-start"
        >
          {savingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save All Changes ({dirtyRoleIds.length})
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="pt-6 text-sm text-red-600">{error}</CardContent>
        </Card>
      ) : null}



      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Sidebar Section Matrix</h2>
          </div>
          <p className="text-sm text-slate-600">
            Quick visibility map showing which roles can access each sidebar section.
          </p>
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Section</TableHead>
                  {roles.map((role) => (
                    <TableHead key={`section-role-${role.id}`} className="min-w-[160px]">
                      <div className="flex flex-col gap-1">
                        <span>{role.name}</span>
                        {!role.isActive ? <Badge variant="secondary">Inactive</Badge> : null}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {SECTION_PERMISSION_MATRIX.map((section) => (
                  <TableRow key={section.id}>
                    <TableCell className="font-medium">{section.label}</TableCell>
                    {roles.map((role) => {
                      const rolePermissionKeys = permissionDraft[role.id] || [];
                      const allowed = hasAnyPermission(rolePermissionKeys, section.permissionKeys);
                      return (
                        <TableCell key={`${section.id}-${role.id}`}>
                          <Badge
                            variant={allowed ? "default" : "secondary"}
                            className={allowed ? "" : "bg-slate-100 text-slate-600"}
                          >
                            {allowed ? "Allowed" : "Blocked"}
                          </Badge>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Role-Permission Matrix</h2>
            <Button variant="outline" onClick={loadData}>
              Refresh
            </Button>
          </div>
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[280px]">Permission</TableHead>
                  {roles.map((role) => (
                    <TableHead key={`permission-role-${role.id}`} className="min-w-[170px]">
                      <div className="space-y-1">
                        <div className="font-medium">{role.name}</div>
                        <div className="text-xs text-slate-500">
                          {(permissionDraft[role.id] || []).length} permissions
                        </div>
                        <div className="flex items-center gap-2">
                          {!role.isActive ? <Badge variant="secondary">Inactive</Badge> : null}
                          {dirtyRoleIds.includes(role.id) ? (
                            <Badge variant="outline" className="text-amber-700 border-amber-300">
                              Unsaved
                            </Badge>
                          ) : null}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => saveRolePermissions(role.id)}
                          disabled={savingRoleId === role.id || !dirtyRoleIds.includes(role.id)}
                        >
                          {savingRoleId === role.id ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : null}
                          Save
                        </Button>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setAllPermissionsForRole(role.id, true)}
                          >
                            Grant All
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setAllPermissionsForRole(role.id, false)}
                          >
                            Revoke All
                          </Button>
                        </div>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedPermissions.map(([moduleName, modulePermissions]) => (
                  <Fragment key={`group-${moduleName}`}>
                    <TableRow key={`module-${moduleName}`} className="bg-slate-50">
                      <TableCell className="font-semibold text-slate-700">
                        {moduleName}
                      </TableCell>
                      {roles.map((role) => (
                        <TableCell key={`module-${moduleName}-role-${role.id}`} />
                      ))}
                    </TableRow>
                    {modulePermissions.map((permission) => (
                      <TableRow key={permission.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-slate-800">{permission.name}</div>
                            <div className="text-xs text-slate-500">{permission.key}</div>
                            {permission.description ? (
                              <div className="text-xs text-slate-500">{permission.description}</div>
                            ) : null}
                          </div>
                        </TableCell>
                        {roles.map((role) => {
                          const checked = (permissionDraft[role.id] || []).includes(
                            normalizePermission(permission.key),
                          );
                          return (
                            <TableCell key={`${permission.id}-${role.id}`}>
                              <label className="inline-flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-blue-600"
                                  checked={checked}
                                  onChange={(event) =>
                                    toggleRolePermission(role.id, permission.key, event.target.checked)
                                  }
                                />
                                <span>{checked ? "Yes" : "No"}</span>
                              </label>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <UserRoundCog className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">User Role Assignment</h2>
          </div>
          <p className="text-sm text-slate-600">
            Assign one or more roles to a user. Effective sidebar/module access updates from assigned roles.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select user</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={selectedUserId}
                onChange={async (event) => {
                  const nextUserId = event.target.value;
                  setSelectedUserId(nextUserId);
                  await loadUserAssignments(nextUserId);
                }}
              >
                <option value="">Select user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={saveUserRoleAssignments}
                disabled={!selectedUserId || savingAssignments}
              >
                {savingAssignments ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save User Roles
              </Button>
            </div>
          </div>

          {loadingAssignments ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading role assignments...
            </div>
          ) : selectedUserId ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {roles.map((role) => {
                const checked = selectedUserRoleIds.includes(role.id);
                return (
                  <label
                    key={`assign-role-${role.id}`}
                    className="border rounded-md p-3 flex items-start gap-3 cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-blue-600"
                      checked={checked}
                      onChange={(event) => toggleUserRole(role.id, event.target.checked)}
                    />
                    <div className="space-y-1">
                      <div className="font-medium text-sm">{role.name}</div>
                      <div className="text-xs text-slate-500">
                        {role.department?.name || "Department"} | {(permissionDraft[role.id] || []).length} permissions
                      </div>
                      <div className="flex items-center gap-2">
                        {role.legacyRole ? (
                          <Badge variant="outline" className="text-xs">
                            {role.legacyRole}
                          </Badge>
                        ) : null}
                        {!role.isActive ? (
                          <Badge variant="secondary" className="text-xs">
                            Inactive
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-slate-500">Select a user to manage role assignments.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
