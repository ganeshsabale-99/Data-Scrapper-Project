import React, { useState } from "react";
import { useQuery, type QueryFunctionContext } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    Activity,
    MapPin,
    MessageSquare,
    Phone,
    RefreshCw,
    UserPlus,
    Edit3,
    CheckCircle,
    ExternalLink
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { axiosInstance as api } from "@/config/axios";

type ActivityLog = {
    id: string;
    action: string;
    summary: string;
    createdAt: string;
    performedByName: string;
    performedByRole: string;
    changedFields?: Record<string, { from: unknown; to: unknown }> | null;
    meta?: {
        location?: {
            lat: number;
            lng: number;
            accuracy: number;
        };
        contactMethod?: string;
    } | null;
};

type ActivityResponse = {
    data: ActivityLog[];
    nextCursor?: string;
};

interface ActivityTimelineProps {
    techParkId: string;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
    CREATE: <UserPlus className="h-4 w-4 text-primary" />,
    UPDATE: <Edit3 className="h-4 w-4 text-orange-500" />,
    STATUS_CHANGE: <RefreshCw className="h-4 w-4 text-blue-500" />,
    VISIT: <MapPin className="h-4 w-4 text-green-500" />,
    CONTACTED: <Phone className="h-4 w-4 text-purple-500" />,
    NOTE: <MessageSquare className="h-4 w-4 text-slate-500" />,
    VERIFY: <CheckCircle className="h-4 w-4 text-emerald-500" />,
};

const ACTION_COLORS: Record<string, string> = {
    CREATE: "bg-primary/10 border-primary/20",
    UPDATE: "bg-orange-50 border-orange-200",
    STATUS_CHANGE: "bg-blue-50 border-blue-200",
    VISIT: "bg-green-50 border-green-200",
    CONTACTED: "bg-purple-50 border-purple-200",
    NOTE: "bg-slate-50 border-slate-200",
    VERIFY: "bg-emerald-50 border-emerald-200",
};

export function ActivityTimeline({ techParkId }: ActivityTimelineProps) {
    const [cursor, setCursor] = useState<string | undefined>(undefined);
    const [filter, setFilter] = useState<string>("ALL");
    type ActivityQueryKey = readonly ["techParkActivity", string, string | undefined];
    const queryKey: ActivityQueryKey = ["techParkActivity", techParkId, cursor];

    const fetchActivities = async ({
        queryKey,
    }: QueryFunctionContext<ActivityQueryKey>) => {
        const [_key, techParkId, cursor] = queryKey;
        const searchParams = new URLSearchParams();
        if (cursor) searchParams.set("cursor", cursor);
        searchParams.set("limit", "20");

        // In a real app we might filter on the server, 
        // but for now we'll fetch general and filter client side if needed.
        const url = `/new-techparks/${techParkId}/activity?${searchParams.toString()}`;
        const response = await api.get(url);
        return response.data;
    };

    const { data, isLoading, isError } = useQuery<ActivityResponse, Error, ActivityResponse, ActivityQueryKey>({
        queryKey,
        queryFn: fetchActivities,
    });

    const getGoogleMapsLink = (lat: number, lng: number) => {
        return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    };

    const renderDiff = (changedFields: Record<string, { from: unknown; to: unknown }>) => {
        if (!changedFields || Object.keys(changedFields).length === 0) return null;

        return (
            <div className="mt-2 text-xs bg-slate-50 p-2 rounded border border-slate-100 grid gap-1">
                {Object.entries(changedFields).map(([field, changes]) => (
                    <div key={field} className="flex gap-2">
                        <span className="font-medium text-slate-600 capitalize">{field.replace(/_/g, ' ')}:</span>
                        <span className="text-red-500 line-through truncate max-w-[100px]" title={String(changes.from)}>
                            {changes.from === null || changes.from === "" ? "empty" : String(changes.from)}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="text-green-600 truncate max-w-[100px]" title={String(changes.to)}>
                            {changes.to === null || changes.to === "" ? "empty" : String(changes.to)}
                        </span>
                    </div>
                ))}
            </div>
        );
    };

    if (isLoading && !data) {
        return <div className="p-8 text-center text-slate-500">Loading timeline...</div>;
    }

    if (isError) {
        return <div className="p-8 text-center text-red-500">Failed to load activity log.</div>;
    }

    const logs: ActivityLog[] = data?.data || [];
    const nextCursor = data?.nextCursor;

    const filteredLogs = filter === "ALL"
        ? logs
        : logs.filter((log) => log.action === filter);

    return (
        <div className="space-y-4">
            <div className="flex gap-2 pb-2 overflow-x-auto">
                <Badge
                    variant={filter === "ALL" ? "default" : "outline"}
                    className="cursor-pointer whitespace-nowrap"
                    onClick={() => setFilter("ALL")}
                >
                    All Activity
                </Badge>
                <Badge
                    variant={filter === "VISIT" ? "default" : "outline"}
                    className="cursor-pointer whitespace-nowrap"
                    onClick={() => setFilter("VISIT")}
                >
                    Visits
                </Badge>
                <Badge
                    variant={filter === "CONTACTED" ? "default" : "outline"}
                    className="cursor-pointer whitespace-nowrap"
                    onClick={() => setFilter("CONTACTED")}
                >
                    Contact Logs
                </Badge>
                <Badge
                    variant={filter === "UPDATE" ? "default" : "outline"}
                    className="cursor-pointer whitespace-nowrap"
                    onClick={() => setFilter("UPDATE")}
                >
                    Edits
                </Badge>
                <Badge
                    variant={filter === "STATUS_CHANGE" ? "default" : "outline"}
                    className="cursor-pointer whitespace-nowrap"
                    onClick={() => setFilter("STATUS_CHANGE")}
                >
                    Status
                </Badge>
            </div>

            <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">

                    {filteredLogs.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <Activity className="mx-auto h-8 w-8 opacity-20 mb-2" />
                            <p>No activity found.</p>
                        </div>
                    ) : (
                        filteredLogs.map((log) => (
                            <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">

                                {/* Timeline Icon */}
                                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 bg-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 ${ACTION_COLORS[log.action] || 'border-slate-200'}`}>
                                    {ACTION_ICONS[log.action] || <Activity className="h-4 w-4 text-slate-500" />}
                                </div>

                                {/* Card */}
                                <Card className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] hover:shadow-md transition-shadow">
                                    <CardContent className="p-4 space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <Badge variant="secondary" className="mb-1 text-[10px] font-semibold tracking-wider">
                                                    {log.action}
                                                </Badge>
                                                <p className="text-sm font-medium text-slate-900">{log.summary}</p>
                                            </div>
                                            <time className="text-xs text-slate-500 shrink-0">
                                                {format(new Date(log.createdAt), "MMM d, yyyy h:mm a")}
                                            </time>
                                        </div>

                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <span className="font-medium text-slate-700">{log.performedByName}</span>
                                            <span className="opacity-50">•</span>
                                            <span>{log.performedByRole}</span>
                                        </div>

                                        {/* Diff UI */}
                                        {log.changedFields && renderDiff(log.changedFields)}

                                        {/* Metadata (Location, etc) */}
                                        {log.meta && (
                                            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-3 text-xs">
                                                {log.meta.contactMethod && (
                                                    <div className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                                        <Phone className="h-3 w-3" />
                                                        {log.meta.contactMethod}
                                                    </div>
                                                )}
                                                {log.meta.location && (
                                                    <a
                                                        href={getGoogleMapsLink(log.meta.location.lat, log.meta.location.lng)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1 text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
                                                    >
                                                        <MapPin className="h-3 w-3" />
                                                        View Location
                                                        <ExternalLink className="h-3 w-3 opacity-50 ml-1" />
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                            </div>
                        ))
                    )}

                    {nextCursor && (
                        <div className="text-center pt-4">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCursor(nextCursor)}
                                disabled={isLoading}
                            >
                                Load Older Activity
                            </Button>
                        </div>
                    )}

                </div>
            </ScrollArea>
        </div>
    );
}
