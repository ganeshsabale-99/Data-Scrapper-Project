import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";

const companySchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters"),
  address: z.string().min(1, "Address is required").min(5, "Address must be at least 5 characters"),
  contact: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    const phoneRegex = /^(\+91[\s-]?)?[0-9]{10}$/;
    return phoneRegex.test(val.replace(/\s/g, ""));
  }, "Please enter a valid 10-digit phone number"),
  website: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    try {
      new URL(val);
      return true;
    } catch {
      return false;
    }
  }, "Please enter a valid URL"),
  map_url: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    try {
      const url = new URL(val);
      return url.hostname.includes("google.com") || url.hostname.includes("maps.google");
    } catch {
      return false;
    }
  }, "Please enter a valid Google Maps URL"),
  rating: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 5;
  }, "Rating must be a number between 0 and 5"),
  status: z.enum(["NOT_CONTACTED", "CONTACTED", "INTERESTED", "MEETING_SCHEDULED", "PROPOSAL_SENT", "IN_PROGRESS", "CLOSED"]).optional(),
  description: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    return val.length >= 10;
  }, "Description must be at least 10 characters"),
});

type CompanyFormData = z.infer<typeof companySchema>;
type CompanyStatus = NonNullable<CompanyFormData["status"]>;
type CompanyDraft = {
  id?: string;
  name?: string;
  address?: string;
  contact?: string;
  contact_phone?: string;
  phone?: string;
  website?: string;
  map_url?: string;
  rating?: number | string;
  business_status?: string;
  status?: string;
  description?: string;
};

const isFieldRequired = (fieldName: keyof typeof companySchema.shape) => {
  return !companySchema.shape[fieldName].isOptional();
};

const normalizeCompanyStatus = (value?: string): CompanyStatus => {
  const allowedStatuses: CompanyStatus[] = [
    "NOT_CONTACTED",
    "CONTACTED",
    "INTERESTED",
    "MEETING_SCHEDULED",
    "PROPOSAL_SENT",
    "IN_PROGRESS",
    "CLOSED",
  ];
  return allowedStatuses.includes(value as CompanyStatus)
    ? (value as CompanyStatus)
    : "NOT_CONTACTED";
};

interface AddCompanyDialogProps<TCompany extends CompanyDraft> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: TCompany;
  setCompany: React.Dispatch<React.SetStateAction<TCompany>>;
  handleAddCompany: (companyData?: TCompany) => void;
  resetForm: () => void;
  isLoading?: boolean;
}

export function AddCompanyDialog<TCompany extends CompanyDraft>({
  open,
  onOpenChange,
  company,
  setCompany,
  handleAddCompany,
  resetForm,
  isLoading = false
}: AddCompanyDialogProps<TCompany>) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    mode: 'onChange',
    defaultValues: {
      name: "",
      address: "",
      contact: "",
      website: "",
      map_url: "",
      rating: "",
      status: "NOT_CONTACTED",
      description: "",
    },
  });

  const watchedValues = watch();
  const isFormValid = watchedValues.name && watchedValues.name.trim().length >= 2 &&
    watchedValues.address && watchedValues.address.trim().length >= 5;

  useEffect(() => {
    if (company) {
      setValue("name", company.name || "");
      setValue("address", company.address || "");
      setValue("contact", company.contact_phone || company.phone || company.contact || "");
      setValue("website", company.website || "");
      setValue("map_url", company.map_url || "");
      setValue("rating", company.rating?.toString() || "");
      setValue(
        "status",
        normalizeCompanyStatus(company.business_status || company.status),
      );
      setValue("description", company.description || "");
    } else {
      setValue("name", "");
      setValue("address", "");
      setValue("contact", "");
      setValue("website", "");
      setValue("map_url", "");
      setValue("rating", "");
      setValue("status", "NOT_CONTACTED");
      setValue("description", "");
    }
  }, [company, setValue]);

  useEffect(() => {
    if (open) {
      const formData = {
        name: company?.name || "",
        address: company?.address || "",
        contact: company?.contact_phone || company?.phone || company?.contact || "",
        website: company?.website || "",
        map_url: company?.map_url || "",
        rating: company?.rating?.toString() || "",
        status: normalizeCompanyStatus(
          company?.business_status || company?.status,
        ),
        description: company?.description || "",
      };
      reset(formData);
      setValue("status", formData.status);
    }
  }, [open, company, reset, setValue]);

  const onSubmit = (data: CompanyFormData) => {
    const formattedData = {
      ...company,
      name: data.name,
      address: data.address || "",
      contact_phone: data.contact || "",
      phone: data.contact || "",
      website: data.website || "",
      map_url: data.map_url || "",
      rating: data.rating ? parseFloat(data.rating) : 0,
      business_status: data.status || "NOT_CONTACTED",
      status: data.status || "NOT_CONTACTED",
      description: data.description || "",
    } as TCompany;

    setCompany(formattedData);
    handleAddCompany(formattedData);
  };

  const handleDialogClose = (v: boolean) => {
    if (!v) {
      reset();
      resetForm();
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="w-[95vw] sm:max-w-[650px] h-[90vh] max-h-[90vh] overflow-hidden p-0 flex flex-col">
        <div className="flex flex-col h-full">
          <div className="px-6 pt-6 flex-shrink-0">
            <DialogHeader>
              <DialogTitle>{company?.id ? 'Edit Company' : 'Add New Company'}</DialogTitle>
              <DialogDescription>
                {company?.id ? 'Update the details for this company.' : 'Fill in the details of the company.'}
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
            <div className="grid gap-3 py-4 px-6 overflow-y-auto overscroll-contain flex-1 min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="name">
                    Company Name {isFieldRequired("name") && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id="name"
                    {...register("name")}
                    placeholder="Acme Corporation"
                    className={errors.name ? "border-red-500" : ""}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
                  )}
                  {!errors.name && !isFormValid && (
                    <p className="text-sm text-muted-foreground mt-1">Enter at least 2 characters for company name and 5 characters for address to enable the Add Company button</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="address">
                    Address {isFieldRequired("address") && <span className="text-red-500">*</span>}
                  </Label>
                  <Textarea
                    id="address"
                    {...register("address")}
                    placeholder="221B Baker Street, London"
                    rows={3}
                    className={errors.address ? "border-red-500" : ""}
                  />
                  {errors.address && (
                    <p className="text-sm text-red-500 mt-1">{errors.address.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="contact">
                      Contact {isFieldRequired("contact") && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      id="contact"
                      {...register("contact")}
                      placeholder="080 1234 5678"
                      className={errors.contact ? "border-red-500" : ""}
                    />
                    {errors.contact && (
                      <p className="text-sm text-red-500 mt-1">{errors.contact.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="website">
                      Website {isFieldRequired("website") && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      id="website"
                      {...register("website")}
                      placeholder="https://example.com"
                      className={errors.website ? "border-red-500" : ""}
                    />
                    {errors.website && (
                      <p className="text-sm text-red-500 mt-1">{errors.website.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="map_url">
                      Google Maps URL {isFieldRequired("map_url") && <span className="text-red-500">*</span>}
                    </Label>
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
                    <Label htmlFor="rating">
                      Rating {isFieldRequired("rating") && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      id="rating"
                      {...register("rating")}
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      placeholder="Enter rating (0-5)"
                      className={errors.rating ? "border-red-500" : ""}
                    />
                    {errors.rating && (
                      <p className="text-sm text-red-500 mt-1">{errors.rating.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="status">
                    Status {isFieldRequired("status") && <span className="text-red-500">*</span>}
                  </Label>
                  <Select
                    value={watch("status")}
                    onValueChange={(value) =>
                      setValue("status", value as CompanyStatus)
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

                <div className="space-y-1">
                  <Label htmlFor="description">
                    Description {isFieldRequired("description") && <span className="text-red-500">*</span>}
                  </Label>
                  <Textarea
                    id="description"
                    {...register("description")}
                    placeholder="Enter company description"
                    rows={3}
                    className={errors.description ? "border-red-500" : ""}
                  />
                  {errors.description && (
                    <p className="text-sm text-red-500 mt-1">{errors.description.message}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col space-y-2 border-t px-6 py-4 flex-shrink-0">
              {!isFormValid && !isLoading && (
                <p className="text-sm text-muted-foreground text-center">
                  Please fill in the required fields to continue
                </p>
              )}
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || !isFormValid}
                  className={!isFormValid && !isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  {isLoading ? (company?.id ? 'Saving…' : 'Adding…') : (company?.id ? 'Save Changes' : 'Add Company')}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
