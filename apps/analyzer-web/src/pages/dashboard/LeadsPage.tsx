import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
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

interface Lead {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    companyName: string | null;
    communicationMethod: string | null;
    city: string | null;
    lookingFor: string | null;
    type?: string;
    createdAt: string;
    updatedAt: string;
}

interface Pagination {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

const PAGE_SIZE = 20;

const LeadsPage = () => {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [cityFilter, setCityFilter] = useState("");
    const [lookingForFilter, setLookingForFilter] = useState("");

    const fetchLeads = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get("/admin/leads", {
                params: {
                    page,
                    pageSize: PAGE_SIZE,
                    ...(cityFilter ? { city: cityFilter } : {}),
                    ...(lookingForFilter ? { lookingFor: lookingForFilter } : {}),
                },
            });
            const res = response.data;
            if (res.success) {
                setLeads(res.data);
                setPagination(res.pagination);
            } else {
                toast.error(res.message || "Failed to load leads");
            }
        } catch (error) {
            toast.error(readApiErrorMessage(error, "Error connecting to server"));
        } finally {
            setLoading(false);
        }
    }, [page, cityFilter, lookingForFilter]);

    useEffect(() => {
        fetchLeads();
    }, [fetchLeads]);

    const handleFilterSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
    };

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Trial Leads</h1>
                    <p className="text-slate-500">Leads captured from the 7-day trial form and other lead sources.</p>
                </div>
                <Button variant="outline" onClick={() => fetchLeads()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            <form onSubmit={handleFilterSubmit} className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                    <label className="text-xs text-slate-500">City</label>
                    <Input
                        placeholder="Filter by city"
                        value={cityFilter}
                        onChange={(e) => setCityFilter(e.target.value)}
                        className="w-40"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs text-slate-500">Looking For</label>
                    <Input
                        placeholder="Filter by looking for"
                        value={lookingForFilter}
                        onChange={(e) => setLookingForFilter(e.target.value)}
                        className="w-48"
                    />
                </div>
                <Button type="submit" size="sm">Apply Filters</Button>
            </form>

            {loading && leads.length === 0 ? (
                <div className="flex justify-center p-12">
                    <p>Loading leads...</p>
                </div>
            ) : leads.length === 0 ? (
                <div className="text-center p-12 border rounded-lg bg-slate-50">
                    <UserPlus className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                    <h3 className="text-lg font-medium">No leads found</h3>
                    <p className="text-slate-500">Trial-form submissions will show up here once received.</p>
                </div>
            ) : (
                <div className="border rounded-lg bg-white overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Company</TableHead>
                                <TableHead>City</TableHead>
                                <TableHead>Looking For</TableHead>
                                <TableHead>Contact Via</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Submitted At</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {leads.map((lead) => (
                                <TableRow key={lead.id}>
                                    <TableCell className="font-medium">{lead.name}</TableCell>
                                    <TableCell>{lead.email}</TableCell>
                                    <TableCell>{lead.phone || "-"}</TableCell>
                                    <TableCell>{lead.companyName || "-"}</TableCell>
                                    <TableCell>{lead.city || "-"}</TableCell>
                                    <TableCell>{lead.lookingFor || "-"}</TableCell>
                                    <TableCell>{lead.communicationMethod || "-"}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                                            {lead.type || "TRIAL_7_DAY"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-slate-500 text-sm">
                                        {new Date(lead.createdAt).toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">
                        Page {pagination.page} of {pagination.totalPages} • {pagination.total} total leads
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= pagination.totalPages}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeadsPage;
