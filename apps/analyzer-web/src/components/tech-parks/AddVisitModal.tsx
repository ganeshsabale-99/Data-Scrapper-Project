import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Navigation, CalendarDays, UserSquare2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { axiosInstance as api } from "@/config/axios";

interface AddVisitModalProps {
    techParkId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type VisitPayload = {
    outcome: string;
    notes?: string;
    location?: { lat: number; lng: number; accuracy: number };
};
type ApiErrorShape = {
    response?: {
        data?: {
            message?: string;
            error?: string;
        };
    };
    message?: string;
};

export function AddVisitModal({ techParkId, open, onOpenChange }: AddVisitModalProps) {
    const queryClient = useQueryClient();
    const [summary, setSummary] = useState("");
    const [spocName, setSpocName] = useState("");
    const [isLocating, setIsLocating] = useState(false);
    const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);

    const visitMutation = useMutation({
        mutationFn: async (payload: VisitPayload) => {
            const response = await api.post(`/new-techparks/${techParkId}/visits`, payload);
            return response.data;
        },
        onSuccess: () => {
            toast.success("Visit logged successfully!");
            queryClient.invalidateQueries({ queryKey: ["techParkActivity", techParkId] });
            onOpenChange(false);
            resetForm();
        },
        onError: (error: unknown) => {
            const parsedError = error as ApiErrorShape;
            const apiError =
                parsedError.response?.data?.message ||
                parsedError.response?.data?.error ||
                parsedError.message ||
                "Failed to log visit";
            toast.error(apiError);
        },
    });

    const resetForm = () => {
        setSummary("");
        setSpocName("");
        setLocation(null);
    };

    const handleFetchLocation = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser");
            return;
        }

        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                });
                setIsLocating(false);
                toast.success("Location captured successfully");
            },
            (error) => {
                setIsLocating(false);
                toast.error(`Failed to get location: ${error.message}`);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!summary.trim()) {
            toast.error("Please provide a summary of your visit");
            return;
        }

        const payload: VisitPayload = { outcome: summary.trim() };
        if (spocName.trim()) payload.notes = spocName.trim();
        if (location) payload.location = location;

        visitMutation.mutate(payload);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-primary" />
                        Log Site Visit
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="spoc" className="text-slate-600">
                            Person Met (Optional)
                        </Label>
                        <div className="relative">
                            <UserSquare2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            <Input
                                id="spoc"
                                placeholder="Name of the SPOC"
                                className="pl-9"
                                value={spocName}
                                onChange={(e) => setSpocName(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="summary" className="text-slate-600">
                            Visit Notes <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                            id="summary"
                            placeholder="What was discussed or observed during the visit?"
                            className="resize-none h-24"
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                            required
                        />
                    </div>

                    <div className="pt-2">
                        <Label className="text-slate-600 mb-2 block">
                            Location Verification
                        </Label>
                        {location ? (
                            <div className="flex items-center justify-between bg-green-50 border border-green-100 p-3 rounded-md text-sm text-green-700">
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4" />
                                    <span>Verified location attached</span>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-1 text-green-700 hover:text-green-800 hover:bg-green-100"
                                    onClick={handleFetchLocation}
                                >
                                    Retake
                                </Button>
                            </div>
                        ) : (
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full relative bg-slate-50 hover:bg-slate-100 text-slate-600"
                                onClick={handleFetchLocation}
                                disabled={isLocating}
                            >
                                {isLocating ? (
                                    <span className="flex items-center gap-2">
                                        <span className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-transparent" />
                                        Locating...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <Navigation className="h-4 w-4" />
                                        Capture Current GPS Location
                                    </span>
                                )}
                            </Button>
                        )}
                        <p className="text-xs text-slate-400 mt-2">
                            Including GPS location verifies your on-site presence. You must allow location access in your browser.
                        </p>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t mt-6">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={visitMutation.isPending || isLocating}>
                            {visitMutation.isPending ? "Saving..." : "Save Visit Log"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
