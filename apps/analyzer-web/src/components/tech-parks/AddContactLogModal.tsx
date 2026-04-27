import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Navigation, HeadphonesIcon } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { axiosInstance as api } from "@/config/axios";

interface AddContactLogModalProps {
    techParkId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type ContactMethod = "PHONE" | "EMAIL" | "WHATSAPP" | "MEETING" | "OTHER";
type ContactLogPayload = {
    notes: string;
    type: ContactMethod;
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

export function AddContactLogModal({ techParkId, open, onOpenChange }: AddContactLogModalProps) {
    const queryClient = useQueryClient();
    const [summary, setSummary] = useState("");
    const [contactMethod, setContactMethod] = useState<ContactMethod>("PHONE");
    const [isLocating, setIsLocating] = useState(false);
    const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);

    const contactMutation = useMutation({
        mutationFn: async (payload: ContactLogPayload) => {
            const response = await api.post(`/new-techparks/${techParkId}/contact-logs`, payload);
            return response.data;
        },
        onSuccess: () => {
            toast.success("Contact logged successfully!");
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
                "Failed to log contact";
            toast.error(apiError);
        },
    });

    const resetForm = () => {
        setSummary("");
        setContactMethod("PHONE");
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
            toast.error("Please provide a summary of the contact");
            return;
        }

        const payload: ContactLogPayload = {
            notes: summary.trim(),
            type: contactMethod,
        };
        if (location) payload.location = location;

        contactMutation.mutate(payload);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <HeadphonesIcon className="h-5 w-5 text-primary" />
                        Log Contact Interaction
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="method" className="text-slate-600">
                            Contact Method
                        </Label>
                        <Select value={contactMethod} onValueChange={(value) => setContactMethod(value as ContactMethod)}>
                            <SelectTrigger id="method">
                                <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="PHONE">Phone Call</SelectItem>
                                <SelectItem value="EMAIL">Email</SelectItem>
                                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                                <SelectItem value="MEETING">In-Person Meeting</SelectItem>
                                <SelectItem value="OTHER">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="summary" className="text-slate-600">
                            Interaction Details <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                            id="summary"
                            placeholder="What was discussed?"
                            className="resize-none h-24"
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                            required
                        />
                    </div>

                    <div className="pt-2">
                        <Label className="text-slate-600 mb-2 block flex items-center gap-2">
                            Attach Location <span className="text-xs font-normal text-slate-400">(Optional)</span>
                        </Label>
                        {location ? (
                            <div className="flex items-center justify-between bg-green-50 border border-green-100 p-3 rounded-md text-sm text-green-700">
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4" />
                                    <span>Location attached</span>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-1 text-red-600 hover:text-red-700 hover:bg-red-50 ml-2"
                                    onClick={() => setLocation(null)}
                                >
                                    Remove
                                </Button>
                            </div>
                        ) : (
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full relative bg-slate-50 hover:bg-slate-100 text-slate-600 border-dashed"
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
                                        <Navigation className="h-4 w-4 opacity-50" />
                                        Share Location (e.g. if contacting on-site)
                                    </span>
                                )}
                            </Button>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t mt-6">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={contactMutation.isPending || isLocating}>
                            {contactMutation.isPending ? "Saving..." : "Save Log"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
