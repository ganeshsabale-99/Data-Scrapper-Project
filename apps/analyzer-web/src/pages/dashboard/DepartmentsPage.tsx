import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Building2, Edit, Trash2 } from "lucide-react";
import { rbacService, type AccessDepartment } from "@/services/rbacService";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type ApiErrorShape = {
    response?: {
        status?: number;
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

export default function DepartmentsPage() {
    const [loading, setLoading] = useState(true);
    const [departments, setDepartments] = useState<AccessDepartment[]>([]);
    const [creating, setCreating] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newDepartmentName, setNewDepartmentName] = useState("");

    const [editingDepartment, setEditingDepartment] = useState<AccessDepartment | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [departmentToDelete, setDepartmentToDelete] = useState<AccessDepartment | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await rbacService.listDepartments();
            setDepartments(data);
        } catch (err: unknown) {
            toast.error(getApiErrorMessage(err, "Failed to load departments"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleCreate = async () => {
        const name = newDepartmentName.trim();
        if (!name) {
            toast.error("Department name is required");
            return;
        }

        try {
            setCreating(true);
            await rbacService.createDepartment({ name });
            toast.success(`Department "${name}" created`);
            setNewDepartmentName("");
            setIsCreateDialogOpen(false);
            loadData();
        } catch (err: unknown) {
            toast.error(getApiErrorMessage(err, "Failed to create department"));
        } finally {
            setCreating(false);
        }
    };

    const submitEdit = async () => {
        if (!editingDepartment) return;
        const name = editingDepartment.name.trim();
        if (!name) {
            toast.error("Department name is required");
            return;
        }

        try {
            setCreating(true);
            await rbacService.updateDepartment(editingDepartment.id, { name });
            toast.success(`Department updated successfully`);
            setIsEditDialogOpen(false);
            loadData();
        } catch (err: unknown) {
            toast.error(getApiErrorMessage(err, "Failed to update department"));
        } finally {
            setCreating(false);
        }
    };

    const confirmDelete = async () => {
        if (!departmentToDelete) return;
        try {
            setDeletingId(departmentToDelete.id);
            await rbacService.deleteDepartment(departmentToDelete.id);
            toast.success("Department deleted successfully");
            setIsDeleteDialogOpen(false);
            setDepartmentToDelete(null);
            loadData();
        } catch (err: unknown) {
            const parsedError = err as ApiErrorShape;
            const msg = parsedError.response?.data?.message || "";
            if (msg.toLowerCase().includes("existing roles") || parsedError.response?.status === 400) {
                toast.error(`"${departmentToDelete.name}" still has roles. Delete all its roles first, then try again.`);
            } else {
                toast.error(msg || "Failed to delete department");
            }
            setIsDeleteDialogOpen(false);
        } finally {
            setDeletingId(null);
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto p-6 flex items-center justify-center min-h-[320px]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <p className="text-slate-600">Loading departments...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Departments</h1>
                    <p className="text-slate-600 mt-2">
                        Manage organizational departments and functional units.
                    </p>
                </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Department
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Department</DialogTitle>
                            <DialogDescription>
                                Add a new department to organize roles and permissions.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. Engineering, Sales, HR"
                                    value={newDepartmentName}
                                    onChange={(e) => setNewDepartmentName(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreate} disabled={creating || !newDepartmentName.trim()}>
                                {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                Create Department
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Department</DialogTitle>
                        <DialogDescription>
                            Update the department details.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-name">Name</Label>
                            <Input
                                id="edit-name"
                                value={editingDepartment?.name || ""}
                                onChange={(e) => setEditingDepartment(prev => prev ? { ...prev, name: e.target.value } : null)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={submitEdit} disabled={creating || !editingDepartment?.name.trim()}>
                            {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Department</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete the department <span className="font-semibold text-foreground">"{departmentToDelete?.name}"</span>? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    {(departmentToDelete?._count?.roles ?? 0) > 0 && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                            <span className="mt-0.5">⚠️</span>
                            <span>This department has <strong>{departmentToDelete?._count?.roles} role{(departmentToDelete?._count?.roles ?? 0) > 1 ? "s" : ""}</strong> attached. You must delete those roles first before deleting this department.</span>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={!!deletingId}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDelete}
                            disabled={!!deletingId || (departmentToDelete?._count?.roles ?? 0) > 0}
                        >
                            {deletingId ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Delete Department
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Organization</TableHead>
                                <TableHead>Roles</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {departments.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={5}
                                        className="h-24 text-center text-slate-500"
                                    >
                                        No departments found. Create one to get started.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                departments.map((dept) => (
                                    <TableRow key={dept.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="w-4 h-4 text-slate-400" />
                                                {dept.name}
                                            </div>
                                        </TableCell>
                                        <TableCell>{dept.organization?.name || "-"}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">
                                                {dept._count?.roles || 0} roles
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={dept.isActive ? "default" : "secondary"}>
                                                {dept.isActive ? "Active" : "Inactive"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => { setEditingDepartment(dept); setIsEditDialogOpen(true); }}>
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => { setDepartmentToDelete(dept); setIsDeleteDialogOpen(true); }} disabled={deletingId === dept.id}>
                                                    {deletingId === dept.id ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <Trash2 className="w-4 h-4 text-red-500" />}
                                                </Button>
                                            </div>
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
