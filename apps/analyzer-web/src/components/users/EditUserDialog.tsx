import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  fetchAdminRoleOptions,
  type AdminRoleOption,
  type AdminUserDto,
} from "@/services/usersService";
import { useCityCatalogOptions } from "@/hooks/use-city-catalog-options";

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUserDto | null;
  onSubmit: (updated: Partial<AdminUserDto>) => Promise<void> | void;
  isSubmitting?: boolean;
}

export function EditUserDialog({ open, onOpenChange, user, onSubmit, isSubmitting = false }: EditUserDialogProps) {
  const [form, setForm] = useState<Partial<AdminUserDto>>({});
  const [roleOptions, setRoleOptions] = useState<AdminRoleOption[]>([]);
  const [isRoleOptionsLoading, setIsRoleOptionsLoading] = useState(false);
  const [roleOptionsError, setRoleOptionsError] = useState<string | null>(null);
  const { catalog, isLoading: isLocationCatalogLoading } = useCityCatalogOptions();

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        email: user.email || "",
        phoneNumber:
          user.phoneNumber && !user.phoneNumber.toLowerCase().startsWith("mail:")
            ? user.phoneNumber
            : "",
        role: user.role || "",
        roleId: user.roleId || user.requestedRole || "",
        city: user.city || "",
        state: user.state || "",
        isActive: user.isActive,
      });
    }
  }, [user]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setIsRoleOptionsLoading(true);
    setRoleOptionsError(null);
    fetchAdminRoleOptions()
      .then((options) => {
        if (!active) return;
        setRoleOptions(options);
        if (options.length === 0) {
          setRoleOptionsError("No roles available");
        }
      })
      .catch(() => {
        if (!active) return;
        setRoleOptions([]);
        setRoleOptionsError("Unable to load roles");
      })
      .finally(() => {
        if (!active) return;
        setIsRoleOptionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!user || !roleOptions.length) return;
    if (form.roleId) return;
    const matched =
      roleOptions.find((option) => option.id === user.roleId) ||
      roleOptions.find((option) => option.id === user.requestedRole) ||
      roleOptions.find((option) => option.legacyRole === user.role) ||
      null;
    if (matched) {
      setForm((prev) => ({ ...prev, roleId: matched.id }));
    }
  }, [form.roleId, roleOptions, user]);

  const setField = <K extends keyof AdminUserDto>(key: K, value: AdminUserDto[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const stateOptions = useMemo(() => {
    const selectedState = (form.state as string) || "";
    if (selectedState && !catalog.states.includes(selectedState)) {
      return [selectedState, ...catalog.states];
    }
    return catalog.states;
  }, [catalog.states, form.state]);

  const cityOptions = useMemo(() => {
    const selectedCity = (form.city as string) || "";
    const options = catalog.allCities ?? [];
    if (selectedCity && !options.includes(selectedCity)) {
      return [selectedCity, ...options];
    }
    return options;
  }, [catalog.allCities, form.city]);

  const handleSubmit = async () => {
    await onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <div className="space-y-6">
          <h3 className="text-xl font-semibold">Edit User</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
              <Input id="name" value={form.name || ""} onChange={(e) => setField("name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
              <Input id="email" type="email" value={form.email || ""} onChange={(e) => setField("email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" value={form.phoneNumber || ""} onChange={(e) => setField("phoneNumber", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Role <span className="text-red-500">*</span></Label>
              <Select
                value={(form.roleId as string) || undefined}
                onValueChange={(v) => setField("roleId", v)}
                disabled={isRoleOptionsLoading}
              >
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {roleOptionsError ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">{roleOptionsError}</div>
                  ) : null}
                  {roleOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City <span className="text-red-500">*</span></Label>
              <Select
                value={(form.city as string) || undefined}
                onValueChange={(value) => setField("city", value)}
                disabled={isLocationCatalogLoading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={isLocationCatalogLoading ? "Loading cities..." : "Select city"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {cityOptions.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State <span className="text-red-500">*</span></Label>
              <Select
                value={(form.state as string) || undefined}
                onValueChange={(nextState) => setField("state", nextState)}
                disabled={isLocationCatalogLoading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={isLocationCatalogLoading ? "Loading states..." : "Select state"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {stateOptions.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status <span className="text-red-500">*</span></Label>
              <Select value={String(!!form.isActive)} onValueChange={(v) => setField("isActive", v === 'true')}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save changes'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
