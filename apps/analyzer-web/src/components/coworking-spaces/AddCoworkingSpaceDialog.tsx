import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { coworkingSpaceService } from "@/services/coworkingSpaceService";

type AddCoworkingSpacePayload = Parameters<typeof coworkingSpaceService.addCoworkingSpaceToCity>[0]["payload"];

interface AddCoworkingSpaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddCoworkingSpace: (data: AddCoworkingSpacePayload) => void;
  state: string;
  city: string;
  isLoading?: boolean;
}

const COWORKING_STATUSES = [
  { value: "NOT_CONTACTED", label: "Not Contacted" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "INTERESTED", label: "Interested" },
  { value: "MEETING_SCHEDULED", label: "Meeting Scheduled" },
  { value: "PROPOSAL_SENT", label: "Proposal Sent" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "CLOSED", label: "Closed" },
];

export function AddCoworkingSpaceDialog({
  open,
  onOpenChange,
  onAddCoworkingSpace,
  state,
  city,
  isLoading = false,
}: AddCoworkingSpaceDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    city: city,
    state: state,
    district: "",
    pincode: "",
    country: "India",
    address: "",
    contact_phone: "",
    international_phone: "",
    generic_email: "",
    operator_name: "",
    campus_brand: "",
    legal_entity: "",
    campus_size_hint: "",
    status: "NOT_CONTACTED",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setFormData({
        name: "",
        city: city,
        state: state,
        district: "",
        pincode: "",
        country: "India",
        address: "",
        contact_phone: "",
        international_phone: "",
        generic_email: "",
        operator_name: "",
        campus_brand: "",
        legal_entity: "",
        campus_size_hint: "",
        status: "NOT_CONTACTED",
      });
      setErrors({});
    }
  }, [open, city, state]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Coworking space name is required";
    }

    if (!formData.city.trim()) {
      newErrors.city = "City is required";
    }

    if (!formData.state.trim()) {
      newErrors.state = "State is required";
    }

    if (formData.generic_email && !/\S+@\S+\.\S+/.test(formData.generic_email)) {
      newErrors.generic_email = "Please enter a valid email address";
    }

    if (formData.contact_phone && !/^[\d\s\-+()]+$/.test(formData.contact_phone)) {
      newErrors.contact_phone = "Please enter a valid phone number";
    }

    if (formData.international_phone && !/^[\d\s\-+()]+$/.test(formData.international_phone)) {
      newErrors.international_phone = "Please enter a valid phone number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const payload: AddCoworkingSpacePayload = {
      name: formData.name,
      city: formData.city,
      state: formData.state,
      district: formData.district || undefined,
      pincode: formData.pincode || undefined,
      country: formData.country || undefined,
      address: formData.address || undefined,
      contact_phone: formData.contact_phone || undefined,
      international_phone: formData.international_phone || undefined,
      generic_email: formData.generic_email || undefined,
      operator_name: formData.operator_name || undefined,
      campus_brand: formData.campus_brand || undefined,
      legal_entity: formData.legal_entity || undefined,
      campus_size_hint: formData.campus_size_hint || undefined,
      status: formData.status || undefined,
    };

    onAddCoworkingSpace(payload);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Coworking Space</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>

              <div>
                <Label htmlFor="name">Coworking Space Name <span className="text-red-500">*</span></Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Enter coworking space name"
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
              </div>

              <div>
                <Label htmlFor="operator_name">Operator Name</Label>
                <Input
                  id="operator_name"
                  value={formData.operator_name}
                  onChange={(e) => handleInputChange("operator_name", e.target.value)}
                  placeholder="Enter operator name"
                />
              </div>

              <div>
                <Label htmlFor="campus_brand">Campus Brand</Label>
                <Input
                  id="campus_brand"
                  value={formData.campus_brand}
                  onChange={(e) => handleInputChange("campus_brand", e.target.value)}
                  placeholder="Enter campus brand"
                />
              </div>

              <div>
                <Label htmlFor="legal_entity">Legal Entity</Label>
                <Input
                  id="legal_entity"
                  value={formData.legal_entity}
                  onChange={(e) => handleInputChange("legal_entity", e.target.value)}
                  placeholder="Enter legal entity name"
                />
              </div>

              <div>
                <Label htmlFor="campus_size_hint">Campus Size</Label>
                <Input
                  id="campus_size_hint"
                  value={formData.campus_size_hint}
                  onChange={(e) => handleInputChange("campus_size_hint", e.target.value)}
                  placeholder="e.g., 10,000 sq ft"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Location Information</h3>

              <div>
                <Label htmlFor="state">State <span className="text-red-500">*</span></Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => handleInputChange("state", e.target.value)}
                  placeholder="Enter state"
                  className={errors.state ? "border-red-500" : ""}
                />
                {errors.state && <p className="text-sm text-red-500 mt-1">{errors.state}</p>}
              </div>

              <div>
                <Label htmlFor="city">City <span className="text-red-500">*</span></Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleInputChange("city", e.target.value)}
                  placeholder="Enter city"
                  className={errors.city ? "border-red-500" : ""}
                />
                {errors.city && <p className="text-sm text-red-500 mt-1">{errors.city}</p>}
              </div>

              <div>
                <Label htmlFor="district">District</Label>
                <Input
                  id="district"
                  value={formData.district}
                  onChange={(e) => handleInputChange("district", e.target.value)}
                  placeholder="Enter district"
                />
              </div>

              <div>
                <Label htmlFor="pincode">Pincode</Label>
                <Input
                  id="pincode"
                  value={formData.pincode}
                  onChange={(e) => handleInputChange("pincode", e.target.value)}
                  placeholder="Enter pincode"
                />
              </div>

              <div>
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => handleInputChange("country", e.target.value)}
                  placeholder="Enter country"
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => handleInputChange("address", e.target.value)}
              placeholder="Enter full address"
              rows={3}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Contact Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contact_phone">Contact Phone</Label>
                <Input
                  id="contact_phone"
                  value={formData.contact_phone}
                  onChange={(e) => handleInputChange("contact_phone", e.target.value)}
                  placeholder="Enter contact phone"
                  className={errors.contact_phone ? "border-red-500" : ""}
                />
                {errors.contact_phone && <p className="text-sm text-red-500 mt-1">{errors.contact_phone}</p>}
              </div>

              <div>
                <Label htmlFor="international_phone">International Phone</Label>
                <Input
                  id="international_phone"
                  value={formData.international_phone}
                  onChange={(e) => handleInputChange("international_phone", e.target.value)}
                  placeholder="Enter international phone"
                  className={errors.international_phone ? "border-red-500" : ""}
                />
                {errors.international_phone && <p className="text-sm text-red-500 mt-1">{errors.international_phone}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="generic_email">Email</Label>
              <Input
                id="generic_email"
                type="email"
                value={formData.generic_email}
                onChange={(e) => handleInputChange("generic_email", e.target.value)}
                placeholder="Enter email address"
                className={errors.generic_email ? "border-red-500" : ""}
              />
              {errors.generic_email && <p className="text-sm text-red-500 mt-1">{errors.generic_email}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => handleInputChange("status", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {COWORKING_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Adding..." : "Add Coworking Space"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
