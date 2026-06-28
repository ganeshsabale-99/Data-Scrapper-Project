import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router';
import { CompanyDetails } from './CompanyDetails';
import { Dialog, DialogContent } from '../../components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { GupioOverlayLoader } from '../../components/ui/gupio-loader';
import { toast } from 'sonner';
import { techParkService } from '@/services/techParkService';
import { AddCompanyDialog } from '@/components/add-company-dialog/AddCompanyDialog';
import { useQueryClient } from '@tanstack/react-query';
import { techParkKeys } from '@/hooks/use-tech-park-queries';
import { useRoleAccess } from '@/hooks/use-role-access';

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

type CompanyRecord = {
  id: string;
  name?: string;
  address?: string;
  website?: string;
  operator?: string;
  description?: string;
  rating?: number;
  total_ratings?: number;
  business_status?: string;
  phone?: string;
  contact_phone?: string;
  map_url?: string;
  opening_hours?: string[] | string;
  locationLat?: number | string;
  locationLng?: number | string;
  contact_email?: string;
  contact_international_phone?: string;
  city?: string;
  createdAt: string;
  updatedAt: string;
};

type CompanyFormState = {
  id: string;
  name: string;
  address: string;
  website: string;
  operator: string;
  description: string;
  rating: number;
  total_ratings: number;
  business_status: string;
  phone: string;
  map_url: string;
  opening_hours: string;
  locationLat: string | number;
  locationLng: string | number;
  contact_email: string;
  contact_phone: string;
  contact_international_phone: string;
  city: string;
};

type CompanyByIdResponse = {
  success?: boolean;
  data?: CompanyRecord;
  message?: string;
};

type UpdateCompanyPayload = Parameters<typeof techParkService.updateCompany>[1] & {
  opening_hours?: string[];
};

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
  const result = String(value).trim();
  if (!result || result === "N/A") return undefined;
  return result;
};

const toNumberValue = (value: unknown): number | undefined => {
  const strValue = toTrimmedString(value);
  if (!strValue) return undefined;
  const numeric = Number(strValue);
  return Number.isNaN(numeric) ? undefined : numeric;
};

export function CompanyDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { isAdmin, isSalesManager } = useRoleAccess();
  const { companyId } = useParams();
  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [newCompany, setNewCompany] = useState<CompanyFormState>({
    id: "",
    name: "",
    address: "",
    website: "",
    operator: "",
    description: "",
    rating: 0,
    total_ratings: 0,
    business_status: "NOT_CONTACTED",
    phone: "",
    map_url: "",
    opening_hours: "",
    locationLat: "",
    locationLng: "",
    contact_email: "",
    contact_phone: "",
    contact_international_phone: "",
    city: "",
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
        setError('Company ID is required');
        return;
      }

      const response = await techParkService.getCompanyById(companyId) as CompanyByIdResponse;

      if (response.success && response.data) {
        setCompany(response.data);
      } else {
        setError(response.message || 'Failed to load company data');
      }
    } catch (err: unknown) {
      if (getApiStatus(err) === 404) {
        setError('Company not found');
      } else {
        setError(getApiErrorMessage(err, 'Failed to connect to server'));
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
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        triggerRefresh();
      }
    };
    window.addEventListener("focus", triggerRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", triggerRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [companyId]);

  useEffect(() => {
    const locationState = location.state as { editMode?: boolean } | null;
    if (locationState?.editMode && company) {
      handleEdit(company);
    }
  }, [company, location.state]);

  const handleBack = () => {
    navigate(-1);
  };

  const handleEdit = async (companyData: CompanyRecord) => {
    try {
      setEditingCompanyId(companyData.id);
      setNewCompany({
        id: companyData.id || "",
        name: companyData.name || "",
        address: companyData.address || "",
        website: companyData.website || "",
        operator: companyData.operator || "",
        description: companyData.description || "",
        rating: companyData.rating ?? 0,
        total_ratings: companyData.total_ratings ?? 0,
        business_status: companyData.business_status || "NOT_CONTACTED",
        phone: companyData.contact_phone || companyData.phone || "",
        map_url: companyData.map_url || "",
        opening_hours: Array.isArray(companyData.opening_hours) ? companyData.opening_hours.join(", ") : (companyData.opening_hours || ""),
        locationLat: companyData.locationLat ?? "",
        locationLng: companyData.locationLng ?? "",
        contact_email: companyData.contact_email || "",
        contact_phone: companyData.contact_phone || "",
        contact_international_phone: companyData.contact_international_phone || "",
        city: companyData.city || "",
      });
    } finally {
      setIsEditDialogOpen(true);
    }
  };

  const handleEditCompany = async (formData?: CompanyFormState) => {
    if (!editingCompanyId) return;
    try {
      setIsEditingCompany(true);
      setError(null);

      const dataToUse = formData || newCompany;

      const payload: UpdateCompanyPayload = {
        name: String(dataToUse.name).trim(),
        address: String(dataToUse.address).trim(),
      };

      const website = toTrimmedString(dataToUse.website);
      if (website) payload.website = website;

      const description = toTrimmedString(dataToUse.description);
      if (description) payload.description = description;

      const operator = toTrimmedString(dataToUse.operator);
      if (operator) payload.operator = operator;

      const contactPhone = toTrimmedString(dataToUse.contact_phone || dataToUse.phone);
      if (contactPhone) payload.contact_phone = contactPhone;

      const contactEmail = toTrimmedString(dataToUse.contact_email);
      if (contactEmail) payload.contact_email = contactEmail;

      const contactInternationalPhone = toTrimmedString(dataToUse.contact_international_phone);
      if (contactInternationalPhone) payload.contact_international_phone = contactInternationalPhone;

      const mapUrl = toTrimmedString(dataToUse.map_url);
      if (mapUrl) payload.map_url = mapUrl;

      const city = toTrimmedString(dataToUse.city);
      if (city) payload.city = city;

      const rating = toNumberValue(dataToUse.rating);
      if (rating !== undefined) payload.rating = rating;

      const totalRatings = toNumberValue(dataToUse.total_ratings);
      if (totalRatings !== undefined) payload.total_ratings = totalRatings;

      const openingArray = String(dataToUse.opening_hours || "")
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      payload.opening_hours = openingArray;

      const locationLat = toNumberValue(dataToUse.locationLat);
      if (locationLat !== undefined) payload.locationLat = locationLat;

      const locationLng = toNumberValue(dataToUse.locationLng);
      if (locationLng !== undefined) payload.locationLng = locationLng;

      const businessStatus = toTrimmedString(dataToUse.business_status);
      if (businessStatus) payload.business_status = businessStatus;
      
      await techParkService.updateCompany(editingCompanyId, payload);
      setIsEditDialogOpen(false);
      await loadCompanyData();
      queryClient.invalidateQueries({ queryKey: techParkKeys.all });
      toast.success('Company updated successfully!');
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, 'Failed to update company');
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsEditingCompany(false);
    }
  };

  const handleChangeStatus = async (companyId: string, status: string) => {
    try {
      await techParkService.changeCompanyStatus(companyId, status);
      await loadCompanyData();
      queryClient.invalidateQueries({ queryKey: techParkKeys.all });
      toast.success(`Status changed to ${status}`);
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, 'Failed to change status');
      toast.error(errorMsg);
    }
  };

  const handleDelete = (companyData: CompanyRecord) => {
    setCompany(companyData);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!company?.id) return;
    try {
      setIsDeleting(true);
      await techParkService.deleteCompany(company.id);
      queryClient.invalidateQueries({ queryKey: techParkKeys.all });
      
      toast.success("Company deleted successfully!");
      
      setIsDeleteDialogOpen(false);
      navigate(-1);
    } catch (err: unknown) {
      const apiError = getApiErrorMessage(err, 'Failed to delete company');
      setError(apiError);
      toast.error(apiError);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <GupioOverlayLoader text="Loading company details..." />
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Error Loading Company</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={handleBack} className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
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
          <Button onClick={handleBack} className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <CompanyDetails
        company={company}
        onBack={handleBack}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onChangeStatus={handleChangeStatus}
        canEdit={canManageCompany}
        canChangeStatus={canManageCompany}
        canDelete={canDeleteCompany}
      />

      {/* Edit Dialog */}
      <AddCompanyDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        company={newCompany}
        setCompany={setNewCompany}
        handleAddCompany={handleEditCompany}
        resetForm={() => {}}
        isLoading={isEditingCompany}
      />

      {/* Delete Dialog */}
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
                {company?.name || 'this company'}
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
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 
