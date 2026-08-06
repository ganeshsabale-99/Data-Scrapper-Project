import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { techParkService } from "@/services/techParkService";
import { toast } from "sonner";
import { getSegmentSingularLabel } from "@/components/dashboard/constants";
import { ContactLogs } from "@/components/contact-logs/ContactLogs";
import type { VenueSegment } from "@/services/genericVenueService";

const GENERIC_VENUE_SEGMENTS: readonly string[] = ["malls", "hospitals", "stadiums", "airports"];
const isVenueSegment = (segment: string): segment is VenueSegment =>
  GENERIC_VENUE_SEGMENTS.includes(segment);

type TechParkFormData = {
  name: string;
  address: string;
  phone: string;
  website?: string;
  map_url?: string;
  rating?: string;
  status?:
  | "NOT_CONTACTED"
  | "CONTACTED"
  | "INTERESTED"
  | "MEETING_SCHEDULED"
  | "PROPOSAL_SENT"
  | "IN_PROGRESS"
  | "CLOSED";

  builder_name?: string;
  security_agency_name?: string;
  property_manager_name?: string;
  property_manager_phone?: string;
  property_manager_email?: string;
  parking_floors?: string;
  total_floors?: string;
  basement_levels?: string;
  spoc_name?: string;
  spoc_phone?: string;
  seating_capacity?: string;
  challenges?: string;
  coordinates?: string;
  exterior_media_url?: string;
  generic_email?: string;
  district?: string;
  pincode?: string;
};

type LocationStatus = NonNullable<TechParkFormData["status"]>;
type LocationDraft = {
  id?: string;
  name?: string;
  address?: string;
  phone?: string;
  website?: string;
  map_url?: string;
  rating?: number | string;
  status?: string;
  builder_name?: string;
  security_agency_name?: string;
  property_manager_name?: string;
  property_manager_phone?: string;
  property_manager_email?: string;
  parking_floors?: number;
  total_floors?: number;
  basement_levels?: number;
  spoc_name?: string;
  spoc_phone?: string;
  seating_capacity?: number;
  challenges?: string;
  coordinates?: string;
  exterior_media_url?: string;
  exterior_media_urls?: string[];
  generic_email?: string;
  district?: string;
  pincode?: string;
};

const normalizeLocationStatus = (value?: string): LocationStatus => {
  const allowedStatuses: LocationStatus[] = [
    "NOT_CONTACTED",
    "CONTACTED",
    "INTERESTED",
    "MEETING_SCHEDULED",
    "PROPOSAL_SENT",
    "IN_PROGRESS",
    "CLOSED",
  ];
  return allowedStatuses.includes(value as LocationStatus)
    ? (value as LocationStatus)
    : "NOT_CONTACTED";
};

interface AddLocationDialogProps<TLocation extends LocationDraft> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newLocation: TLocation;
  setNewLocation: (location: TLocation) => void;
  handleAddLocation: (locationData?: TLocation) => void;
  resetForm: () => void;
  isSubmitting?: boolean;
  segment?: string;
  enableExtendedTechParkFields?: boolean;
}

export const AddLocationDialog = <TLocation extends LocationDraft>({
  open,
  onOpenChange,
  newLocation,
  setNewLocation,
  handleAddLocation,
  isSubmitting,
  segment = "techParks",
  enableExtendedTechParkFields = false,
}: AddLocationDialogProps<TLocation>) => {
  const showExtendedFields = segment === "coworkingSpaces" || enableExtendedTechParkFields;
  const shouldEnforceExtendedRequiredFields = showExtendedFields;
  const [existingExteriorUrls, setExistingExteriorUrls] = useState<string[]>(
    [],
  );
  const [selectedExteriorFiles, setSelectedExteriorFiles] = useState<File[]>(
    [],
  );
  const [submitError, setSubmitError] = useState("");
  const uploadInputRef = useRef<HTMLInputElement | null>(null);


  const selectedExteriorPreviews = useMemo(
    () => selectedExteriorFiles.map((f) => URL.createObjectURL(f)),
    [selectedExteriorFiles],
  );

  useEffect(() => {
    return () => {
      selectedExteriorPreviews.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [selectedExteriorPreviews]);

  useEffect(() => {
    if (!open) return;
    const urls = Array.isArray(newLocation?.exterior_media_urls)
      ? newLocation.exterior_media_urls
        .filter((u: unknown) => typeof u === "string")
        .map((u: string) => u.trim())
        .filter(Boolean)
      : typeof newLocation?.exterior_media_url === "string" &&
        newLocation.exterior_media_url.trim()
        ? [newLocation.exterior_media_url.trim()]
        : [];
    setExistingExteriorUrls(urls);
    setSelectedExteriorFiles([]);
    setSubmitError("");
  }, [open, newLocation]);

  const addExteriorFiles = (files: File[]) => {
    if (!files.length) return;
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    const validFiles: File[] = [];
    let hasTooLarge = false;

    files.forEach((file) => {
      if (file.size <= MAX_SIZE) {
        validFiles.push(file);
      } else {
        hasTooLarge = true;
      }
    });

    if (hasTooLarge) {
      toast.error("Some files are larger than 5MB and were skipped.");
    }

    const currentCount = existingExteriorUrls.length + selectedExteriorFiles.length;
    const remaining = Math.max(0, 5 - currentCount);
    if (remaining === 0) return;

    if (validFiles.length > 0) {
      setSelectedExteriorFiles((prev) => [...prev, ...validFiles.slice(0, remaining)]);
    }
  };

  const removeSelectedExteriorFile = (index: number) => {
    setSelectedExteriorFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingExteriorUrl = (index: number) => {
    setExistingExteriorUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const techParkSchema = z
    .object({
      name: z
        .string()
        .trim()
        .min(1, "Name is required")
        .min(2, "Name must be at least 2 characters"),
      address: z
        .string()
        .trim()
        .min(1, "Address is required")
        .min(10, "Address must be at least 10 characters"),
      phone: z
        .string()
        .trim()
        .min(1, "Contact Number is required")
        .refine((val) => {
          const phoneRegex = /^(\+91[\s-]?)?[0-9]{10}$/;
          return phoneRegex.test(val.replace(/\s/g, ""));
        }, "Please enter a valid 10-digit phone number"),
      website: z
        .string()
        .optional()
        .refine((val) => {
          if (!val || val.trim() === "") return true;
          try {
            new URL(val);
            return true;
          } catch {
            return false;
          }
        }, "Please enter a valid URL"),
      map_url: z
        .string()
        .optional()
        .refine((val) => {
          if (!val || val.trim() === "") return true;
          try {
            const url = new URL(val);
            return (
              url.hostname.includes("google.com") ||
              url.hostname.includes("maps.google")
            );
          } catch {
            return false;
          }
        }, "Please enter a valid Google Maps URL"),
      rating: z
        .string()
        .optional()
        .refine((val) => {
          if (!val || val.trim() === "") return true;
          const num = parseFloat(val);
          return !isNaN(num) && num >= 0 && num <= 5;
        }, "Rating must be a number between 0 and 5"),
      status: z
        .enum([
          "NOT_CONTACTED",
          "CONTACTED",
          "INTERESTED",
          "MEETING_SCHEDULED",
          "PROPOSAL_SENT",
          "IN_PROGRESS",
          "CLOSED",
        ])
        .optional(),

      builder_name: z.string().optional(),
      security_agency_name: z.string().optional(),
      property_manager_name: z.string().optional(),
      property_manager_phone: z.string().optional(),
      property_manager_email: z.string().optional(),
      parking_floors: z.string().optional(),
      total_floors: z.string().optional(),
      basement_levels: z.string().optional(),
      spoc_name: z.string().optional(),
      spoc_phone: z.string().optional(),
      seating_capacity: z.string().optional(),
      challenges: z.string().optional(),
      coordinates: z
        .string()
        .optional()
        .refine((val) => {
          if (!val || val.trim() === "") return true;
          const m = val.trim().match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
          if (!m) return false;
          const lat = Number(m[1]);
          const lng = Number(m[2]);
          return (
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            lat >= -90 &&
            lat <= 90 &&
            lng >= -180 &&
            lng <= 180
          );
        }, "Please enter the coordinates in this format: 12.9716, 77.5946"),
      exterior_media_url: z
        .string()
        .optional()
        .refine((val) => {
          if (!val || val.trim() === "") return true;
          try {
            new URL(val);
            return true;
          } catch {
            return false;
          }
        }, "Please enter a valid URL"),
      generic_email: z.string().optional().refine((val) => {
        if (!val || val.trim() === "") return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
      }, "Please enter a valid email ID"),
      district: z.string().optional(),
      pincode: z.string().optional().refine((val) => {
        if (!val || val.trim() === "") return true;
        return /^\d{6}$/.test(val);
      }, "Pincode must be 6 digits"),
    })
    .superRefine((data, ctx) => {
      if (!shouldEnforceExtendedRequiredFields) return;

      const requiredTextFields: Array<{
        key: keyof TechParkFormData;
        label: string;
      }> = [
          {
            key: "builder_name",
            label: "Builder name is required",
          },
          {
            key: "security_agency_name",
            label: "Security agency name is required",
          },
          {
            key: "property_manager_name",
            label: "Property Manager name is required",
          },
          {
            key: "spoc_name",
            label: "SPOC name is required"
          },
          {
            key: "challenges",
            label: "Challenges field is required"
          },
          {
            key: "coordinates",
            label: "Latitude and Longitude is required"
          },
        ];

      requiredTextFields.forEach(({ key, label }) => {
        const v = (data[key] ?? "").toString().trim();
        if (!v) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: label,
            path: [key],
          });
        }
      });

      // Phone validation
      const validatePhone = (key: keyof TechParkFormData, label: string) => {
        const val = data[key] || "";
        if (!val.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${label} is required`,
            path: [key],
          });
        } else if (!/^(\+91[\s-]?)?[0-9]{10}$/.test(val.replace(/\s/g, ""))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Please enter a valid 10-digit phone number for ${label}`,
            path: [key],
          });
        }
      };

      validatePhone("property_manager_phone", "Property Manager contact");
      validatePhone("spoc_phone", "SPOC contact");

      // Email validation
      const emailVal = (data.property_manager_email || "").trim();
      if (!emailVal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Property manager email is required",
          path: ["property_manager_email"],
        });
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter a valid email ID",
          path: ["property_manager_email"],
        });
      }

      const requireNonNegativeInt = (
        key: keyof TechParkFormData,
        label: string,
      ) => {
        const raw = (data[key] ?? "").toString().trim();
        if (!raw) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${label} is required`,
            path: [key],
          });
          return;
        }
        const n = Number(raw);
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${label} must be a non-negative integer`,
            path: [key],
          });
        }
      };

      requireNonNegativeInt("parking_floors", "Parking floors");
      requireNonNegativeInt("total_floors", "Total floors");
      requireNonNegativeInt("basement_levels", "Basement levels");
      requireNonNegativeInt("seating_capacity", "Seating capacity");
    });
  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting: isFormSubmitting },
    reset,
    setValue,
    watch,
    clearErrors,
  } = useForm<TechParkFormData>({
    resolver: zodResolver(techParkSchema),
    mode: 'onChange',
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      website: "",
      map_url: "",
      rating: "",
      status: "NOT_CONTACTED",

      builder_name: "",
      security_agency_name: "",
      property_manager_name: "",
      property_manager_phone: "",
      property_manager_email: "",
      parking_floors: "",
      total_floors: "",
      basement_levels: "",
      spoc_name: "",
      spoc_phone: "",
      seating_capacity: "",
      challenges: "",
      coordinates: "",
      exterior_media_url: "",
      generic_email: "",
      district: "",
      pincode: "",
    },
  });

  useEffect(() => {
    if (newLocation) {
      setValue("name", newLocation.name || "");
      setValue("address", newLocation.address || "");
      setValue("phone", newLocation.phone || "");
      setValue("website", newLocation.website || "");
      setValue("map_url", newLocation.map_url || "");
      setValue("rating", newLocation.rating?.toString() || "");
      setValue("status", normalizeLocationStatus(newLocation.status));

      setValue("builder_name", newLocation.builder_name || "");
      setValue("security_agency_name", newLocation.security_agency_name || "");
      setValue(
        "property_manager_name",
        newLocation.property_manager_name || "",
      );
      setValue(
        "property_manager_phone",
        newLocation.property_manager_phone || "",
      );
      setValue(
        "property_manager_email",
        newLocation.property_manager_email || "",
      );
      setValue(
        "parking_floors",
        typeof newLocation.parking_floors === "number"
          ? String(newLocation.parking_floors)
          : "",
      );
      setValue(
        "total_floors",
        typeof newLocation.total_floors === "number"
          ? String(newLocation.total_floors)
          : "",
      );
      setValue(
        "basement_levels",
        typeof newLocation.basement_levels === "number"
          ? String(newLocation.basement_levels)
          : "",
      );
      setValue("spoc_name", newLocation.spoc_name || "");
      setValue("spoc_phone", newLocation.spoc_phone || "");
      setValue(
        "seating_capacity",
        typeof newLocation.seating_capacity === "number"
          ? String(newLocation.seating_capacity)
          : "",
      );
      setValue("challenges", newLocation.challenges || "");
      setValue("coordinates", newLocation.coordinates || "");
      setValue(
        "exterior_media_url",
        (Array.isArray(newLocation.exterior_media_urls) &&
          newLocation.exterior_media_urls[0]) ||
        newLocation.exterior_media_url ||
        "",
      );
      setValue("generic_email", newLocation.generic_email || "");
      setValue("district", newLocation.district || "");
      setValue("pincode", newLocation.pincode || "");
    } else {
      setValue("name", "");
      setValue("address", "");
      setValue("phone", "");
      setValue("website", "");
      setValue("map_url", "");
      setValue("rating", "");
      setValue("status", "NOT_CONTACTED");
      setValue("builder_name", "");
      setValue("security_agency_name", "");
      setValue("property_manager_name", "");
      setValue("property_manager_phone", "");
      setValue("property_manager_email", "");
      setValue("parking_floors", "");
      setValue("total_floors", "");
      setValue("basement_levels", "");
      setValue("spoc_name", "");
      setValue("spoc_phone", "");
      setValue("seating_capacity", "");
      setValue("challenges", "");
      setValue("coordinates", "");
      setValue("exterior_media_url", "");
      setValue("generic_email", "");
      setValue("district", "");
      setValue("pincode", "");
    }
  }, [newLocation, setValue]);

  useEffect(() => {
    if (open) {
      const formData = {
        name: newLocation?.name || "",
        address: newLocation?.address || "",
        phone: newLocation?.phone || "",
        website: newLocation?.website || "",
        map_url: newLocation?.map_url || "",
        rating: newLocation?.rating?.toString() || "",
        status: normalizeLocationStatus(newLocation?.status),

        builder_name: newLocation?.builder_name || "",
        security_agency_name: newLocation?.security_agency_name || "",
        property_manager_name: newLocation?.property_manager_name || "",
        property_manager_phone: newLocation?.property_manager_phone || "",
        property_manager_email: newLocation?.property_manager_email || "",
        parking_floors:
          typeof newLocation?.parking_floors === "number"
            ? String(newLocation.parking_floors)
            : "",
        total_floors:
          typeof newLocation?.total_floors === "number"
            ? String(newLocation.total_floors)
            : "",
        basement_levels:
          typeof newLocation?.basement_levels === "number"
            ? String(newLocation.basement_levels)
            : "",
        spoc_name: newLocation?.spoc_name || "",
        spoc_phone: newLocation?.spoc_phone || "",
        seating_capacity:
          typeof newLocation?.seating_capacity === "number"
            ? String(newLocation.seating_capacity)
            : "",
        challenges: newLocation?.challenges || "",
        coordinates: newLocation?.coordinates || "",
        exterior_media_url:
          (Array.isArray(newLocation?.exterior_media_urls) &&
            newLocation.exterior_media_urls[0]) ||
          newLocation?.exterior_media_url ||
          "",
        generic_email: newLocation?.generic_email || "",
        district: newLocation?.district || "",
        pincode: newLocation?.pincode || "",
      };
      reset(formData);
      setValue("status", normalizeLocationStatus(formData.status));
    }
  }, [open, newLocation, reset, setValue]);

  useEffect(() => {
    const subscription = watch(() => {
      if (submitError) setSubmitError("");
      if (errors.exterior_media_url) clearErrors("exterior_media_url");
    });
    return () => subscription.unsubscribe();
  }, [watch, submitError, errors.exterior_media_url, clearErrors]);

  useEffect(() => {
    // Sync the photo count to the form so the validation engine is aware of changes
    const totalPhotos = existingExteriorUrls.length + selectedExteriorFiles.length;
    // Set a placeholder value to satisfy any "required" checks in the schema if needed,
    // and trigger validation so the button re-enables immediately.
    setValue("exterior_media_url", totalPhotos > 0 ? "https://placeholder.com" : "", { shouldValidate: true });

    if (submitError) setSubmitError("");
    if (errors.exterior_media_url) clearErrors("exterior_media_url");
  }, [selectedExteriorFiles, existingExteriorUrls, clearErrors, setValue, submitError, errors.exterior_media_url]);

  const onSubmit = async (data: TechParkFormData) => {
    const readUploadErrorMessage = (error: unknown): string | null => {
      if (typeof error !== "object" || error === null || !("response" in error)) {
        return null;
      }
      const response = (error as { response?: unknown }).response;
      if (typeof response !== "object" || response === null) {
        return null;
      }
      const status =
        "status" in response ? (response as { status?: unknown }).status : undefined;
      const dataPayload =
        "data" in response ? (response as { data?: unknown }).data : undefined;
      if (
        typeof dataPayload === "object" &&
        dataPayload !== null &&
        "message" in dataPayload &&
        typeof (dataPayload as { message?: unknown }).message === "string"
      ) {
        return (dataPayload as { message: string }).message;
      }
      if (
        typeof dataPayload === "object" &&
        dataPayload !== null &&
        "error" in dataPayload &&
        typeof (dataPayload as { error?: unknown }).error === "string"
      ) {
        return (dataPayload as { error: string }).error;
      }
      if (status === 413) {
        return "Payload Too Large: Selected files exceed maximum allowed size";
      }
      return null;
    };

    const parseNonNegativeInt = (value?: string) => {
      if (!value || value.trim() === "") return undefined;
      const n = Number(value.trim());
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return undefined;
      return n;
    };
    const normalizePhone10 = (value?: string) =>
      (value || "").replace(/[^\d]/g, "");
    const parseCoordinates = (value?: string) => {
      const s = (value || "").trim();
      const m = s.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
      if (!m) return null;
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    };
    const coords = shouldEnforceExtendedRequiredFields
      ? parseCoordinates(data.coordinates)
      : null;

    let exteriorUrls = [...existingExteriorUrls];
    if (selectedExteriorFiles.length > 0) {
      try {
        const resp = await techParkService.uploadNewTechParkExteriorMedia(
          selectedExteriorFiles,
        );
        exteriorUrls = [...exteriorUrls, ...(resp.urls || [])]
          .map((u) => String(u).trim())
          .filter(Boolean)
          .slice(0, 5);
      } catch (error: unknown) {
        const msg =
          readUploadErrorMessage(error) || "Failed to upload photos. Please try again.";
        setSubmitError(msg);
        return;
      }
    }

    if (shouldEnforceExtendedRequiredFields && exteriorUrls.length === 0) {
      setSubmitError("At least 1 exterior photo is required (max 5).");
      return;
    }

    const formattedData = {
      ...newLocation,
      name: data.name.trim(),
      address: data.address.trim(),
      phone: data.phone.trim(),
      website: data.website || "",
      map_url: data.map_url || "",
      rating: data.rating ? parseFloat(data.rating) : 0,
      status: data.status || "NOT_CONTACTED",

      builder_name: data.builder_name?.trim() || "",
      security_agency_name: data.security_agency_name?.trim() || "",
      property_manager_name: data.property_manager_name?.trim() || "",
      property_manager_phone: normalizePhone10(data.property_manager_phone),
      property_manager_email: data.property_manager_email?.trim() || "",
      parking_floors: parseNonNegativeInt(data.parking_floors),
      total_floors: parseNonNegativeInt(data.total_floors),
      basement_levels: parseNonNegativeInt(data.basement_levels),
      spoc_name: data.spoc_name?.trim() || "",
      spoc_phone: normalizePhone10(data.spoc_phone),
      seating_capacity: parseNonNegativeInt(data.seating_capacity),
      challenges: data.challenges?.trim() || "",
      coordinates: data.coordinates?.trim() || "",
      exterior_media_url: exteriorUrls[0] || "",
      exterior_media_urls: exteriorUrls,
      lat: coords?.lat,
      lng: coords?.lng,
      generic_email: data.generic_email?.trim() || "",
      district: data.district?.trim() || "",
      pincode: data.pincode?.trim() || "",
    } as TLocation;
    setNewLocation(formattedData);
    handleAddLocation(formattedData);
  };

  const handleDialogClose = (v: boolean) => {
    if (!v) {
      reset();
      try {
        setNewLocation({
          ...newLocation,
          id: "",
          name: "",
          address: "",
          website: "",
          rating: 0,
          phone: "",
          map_url: "",
          status: "NOT_CONTACTED",
          builder_name: "",
          security_agency_name: "",
          property_manager_name: "",
          property_manager_phone: "",
          property_manager_email: "",
          parking_floors: 0,
          total_floors: 0,
          basement_levels: 0,
          spoc_name: "",
          spoc_phone: "",
          seating_capacity: 0,
          challenges: "",
          coordinates: "",
          exterior_media_url: "",
          exterior_media_urls: [],
        } as TLocation);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.debug("[add-location-dialog] failed to reset location draft", error);
        }
      }
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="w-[95vw] sm:max-w-[650px] max-h-[90vh] overflow-hidden p-0 flex flex-col">
        <div className="px-6 pt-6 flex-shrink-0">
          <DialogHeader>
            <DialogTitle>
              {newLocation?.id
                ? `Edit ${getSegmentSingularLabel(segment)}`
                : `Add New ${getSegmentSingularLabel(segment)}`
              }
            </DialogTitle>
            <DialogDescription>
              {newLocation?.id
                ? `Update the details for this ${getSegmentSingularLabel(segment).toLowerCase()}.`
                : `Fill in the details of the new ${getSegmentSingularLabel(segment).toLowerCase()}.`
              }
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <div className="grid gap-3 py-4 px-6 overflow-y-auto overscroll-contain flex-1 min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder={
                    segment === "techParks"
                      ? "International Tech Park Hyderabad"
                      : "WeWork Galaxy"
                  }
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="address">Address <span className="text-red-500">*</span></Label>
                <Textarea
                  id="address"
                  {...register("address")}
                  placeholder="Plot No. 17 Gate No.5, Madhapur, Hyderabad"
                  className={errors.address ? "border-red-500" : ""}
                />
                {errors.address && (
                  <p className="text-sm text-red-500 mt-1">{errors.address.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="district">District / Locality</Label>
                  <Input
                    id="district"
                    {...register("district")}
                    placeholder="e.g. Madhapur"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    {...register("pincode")}
                    placeholder="6-digit PIN"
                    className={errors.pincode ? "border-red-500" : ""}
                  />
                  {errors.pincode && (
                    <p className="text-sm text-red-500 mt-1">{errors.pincode.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="phone">Contact Number <span className="text-red-500">*</span></Label>
                  <Input
                    id="phone"
                    {...register("phone")}
                    placeholder="+91 40 1234 5678"
                    className={errors.phone ? "border-red-500" : ""}
                  />
                  {errors.phone && (
                    <p className="text-sm text-red-500 mt-1">{errors.phone.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    {...register("website")}
                    placeholder="http://www.example.com/"
                    className={errors.website ? "border-red-500" : ""}
                  />
                  {errors.website && (
                    <p className="text-sm text-red-500 mt-1">{errors.website.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="generic_email">Generic Email</Label>
                <Input
                  id="generic_email"
                  {...register("generic_email")}
                  placeholder="e.g. info@company.com"
                  className={errors.generic_email ? "border-red-500" : ""}
                />
                {errors.generic_email && (
                  <p className="text-sm text-red-500 mt-1">{errors.generic_email.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="map_url">Google Maps URL</Label>
                  <Input
                    id="map_url"
                    {...register("map_url")}
                    placeholder="https://maps.google.com/?cid=..."
                    className={errors.map_url ? "border-red-500" : ""}
                  />
                  {errors.map_url && (
                    <p className="text-sm text-red-500 mt-1">{errors.map_url.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rating">Rating</Label>
                  <Input
                    id="rating"
                    {...register("rating")}
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    placeholder="4.4"
                    className={errors.rating ? "border-red-500" : ""}
                  />
                  {errors.rating && (
                    <p className="text-sm text-red-500 mt-1">{errors.rating.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={watch("status")}
                  onValueChange={(value) =>
                    setValue("status", value as LocationStatus)
                  }
                >
                  <SelectTrigger className={errors.status ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOT_CONTACTED">Not Contacted</SelectItem>
                    <SelectItem value="CONTACTED">Contacted</SelectItem>
                    <SelectItem value="INTERESTED">Interested</SelectItem>
                    <SelectItem value="MEETING_SCHEDULED">Meeting Scheduled</SelectItem>
                    <SelectItem value="PROPOSAL_SENT">Proposal Sent</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
                {errors.status && (
                  <p className="text-sm text-red-500 mt-1">{errors.status.message}</p>
                )}
              </div>

              {showExtendedFields && (
                <>
                  <div className="pt-2 border-t" />

                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="builder_name">
                        Builder Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="builder_name"
                        {...register("builder_name")}
                        placeholder="Select/Enter builder name"
                        className={errors.builder_name ? "border-red-500" : ""}
                      />
                      {errors.builder_name && (
                        <p className="text-sm text-red-500 mt-1">
                          {errors.builder_name.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="security_agency_name">
                        Security Agency Name{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="security_agency_name"
                        {...register("security_agency_name")}
                        placeholder="Enter full security agency name"
                        className={
                          errors.security_agency_name ? "border-red-500" : ""
                        }
                      />
                      {errors.security_agency_name && (
                        <p className="text-sm text-red-500 mt-1">
                          {errors.security_agency_name.message}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="property_manager_name">
                          Property Manager Name{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="property_manager_name"
                          {...register("property_manager_name")}
                          placeholder="Full name"
                          className={
                            errors.property_manager_name ? "border-red-500" : ""
                          }
                        />
                        {errors.property_manager_name && (
                          <p className="text-sm text-red-500 mt-1">
                            {errors.property_manager_name.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="property_manager_phone">
                          Property Manager Contact{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="property_manager_phone"
                          {...register("property_manager_phone")}
                          placeholder="10-digit mobile number"
                          className={
                            errors.property_manager_phone ? "border-red-500" : ""
                          }
                        />
                        {errors.property_manager_phone && (
                          <p className="text-sm text-red-500 mt-1">
                            {errors.property_manager_phone.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="property_manager_email">
                        Property Manager Email{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="property_manager_email"
                        {...register("property_manager_email")}
                        placeholder="Official email ID"
                        className={
                          errors.property_manager_email ? "border-red-500" : ""
                        }
                      />
                      {errors.property_manager_email && (
                        <p className="text-sm text-red-500 mt-1">
                          {errors.property_manager_email.message}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="parking_floors">
                          Parking Floors <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="parking_floors"
                          {...register("parking_floors")}
                          type="number"
                          min="0"
                          step="1"
                          placeholder="e.g. 2"
                          className={
                            errors.parking_floors ? "border-red-500" : ""
                          }
                        />
                        {errors.parking_floors && (
                          <p className="text-sm text-red-500 mt-1">
                            {errors.parking_floors.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="total_floors">
                          Total Floors (excluding basement){" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="total_floors"
                          {...register("total_floors")}
                          type="number"
                          min="0"
                          step="1"
                          placeholder="e.g. 12"
                          className={errors.total_floors ? "border-red-500" : ""}
                        />
                        {errors.total_floors && (
                          <p className="text-sm text-red-500 mt-1">
                            {errors.total_floors.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="basement_levels">
                        Basement Levels <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="basement_levels"
                        {...register("basement_levels")}
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g. 2"
                        className={
                          errors.basement_levels ? "border-red-500" : ""
                        }
                      />
                      {errors.basement_levels && (
                        <p className="text-sm text-red-500 mt-1">
                          {errors.basement_levels.message}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="spoc_name">
                          SPOC Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="spoc_name"
                          {...register("spoc_name")}
                          placeholder="Single point of contact"
                          className={errors.spoc_name ? "border-red-500" : ""}
                        />
                        {errors.spoc_name && (
                          <p className="text-sm text-red-500 mt-1">
                            {errors.spoc_name.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="spoc_phone">
                          SPOC Contact <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="spoc_phone"
                          {...register("spoc_phone")}
                          placeholder="10-digit mobile number"
                          className={errors.spoc_phone ? "border-red-500" : ""}
                        />
                        {errors.spoc_phone && (
                          <p className="text-sm text-red-500 mt-1">
                            {errors.spoc_phone.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="seating_capacity">
                        Seating Capacity <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="seating_capacity"
                        {...register("seating_capacity")}
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Total seats/workstations"
                        className={
                          errors.seating_capacity ? "border-red-500" : ""
                        }
                      />
                      {errors.seating_capacity && (
                        <p className="text-sm text-red-500 mt-1">
                          {errors.seating_capacity.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="challenges">
                        Challenges (Parking/Operations){" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        id="challenges"
                        {...register("challenges")}
                        placeholder="Describe any challenges at this site"
                        className={errors.challenges ? "border-red-500" : ""}
                      />
                      {errors.challenges && (
                        <p className="text-sm text-red-500 mt-1">
                          {errors.challenges.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="coordinates">
                        Latitude, Longitude <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="coordinates"
                        {...register("coordinates")}
                        placeholder="12.9716, 77.5946"
                        className={errors.coordinates ? "border-red-500" : ""}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Tip: Google Maps → right click location → “What's here?”
                      </p>
                      {errors.coordinates && (
                        <p className="text-sm text-red-500 mt-1">
                          {errors.coordinates.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>
                        Exterior Photos <span className="text-red-500">*</span>
                      </Label>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => uploadInputRef.current?.click()}
                          disabled={existingExteriorUrls.length + selectedExteriorFiles.length >= 5}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Max 5 photos (max 5MB each) ({existingExteriorUrls.length + selectedExteriorFiles.length}/5)
                        </p>
                      </div>

                      <input
                        ref={uploadInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          addExteriorFiles(files);
                          e.target.value = "";
                        }}
                      />
                      <input {...register("exterior_media_url")} className="hidden" />

                      {(existingExteriorUrls.length > 0 || selectedExteriorPreviews.length > 0) && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {existingExteriorUrls.map((url, idx) => (
                            <div
                              key={`existing-${idx}`}
                              className="relative overflow-hidden rounded-md border bg-muted"
                            >
                              <img
                                src={url}
                                alt={`Exterior ${idx + 1}`}
                                className="h-28 w-full object-cover"
                              />
                              <button
                                type="button"
                                className="absolute right-1 top-1 rounded bg-background/80 p-1"
                                onClick={() => removeExistingExteriorUrl(idx)}
                                aria-label="Remove photo"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                          {selectedExteriorPreviews.map((url, idx) => (
                            <div
                              key={`selected-${idx}`}
                              className="relative overflow-hidden rounded-md border bg-muted"
                            >
                              <img
                                src={url}
                                alt={`New exterior ${idx + 1}`}
                                className="h-28 w-full object-cover"
                              />
                              <button
                                type="button"
                                className="absolute right-1 top-1 rounded bg-background/80 p-1"
                                onClick={() => removeSelectedExteriorFile(idx)}
                                aria-label="Remove photo"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {submitError && (
                        <p className="text-sm text-red-500 mt-1">
                          {submitError}
                        </p>
                      )}
                      {errors.exterior_media_url && !submitError && (
                        <p className="text-sm text-red-500 mt-1">
                          {errors.exterior_media_url.message}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {newLocation?.id && isVenueSegment(segment) && (
                <div className="pt-2">
                  <ContactLogs
                    companyId={newLocation.id}
                    companyName={newLocation.name || ""}
                    companyType="venue"
                    venueType={segment}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="sticky bottom-0 z-10 flex justify-end space-x-2 border-t bg-background/95 px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting || isFormSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isFormSubmitting || !isValid}>
              {isSubmitting || isFormSubmitting
                ? (newLocation?.id ? 'Saving…' : 'Adding…')
                : (newLocation?.id
                  ? 'Save Changes'
                  : `Add ${getSegmentSingularLabel(segment)}`
                )
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
