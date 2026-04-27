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
import { coworkingSpaceService } from "@/services/coworkingSpaceService";

const coworkingCompanySchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters"),
  description: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    return val.length >= 10;
  }, "Description must be at least 10 characters"),
  business_status: z.enum(["NOT_CONTACTED", "CONTACTED", "INTERESTED", "MEETING_SCHEDULED", "PROPOSAL_SENT", "IN_PROGRESS", "CLOSED"]).optional(),
  operator: z.string().optional(),
  contact_phone: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    const phoneRegex = /^(\+91[\s-]?)?[0-9]{10}$/;
    return phoneRegex.test(val.replace(/\s/g, ""));
  }, "Please enter a valid 10-digit phone number"),
  contact_email: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(val);
  }, "Please enter a valid email address"),
  contact_international_phone: z.string().optional(),
});

type CoworkingCompanyFormData = z.infer<typeof coworkingCompanySchema>;
type CoworkingCompanyPayload = Parameters<typeof coworkingSpaceService.addCompanyToCoworkingSpace>[1];
type CoworkingCompanyDraft = CoworkingCompanyPayload & { id?: string };

interface AddCoworkingCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: CoworkingCompanyDraft | null;
  setCompany: (company: CoworkingCompanyDraft) => void;
  handleAddCompany: (companyData?: CoworkingCompanyDraft) => void;
  resetForm: () => void;
  isLoading?: boolean;
}

export function AddCoworkingCompanyDialog({
  open,
  onOpenChange,
  company,
  setCompany,
  handleAddCompany,
  resetForm,
  isLoading = false,
}: AddCoworkingCompanyDialogProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<CoworkingCompanyFormData>({
    resolver: zodResolver(coworkingCompanySchema),
    defaultValues: {
      name: "",
      description: "",
      business_status: "NOT_CONTACTED",
      operator: "",
      contact_phone: "",
      contact_email: "",
      contact_international_phone: "",
    },
  });

  // Update form when company data changes
  useEffect(() => {
    if (open && company) {
      setValue("name", company.name || "");
      setValue("description", company.description || "");
      setValue(
        "business_status",
        (company.business_status as CoworkingCompanyFormData["business_status"]) || "NOT_CONTACTED",
      );
      setValue("operator", company.operator || "");
      setValue("contact_phone", company.contact_phone || "");
      setValue("contact_email", company.contact_email || "");
      setValue("contact_international_phone", company.contact_international_phone || "");
    } else if (open) {
      reset();
    }
  }, [open, company, reset, setValue]);

  const onSubmit = (data: CoworkingCompanyFormData) => {
    const formattedData = {
      ...company, 
      name: data.name,
      description: data.description || "",
      business_status: data.business_status || "NOT_CONTACTED",
      operator: data.operator || "",
      contact_phone: data.contact_phone || "",
      contact_email: data.contact_email || "",
      contact_international_phone: data.contact_international_phone || "",
    };
    
    setCompany(formattedData);
    handleAddCompany(formattedData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Company to Coworking Space</DialogTitle>
          <DialogDescription>
            Add a new company to this coworking space. Fill in the details below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
          <div className="flex-1 space-y-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="name">Company Name <span className="text-red-500">*</span></Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="Enter company name"
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && (
                <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register("description")}
                placeholder="Brief description of the company"
                rows={3}
                className={errors.description ? "border-red-500" : ""}
              />
              {errors.description && (
                <p className="text-sm text-red-500 mt-1">{errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="business_status">Business Status</Label>
                <Select
                  value={company?.business_status || "NOT_CONTACTED"}
                  onValueChange={(value) =>
                    setValue("business_status", value as CoworkingCompanyFormData["business_status"])
                  }
                >
                  <SelectTrigger className={errors.business_status ? "border-red-500" : ""}>
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
                {errors.business_status && (
                  <p className="text-sm text-red-500 mt-1">{errors.business_status.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="operator">Operator</Label>
                <Input
                  id="operator"
                  {...register("operator")}
                  placeholder="Operator name"
                  className={errors.operator ? "border-red-500" : ""}
                />
                {errors.operator && (
                  <p className="text-sm text-red-500 mt-1">{errors.operator.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="contact_phone">Contact Phone</Label>
                <Input
                  id="contact_phone"
                  {...register("contact_phone")}
                  placeholder="+91 98765 43210"
                  className={errors.contact_phone ? "border-red-500" : ""}
                />
                {errors.contact_phone && (
                  <p className="text-sm text-red-500 mt-1">{errors.contact_phone.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="contact_email">Contact Email</Label>
                <Input
                  id="contact_email"
                  {...register("contact_email")}
                  placeholder="contact@company.com"
                  className={errors.contact_email ? "border-red-500" : ""}
                />
                {errors.contact_email && (
                  <p className="text-sm text-red-500 mt-1">{errors.contact_email.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="contact_international_phone">International Phone</Label>
              <Input
                id="contact_international_phone"
                {...register("contact_international_phone")}
                placeholder="+1 555 123 4567"
                className={errors.contact_international_phone ? "border-red-500" : ""}
              />
              {errors.contact_international_phone && (
                <p className="text-sm text-red-500 mt-1">{errors.contact_international_phone.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Adding..." : "Add Company"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
