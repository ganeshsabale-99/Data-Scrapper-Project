import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import { CompanyDetails } from "./CompanyDetails";
import { Dialog, DialogContent } from "../../components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { GupioOverlayLoader } from "../../components/ui/gupio-loader";
import { toast } from "sonner";
import { coworkingSpaceService } from "@/services/coworkingSpaceService";
import { AddCoworkingCompanyDialog } from "@/components/coworking-spaces/AddCoworkingCompanyDialog";
import { useQueryClient } from "@tanstack/react-query";
import { coworkingSpaceKeys } from "@/hooks/use-coworking-space-queries";
import { useRoleAccess } from "@/hooks/use-role-access";

type ApiErrorShape = {
  response?: {
    status?: number;
    data?: {
      error?: string;
      message?: string;
    };
  };
  message?: string;
};

type CoworkingCompanyRecord = {
  id: string;
  name?: string;
  description?: string;
  business_status?: string;
  operator?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_international_phone?: string;
  city?: string;
  phone?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
};

type EditingCompanyState = {
  id?: string;
  name: string;
  description?: string;
  business_status?: string;
  operator?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_international_phone?: string;
};

type CoworkingCompanyByIdResponse = {
  success?: boolean;
  data?: Partial<CoworkingCompanyRecord>;
  message?: string;
};

type UpdateCoworkingCompanyPayload = Parameters<typeof coworkingSpaceService.updateCompany>[1];

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const parsed = error as ApiErrorShape;
  return parsed.response?.data?.error || parsed.response?.data?.message || parsed.message || fallback;
};

const getApiStatus = (error: unknown): number | undefined => {
  const parsed = error as ApiErrorShape;
  return parsed.response?.status;
};

const toTrimmedString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const output = String(value).trim();
  return output || undefined;
};

export function CoworkingCompanyDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { isAdmin, isSalesManager } = useRoleAccess();
  const { companyId } = useParams();
  const [company, setCompany] = useState<CoworkingCompanyRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingCompany, setEditingCompany] = useState<EditingCompanyState>({
    id: "",
    name: "",
    description: "",
    business_status: "NOT_CONTACTED",
    operator: "",
    contact_phone: "",
    contact_email: "",
    contact_international_phone: "",
  });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const canManageCompany = isAdmin || isSalesManager;
  const canDeleteCompany = isAdmin;

  const loadCompanyData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!companyId) {
        setError("Company ID is required");
        return;
      }

      const response = await coworkingSpaceService.getCompanyById(companyId) as CoworkingCompanyByIdResponse;

      if (response.success && response.data) {
        const data = response.data;
        setCompany({
          id: data.id || companyId,
          name: data.name || "",
          description: data.description || "",
          business_status: data.business_status || "NOT_CONTACTED",
          operator: data.operator || "",
          contact_phone: data.contact_phone || "",
          contact_email: data.contact_email || "",
          contact_international_phone: data.contact_international_phone || "",
          city: data.city || "",
          phone: data.contact_phone || data.contact_international_phone || "",
          address: data.description || "",
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      } else {
        setError(response.message || "Failed to load company data");
      }
    } catch (loadError: unknown) {
      if (getApiStatus(loadError) === 404) {
        setError("Company not found");
      } else {
        setError(getApiErrorMessage(loadError, "Failed to connect to server"));
      }
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadCompanyData();
  }, [loadCompanyData, refreshTick]);

  useEffect(() => {
    if (!companyId) return;
    const triggerRefresh = () => setRefreshTick((v) => v + 1);
    const intervalId = window.setInterval(triggerRefresh, 30 * 1000);
    window.addEventListener("focus", triggerRefresh);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", triggerRefresh);
    };
  }, [companyId]);

  useEffect(() => {
    const locationState = location.state as { editMode?: boolean } | null;
    if (locationState?.editMode && company) {
      void handleEdit(company);
    }
  }, [company, location.state]);

  const handleBack = () => {
    navigate(-1);
  };

  const handleEdit = async (companyData: CoworkingCompanyRecord) => {
    try {
      setEditingCompanyId(companyData.id);
      setEditingCompany({
        id: companyData.id || "",
        name: companyData.name || "",
        description: companyData.description || "",
        business_status: companyData.business_status || "NOT_CONTACTED",
        operator: companyData.operator || "",
        contact_phone: companyData.contact_phone || "",
        contact_email: companyData.contact_email || "",
        contact_international_phone: companyData.contact_international_phone || "",
      });
    } finally {
      setIsEditDialogOpen(true);
    }
  };

  const handleEditCompany = async (formData?: EditingCompanyState) => {
    if (!editingCompanyId) return;
    try {
      setIsEditingCompany(true);
      setError(null);

      const dataToUse = formData || editingCompany;
      const payload: UpdateCoworkingCompanyPayload = {
        name: String(dataToUse.name || "").trim(),
      };

      const description = toTrimmedString(dataToUse.description);
      if (description) payload.description = description;

      const operator = toTrimmedString(dataToUse.operator);
      if (operator) payload.operator = operator;

      const contactPhone = toTrimmedString(dataToUse.contact_phone);
      if (contactPhone) payload.contact_phone = contactPhone;

      const contactEmail = toTrimmedString(dataToUse.contact_email);
      if (contactEmail) payload.contact_email = contactEmail;

      const internationalPhone = toTrimmedString(dataToUse.contact_international_phone);
      if (internationalPhone) payload.contact_international_phone = internationalPhone;

      const businessStatus = toTrimmedString(dataToUse.business_status);
      if (businessStatus) payload.business_status = businessStatus;

      await coworkingSpaceService.updateCompany(editingCompanyId, payload);
      setIsEditDialogOpen(false);
      await loadCompanyData();
      queryClient.invalidateQueries({ queryKey: coworkingSpaceKeys.all });
      toast.success("Company updated successfully!");
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, "Failed to update company");
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsEditingCompany(false);
    }
  };

  const handleChangeStatus = async (id: string, status: string) => {
    try {
      await coworkingSpaceService.changeCompanyStatus(id, status);
      await loadCompanyData();
      queryClient.invalidateQueries({ queryKey: coworkingSpaceKeys.all });
      toast.success(`Status changed to ${status}`);
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, "Failed to change status");
      toast.error(errorMsg);
    }
  };

  const handleDelete = (companyData: CoworkingCompanyRecord) => {
    setCompany(companyData);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!company?.id) return;
    try {
      setIsDeleting(true);
      await coworkingSpaceService.deleteCompany(company.id);
      queryClient.invalidateQueries({ queryKey: coworkingSpaceKeys.all });

      toast.success("Company deleted successfully!");
      setIsDeleteDialogOpen(false);
      navigate(-1);
    } catch (err: unknown) {
      const apiError = getApiErrorMessage(err, "Failed to delete company");
      setError(apiError);
      toast.error(apiError);
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    setEditingCompany({
      id: "",
      name: "",
      description: "",
      business_status: "NOT_CONTACTED",
      operator: "",
      contact_phone: "",
      contact_email: "",
      contact_international_phone: "",
    });
    setEditingCompanyId(null);
  };

  if (isLoading) {
    return <GupioOverlayLoader text="Loading company details..." />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Error Loading Company</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Company Not Found</h2>
          <p className="text-muted-foreground mb-4">The company you're looking for doesn't exist.</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <CompanyDetails
        company={company}
        companyType="coworking"
        onBack={handleBack}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onChangeStatus={handleChangeStatus}
        canEdit={canManageCompany}
        canChangeStatus={canManageCompany}
        canDelete={canDeleteCompany}
      />

      <AddCoworkingCompanyDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        company={editingCompany}
        setCompany={(next) => setEditingCompany(next)}
        handleAddCompany={(companyData) => {
          void handleEditCompany(companyData);
        }}
        resetForm={resetForm}
        isLoading={isEditingCompany}
      />

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="min-h-[240px] sm:min-h-[260px] p-6 sm:p-8">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Are you sure want to delete
            </h3>
            <p className="text-muted-foreground text-sm sm:text-base max-w-md">
              This action will permanently remove the selected company and cannot be undone.
            </p>
            <div className="mt-2">
              <span className="inline-block px-4 py-2 rounded-md bg-destructive/10 text-destructive font-bold text-xl sm:text-2xl">
                {company?.name || "this company"}
              </span>
            </div>
          </div>
          <div className="mt-6 flex w-full items-center justify-center gap-3 sm:gap-4">
            <Button
              variant="outline"
              onClick={() => {
                if (!isDeleting) {
                  setIsDeleteDialogOpen(false);
                }
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
