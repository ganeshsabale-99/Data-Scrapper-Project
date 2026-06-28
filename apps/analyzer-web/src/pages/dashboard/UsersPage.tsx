import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRoleAccess } from "@/hooks/use-role-access";
import { approveAdminUser, fetchAdminUsers, rejectAdminUser, type AdminUserDto, type UpdateAdminUserPayload } from "@/services/usersService";
import { SearchInput } from "@/components/ui/search-input";
import { Pagination } from "@/components/pagination/Pagination";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, Edit, Trash, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { deleteAdminUser, updateAdminUser } from "@/services/usersService";
import { addCustomLocationOption } from "@/services/locationCatalogService";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { EditUserDialog } from "@/components/users/EditUserDialog";
import { ViewUserDialog } from "@/components/users/ViewUserDialog";
import { UserManagementNav } from "@/components/users/UserManagementNav";


//

const DB_ERROR_MESSAGE =
  "Users are temporarily unavailable because the database is not reachable. Please try again in a few minutes.";

const PRISMA_LEAK_PATTERNS = [
  /can't reach database server/i,
  /invalid `.*` invocation/i,
  /prisma client request/i,
  /prismainstance\./i,
];

const toFriendlyUsersError = (error: unknown): string => {
  const responseData =
    typeof error === "object" && error !== null
      ? (error as { response?: { data?: { message?: unknown; error?: unknown; code?: unknown } } }).response?.data
      : undefined;

  const code = typeof responseData?.code === "string" ? responseData.code : "";
  const messageFromResponse =
    typeof responseData?.message === "string"
      ? responseData.message
      : typeof responseData?.error === "string"
        ? responseData.error
        : "";

  const fallbackMessage =
    typeof error === "object" && error !== null && "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? ((error as { message: string }).message || "")
      : "";

  const message = messageFromResponse || fallbackMessage;

  if (code === "DB_UNAVAILABLE") return DB_ERROR_MESSAGE;
  if (PRISMA_LEAK_PATTERNS.some((pattern) => pattern.test(message))) return DB_ERROR_MESSAGE;

  return message || "Failed to load users";
};

const isEmailBackedPhone = (value?: string | null) =>
  Boolean(value && value.toLowerCase().startsWith("mail:"));

const getDisplayPhone = (value?: string | null) => {
  const normalized = (value || "").trim();
  if (!normalized || isEmailBackedPhone(normalized)) return "";
  return normalized;
};

export default function UsersPage() {
  useRoleAccess();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING">("ALL");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AdminUserDto | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<AdminUserDto | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [userToView, setUserToView] = useState<AdminUserDto | null>(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    fetchAdminUsers(page, pageSize, statusFilter === "PENDING" ? "ADMIN_APPROVAL_PENDING" : undefined)
      .then((res) => {
        if (ignore) return;
        setUsers(res.data);
        setTotalItems(res.pagination.totalItems);
        setTotalPages(res.pagination.totalPages);
      })
      .catch((e) => {
        if (ignore) return;
        setError(toFriendlyUsersError(e));
      })
      .finally(() => {
        if (ignore) return;
        setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [page, pageSize, statusFilter]);

  // Role breakdown for quick stats
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach((u) => {
      const roleLabel = (u.roleName || u.role || "UNKNOWN").toUpperCase();
      counts[roleLabel] = (counts[roleLabel] || 0) + 1;
    });
    return counts;
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const q = searchTerm.toLowerCase();
    return users.filter((u) => {
      return (
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.phoneNumber || "").toLowerCase().includes(q) ||
        (u.role || "").toLowerCase().includes(q) ||
        (u.roleName || "").toLowerCase().includes(q) ||
        (u.requestedRole || "").toLowerCase().includes(q) ||
        (u.requestedRoleName || "").toLowerCase().includes(q) ||
        (u.city || "").toLowerCase().includes(q) ||
        (u.state || "").toLowerCase().includes(q)
      );
    });
  }, [users, searchTerm]);

  const rowOffset = (page - 1) * pageSize;

  const resolveUserStatus = (user: AdminUserDto) => {
    const status = (user.status || "").toUpperCase();
    if (status && status !== "ACTIVE") return status;
    return user.isActive ? "ACTIVE" : "INACTIVE";
  };

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300";
      case "ADMIN_APPROVAL_PENDING":
        return "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300";
      case "INACTIVE":
      case "REJECTED":
        return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
      default:
        return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-slate-600 dark:text-slate-400">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <UserManagementNav />
      {/* Header */}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Users</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Manage access and view team members</p>
        </div>
        <div className="w-full sm:w-80">
          <SearchInput placeholder="Search users..." value={searchTerm} onChange={setSearchTerm} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={statusFilter === "ALL" ? "default" : "outline"}
          onClick={() => {
            setStatusFilter("ALL");
            setPage(1);
          }}
        >
          All Users
        </Button>
        <Button
          variant={statusFilter === "PENDING" ? "default" : "outline"}
          onClick={() => {
            setStatusFilter("PENDING");
            setPage(1);
          }}
        >
          Pending Approval
        </Button>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
        <span>
          Total Users: <span className="font-semibold text-slate-900 dark:text-slate-100">{totalItems}</span>
        </span>
        {Object.entries(roleCounts).map(([role, count]) => (
          <span key={role} className="inline-flex items-center gap-2">
            <Badge variant="secondary" className="uppercase">{role.replace("_", " ")}</Badge>
            <span className="font-medium text-slate-900 dark:text-slate-100">{count}</span>
          </span>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {error ? (
            <div className="text-red-600 text-sm">{error}</div>
          ) : null}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-right">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact details</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Applied Position</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u, index) => {
                  const effectiveStatus = resolveUserStatus(u);
                  const displayPhone = getDisplayPhone(u.phoneNumber);
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="text-right text-muted-foreground">
                        {u.serialNumber || rowOffset + index + 1}
                      </TableCell>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <div>
                            {displayPhone ? (
                              <a href={`tel:${displayPhone}`} className="text-slate-700 dark:text-slate-300 hover:underline">
                                {displayPhone}
                              </a>
                            ) : (
                              "-"
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {u.email || "-"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="uppercase tracking-wide">
                          {(u.roleName || u.role || "").replaceAll("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="uppercase tracking-wide">
                          {(u.requestedRoleName || u.requestedRole || u.roleName || u.role || "").replaceAll("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass(effectiveStatus)}`}>
                          {effectiveStatus.replaceAll("_", " ")}
                        </span>
                      </TableCell>
                      <TableCell>{u.city || "-"}</TableCell>
                      <TableCell>{u.state || "-"}</TableCell>
                      <TableCell className="text-center">
                        <TooltipProvider>
                          <div className="flex items-center justify-center gap-2">
                            {u.status === "ADMIN_APPROVAL_PENDING" ? (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label="Approve user"
                                      onClick={async () => {
                                        try {
                                          setActionId(u.id);
                                          const res = await approveAdminUser(u.id);
                                          const updated = res.data;
                                          setUsers((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
                                          toast.success("User approved");
                                        } catch (e: unknown) {
                                          toast.error(toFriendlyUsersError(e));
                                        } finally {
                                          setActionId(null);
                                        }
                                      }}
                                      disabled={actionId === u.id}
                                    >
                                      <Check className="w-4 h-4 text-emerald-600" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Approve</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label="Reject user"
                                      onClick={async () => {
                                        const reason = window.prompt("Reason for rejection (optional):") || undefined;
                                        try {
                                          setActionId(u.id);
                                          const res = await rejectAdminUser(u.id, reason);
                                          const updated = res.data;
                                          setUsers((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
                                          toast.success("User rejected");
                                        } catch (e: unknown) {
                                          toast.error(toFriendlyUsersError(e));
                                        } finally {
                                          setActionId(null);
                                        }
                                      }}
                                      disabled={actionId === u.id}
                                    >
                                      <X className="w-4 h-4 text-red-600" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Reject</TooltipContent>
                                </Tooltip>
                              </>
                            ) : null}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="View user"
                                  onClick={() => {
                                    setUserToView(u);
                                    setIsViewDialogOpen(true);
                                  }}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Edit user"
                                  onClick={() => {
                                    setUserToEdit(u);
                                    setIsEditDialogOpen(true);
                                  }}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Delete user"
                                  className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  onClick={() => {
                                    setUserToDelete(u);
                                    setIsDeleteDialogOpen(true);
                                  }}
                                  disabled={deletingId === u.id}
                                >
                                  <Trash className="w-4 h-4 text-red-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        </CardContent>
      </Card>
      {/* Edit User Dialog */}
      <EditUserDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        user={userToEdit}
        isSubmitting={isSavingEdit}
        onSubmit={async (data) => {
          if (!userToEdit) return;
          try {
            setIsSavingEdit(true);
            const payload: UpdateAdminUserPayload = {
              ...data,
              roleId: data.roleId ?? undefined,
            };
            const res = await updateAdminUser(userToEdit.id, payload);
            const updated = res.data;
            setUsers((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
            addCustomLocationOption(updated.state, updated.city);
            queryClient.invalidateQueries({ queryKey: ["city-catalog", "options"] });
            toast.success("User updated");
            setIsEditDialogOpen(false);
          } catch (e: unknown) {
            toast.error(toFriendlyUsersError(e));
          } finally {
            setIsSavingEdit(false);
          }
        }}
      />

      {/* View User Dialog */}
      <ViewUserDialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen} user={userToView} />

      {/* Delete Confirmation Modal (same style as company) */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="min-h-[240px] sm:min-h-[260px] p-6 sm:p-8">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight">Are you sure want to delete</h3>
            <p className="text-muted-foreground text-sm sm:text-base max-w-md">
              This action will permanently remove the selected user and cannot be undone.
            </p>
            <div className="mt-2">
              <span className="inline-block px-4 py-2 rounded-md bg-destructive/10 text-destructive font-bold text-xl sm:text-2xl">
                {userToDelete?.name || 'this user'}
              </span>
            </div>
          </div>
          <div className="mt-6 flex w-full items-center justify-center gap-3 sm:gap-4">
            <Button
              variant="outline"
              onClick={() => {
                if (!deletingId) setIsDeleteDialogOpen(false);
              }}
              disabled={!!deletingId}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!userToDelete) return;
                try {
                  setDeletingId(userToDelete.id);
                  await deleteAdminUser(userToDelete.id);
                  toast.success("User deleted");
                  setUsers((prev) => prev.filter((x) => x.id !== userToDelete.id));
                  setTotalItems((t) => Math.max(0, t - 1));
                  setIsDeleteDialogOpen(false);
                } catch (e: unknown) {
                  toast.error(toFriendlyUsersError(e));
                } finally {
                  setDeletingId(null);
                }
              }}
              disabled={!!deletingId}
            >
              {deletingId ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
