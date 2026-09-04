import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Key, XCircle, Copy, CheckCircle2, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { axiosInstance } from "@/config/axios";

type ApiErrorShape = {
    response?: { data?: { message?: string; error?: string } };
    message?: string;
};

const readApiErrorMessage = (error: unknown, fallback: string): string => {
    const e = error as ApiErrorShape;
    return e?.response?.data?.message || e?.response?.data?.error || e?.message || fallback;
};

interface ApiKey {
    id: string;
    keyId: string;
    isActive: boolean;
    expiresAt: string | null;
    lastUsedAt: string | null;
    revokedAt: string | null;
    createdAt: string;
}

interface Client {
    id: string;
    name: string;
    isActive: boolean;
    keys: ApiKey[];
    createdAt: string;
}

const ExternalApiPage = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [newClientName, setNewClientName] = useState("");
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);
    const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
    const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
    const [apiKeyToRevoke, setApiKeyToRevoke] = useState<string | null>(null);
    const [selectedScopes, setSelectedScopes] = useState<string[]>(["techpark:national:read"]);
    const [isDeleteClientModalOpen, setIsDeleteClientModalOpen] = useState(false);
    const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

    const AVAILABLE_SCOPES = [
        { id: "techpark:national:read", label: "Read Tech Parks" },
        { id: "techpark:national:write", label: "Write National Data" },
        { id: "techpark:state:read", label: "Read State Data" },
        { id: "techpark:city:read", label: "Read City Data" },
        { id: "techpark:companies:read", label: "Read Tech Park Companies" },
        { id: "coworking:national:read", label: "Read Coworking Spaces" },
        { id: "coworking:companies:read", label: "Read Coworking Companies" },
        { id: "mall:national:read", label: "Read Malls" },
        { id: "hospital:national:read", label: "Read Hospitals" },
        { id: "stadium:national:read", label: "Read Stadiums" },
        { id: "airport:national:read", label: "Read Airports" },
        { id: "leads:read", label: "Read Leads" },
    ];

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get("/admin/external/clients");
            const res = response.data;
            if (res.success) {
                setClients(res.data);
            } else {
                toast.error(res.message || "Failed to load clients");
            }
        } catch (error) {
            toast.error(readApiErrorMessage(error, "Error connecting to server"));
        } finally {
            setLoading(false);
        }
    };

    const handleCreateClient = async () => {
        if (!newClientName) return;
        try {
            const response = await axiosInstance.post("/admin/external/clients", { name: newClientName });
            const res = response.data;
            if (res.success) {
                toast.success("Client created successfully");
                setNewClientName("");
                setIsClientModalOpen(false);
                fetchClients();
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error(readApiErrorMessage(error, "Error creating client"));
        }
    };

    const handleDeleteClient = async () => {
        if (!clientToDelete) return;
        try {
            const response = await axiosInstance.delete(`/admin/external/clients/${clientToDelete.id}`);
            const res = response.data;
            if (res.success) {
                toast.success("Partner deleted successfully");
                setIsDeleteClientModalOpen(false);
                setClientToDelete(null);
                fetchClients();
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error(readApiErrorMessage(error, "Error deleting partner"));
        }
    };

    const handleIssueKey = async () => {
        if (!selectedClient) return;
        try {
            const response = await axiosInstance.post("/admin/external/keys", {
                clientId: selectedClient.id,
                name: `Key for ${selectedClient.name}`,
                scopes: selectedScopes,
            });
            const res = response.data;
            if (res.success) {
                setGeneratedKey(res.data.rawKey);
                fetchClients();
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error(readApiErrorMessage(error, "Error issuing key"));
        }
    };

    const handleRevokeKey = (keyId: string) => {
        setApiKeyToRevoke(keyId);
        setIsRevokeModalOpen(true);
    };

    const confirmRevokeKey = async () => {
        if (!apiKeyToRevoke) return;
        try {
            const response = await axiosInstance.post(`/admin/external/keys/${apiKeyToRevoke}/revoke`);
            const res = response.data;
            if (res.success) {
                toast.success("Key revoked successfully");
                fetchClients();
                setIsRevokeModalOpen(false);
                setApiKeyToRevoke(null);
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error(readApiErrorMessage(error, "Error revoking key"));
        }
    };

    const toggleExpand = (clientId: string) => {
        const newExpanded = new Set(expandedClients);
        if (newExpanded.has(clientId)) {
            newExpanded.delete(clientId);
        } else {
            newExpanded.add(clientId);
        }
        setExpandedClients(newExpanded);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    const toggleScope = (scopeId: string) => {
        setSelectedScopes(prev =>
            prev.includes(scopeId)
                ? prev.filter(s => s !== scopeId)
                : [...prev, scopeId]
        );
    };

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">API Management</h1>
                    <p className="text-slate-500">Manage external partners and their API keys.</p>
                </div>
                <Button onClick={() => setIsClientModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Partner
                </Button>
            </div>

            {loading && clients.length === 0 ? (
                <div className="flex justify-center p-12">
                    <p>Loading partners...</p>
                </div>
            ) : clients.length === 0 ? (
                <div className="text-center p-12 border rounded-lg bg-slate-50">
                    <Key className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                    <h3 className="text-lg font-medium">No partners found</h3>
                    <p className="text-slate-500 mb-4">Add your first partner to start issuing API keys.</p>
                    <Button onClick={() => setIsClientModalOpen(true)} variant="outline">
                        Create Partner
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {clients.map((client) => (
                        <div key={client.id} className="border rounded-lg bg-white overflow-hidden shadow-sm">
                            <div
                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                                onClick={() => toggleExpand(client.id)}
                            >
                                <div className="flex items-center gap-3">
                                    {expandedClients.has(client.id) ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                                    <div>
                                        <h3 className="font-semibold text-lg">{client.name}</h3>
                                        <p className="text-xs text-slate-500">
                                            ID: {client.id} • Created: {new Date(client.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                        title="Delete Partner"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setClientToDelete(client);
                                            setIsDeleteClientModalOpen(true);
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                    <div className="text-right px-2 min-w-[100px]">
                                        <p className="text-sm font-medium">{client.keys.filter(k => k.isActive).length} Active Keys</p>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedClient(client);
                                            setIsKeyModalOpen(true);
                                            setGeneratedKey(null);
                                            setSelectedScopes(["techpark:national:read"]);
                                        }}
                                    >
                                        <Key className="mr-2 h-3.5 w-3.5" />
                                        Issue Key
                                    </Button>
                                </div>
                            </div>

                            {expandedClients.has(client.id) && (
                                <div className="p-4 border-t bg-slate-50/50">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Key ID</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Created At</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {client.keys.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center text-slate-500 py-4">
                                                        No keys issued for this partner yet.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                client.keys.map((key) => (
                                                    <TableRow key={key.id}>
                                                        <TableCell className="font-mono text-xs">{key.keyId}</TableCell>
                                                        <TableCell>
                                                            {key.isActive ? (
                                                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                                                    Active
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50">
                                                                    Revoked
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-slate-500 text-sm">
                                                            {new Date(key.createdAt).toLocaleString()}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {key.isActive && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                    onClick={() => handleRevokeKey(key.id)}
                                                                >
                                                                    <XCircle className="h-4 w-4 mr-2" />
                                                                    Revoke
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Create Client Modal */}
            <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Partner</DialogTitle>
                        <DialogDescription>
                            Create a partner client to start issuing API keys.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Partner Name</Label>
                            <Input
                                id="name"
                                placeholder="e.g. CRM Team, Marketing Partner"
                                value={newClientName}
                                onChange={(e) => setNewClientName(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsClientModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateClient} disabled={!newClientName}>Create Partner</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Issue Key Modal */}
            <Dialog open={isKeyModalOpen} onOpenChange={setIsKeyModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Issue API Key for {selectedClient?.name}</DialogTitle>
                        <DialogDescription>
                            {generatedKey
                                ? "COPY THIS KEY NOW. You will never see it again."
                                : "Select scopes and generate a new secure API key."}
                        </DialogDescription>
                    </DialogHeader>

                    {!generatedKey && (
                        <div className="space-y-4 py-4">
                            <Label>Key Scopes</Label>
                            <div className="grid grid-cols-1 gap-2">
                                {AVAILABLE_SCOPES.map(scope => (
                                    <div
                                        key={scope.id}
                                        className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors ${selectedScopes.includes(scope.id)
                                            ? "border-blue-500 bg-blue-50"
                                            : "border-slate-200 hover:bg-slate-50"
                                            }`}
                                        onClick={() => toggleScope(scope.id)}
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">{scope.label}</span>
                                            <span className="text-xs text-slate-500 font-mono">{scope.id}</span>
                                        </div>
                                        {selectedScopes.includes(scope.id) && (
                                            <CheckCircle2 className="h-4 w-4 text-blue-600" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {generatedKey && (
                        <div className="space-y-4 py-4">
                            <div className="bg-slate-900 rounded-lg p-3 relative group">
                                <code className="text-blue-400 break-all text-sm font-mono pr-8">
                                    {generatedKey}
                                </code>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="absolute right-2 top-2 text-slate-400 hover:text-white"
                                    onClick={() => copyToClipboard(generatedKey)}
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-md text-sm">
                                <XCircle className="h-4 w-4 flex-shrink-0" />
                                <p>Once you close this window, you cannot see this key again.</p>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        {!generatedKey ? (
                            <>
                                <Button variant="outline" onClick={() => setIsKeyModalOpen(false)}>Cancel</Button>
                                <Button onClick={handleIssueKey}>Generate Key</Button>
                            </>
                        ) : (
                            <Button className="w-full" onClick={() => setIsKeyModalOpen(false)}>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                I've Saved the Key
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Revoke Confirmation Modal */}
            <Dialog open={isRevokeModalOpen} onOpenChange={setIsRevokeModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Revoke API Key</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to revoke this key? It will no longer work for API requests. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="sm:justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsRevokeModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={confirmRevokeKey}>
                            Revoke Key
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Partner Confirmation Modal */}
            <Dialog open={isDeleteClientModalOpen} onOpenChange={setIsDeleteClientModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete Partner</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete **{clientToDelete?.name}**? This will permanently remove the partner and revoke all associated API keys. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="sm:justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsDeleteClientModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteClient}>
                            Delete Partner
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ExternalApiPage;
