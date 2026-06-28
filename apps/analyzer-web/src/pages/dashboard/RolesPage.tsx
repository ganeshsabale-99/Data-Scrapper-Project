import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Shield, Edit, Trash2 } from "lucide-react";
import { rbacService, type AccessRole, type AccessDepartment } from "@/services/rbacService";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserManagementNav } from "@/components/users/UserManagementNav";


type ApiErrorShape = {
    response?: {
        data?: {
            message?: string;
        };
    };
    message?: string;
};

const getApiErrorMessage = (error: unknown, fallback: string): string => {
    const parsedError = error as ApiErrorShape;
    return parsedError.response?.data?.message || parsedError.message || fallback;
};

export default function RolesPage() {
    const [loading, setLoading] = useState(true);
    const [roles, setRoles] = useState<AccessRole[]>([]);
    const [departments, setDepartments] = useState<AccessDepartment[]>([]);
    const [creating, setCreating] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<AccessRole | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [roleToDelete, setRoleToDelete] = useState<AccessRole | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // Form State
    const [newRoleName, setNewRoleName] = useState("");
    const [selectedDepartmentId, setSelectedDepartmentId] = useState("");

    const loadData = async () => {
        try {
            setLoading(true);
            const [rolesData, departmentsData] = await Promise.all([
                rbacService.listRoles({ includeInactive: true }),
                rbacService.listDepartments(),
            ]);
            setRoles(rolesData);
            setDepartments(departmentsData);
        } catch (err: unknown) {
            toast.error(getApiErrorMessage(err, "Failed to load roles"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleCreate = async () => {
        const name = newRoleName.trim();
        if (!name) {
            toast.error("Role name is required");
            return;
        }
        if (!selectedDepartmentId) {
            toast.error("Department is required");
            return;
        }

        try {
            setCreating(true);
            await rbacService.createRole({
                name,
                departmentId: selectedDepartmentId,
                isActive: true,
                permissionKeys: [], // Start with no permissions
            });
            toast.success(`Role "${name}" created`);
            setNewRoleName("");
            setSelectedDepartmentId("");
            setIsCreateDialogOpen(false);
            loadData();
        } catch (err: unknown) {
            toast.error(getApiErrorMessage(err, "Failed to create role"));
        } finally {
            setCreating(false);
        }
    };

    const submitEdit = async () => {
        if (!editingRole) return;
        const name = editingRole.name.trim();
        if (!name) {
            toast.error("Role name is required");
            return;
        }

        try {
            setCreating(true);
            await rbacService.updateRole(editingRole.id, { name });
            toast.success(`Role updated successfully`);
            setIsEditDialogOpen(false);
            loadData();
        } catch (err: unknown) {
            toast.error(getApiErrorMessage(err, "Failed to update role"));
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = (role: AccessRole) => {
        setRoleToDelete(role);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!roleToDelete) return;
        try {
            setDeletingId(roleToDelete.id);
            await rbacService.deleteRole(roleToDelete.id);
            toast.success("Role deleted successfully");
            setIsDeleteDialogOpen(false);
            setRoleToDelete(null);
            loadData();
        } catch (err: unknown) {
            const msg = getApiErrorMessage(err, "Failed to delete role");
            if (msg.toLowerCase().includes("assigned")) {
                toast.error("This role is assigned to users. Unassign all users from this role before deleting.");
            } else {
                toast.error(msg);
            }
        } finally {
            setDeletingId(null);
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto p-6 flex items-center justify-center min-h-[320px]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <p className="text-slate-600">Loading roles...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <UserManagementNav />
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Roles</h1>
                    <p className="text-slate-600 mt-2">
                        Manage system roles and assign them to departments.
                    </p>
                </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Role
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Role</DialogTitle>
                            <DialogDescription>
                                Create a new role and assign it to a department. Define permissions in the Permissions tab.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="department">Department</Label>
                                <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {departments.map((dept) => (
                                            <SelectItem key={dept.id} value={dept.id}>
                                                {dept.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="name">Role Name</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. Senior Manager"
                                    value={newRoleName}
                                    onChange={(e) => setNewRoleName(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreate} disabled={creating || !newRoleName.trim() || !selectedDepartmentId}>
                                {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                Create Role
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Role</DialogTitle>
                        <DialogDescription>
                            Update the role details.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-name">Role Name</Label>
                            <Input
                                id="edit-name"
                                value={editingRole?.name || ""}
                                onChange={(e) => setEditingRole(prev => prev ? { ...prev, name: e.target.value } : null)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={submitEdit} disabled={creating || !editingRole?.name.trim()}>
                            {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Role</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete the role <span className="font-semibold text-foreground">"{roleToDelete?.name}"</span>? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={!!deletingId}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={confirmDelete} disabled={!!deletingId}>
                            {deletingId ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Delete Role
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Role Name</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead>Users</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {roles.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={5}
                                        className="h-24 text-center text-slate-500"
                                    >
                                        No roles found. Create one to get started.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                roles.map((role) => (
                                    <TableRow key={role.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Shield className="w-4 h-4 text-slate-400" />
                                                {role.name}
                                                {role.isSystem && (
                                                    <Badge variant="outline" className="ml-2 text-[10px] uppercase">
                                                        System
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>{role.department?.name || "-"}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">
                                                {role._count?.userAssignments || 0} users
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={role.isActive ? "default" : "secondary"}>
                                                {role.isActive ? "Active" : "Inactive"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {role.isSystem ? (
                                                <Button variant="ghost" size="sm" disabled>
                                                    System Role
                                                </Button>
                                            ) : (
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => { setEditingRole(role); setIsEditDialogOpen(true); }}>
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(role)} disabled={deletingId === role.id}>
                                                        {deletingId === role.id ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <Trash2 className="w-4 h-4 text-red-500" />}
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
