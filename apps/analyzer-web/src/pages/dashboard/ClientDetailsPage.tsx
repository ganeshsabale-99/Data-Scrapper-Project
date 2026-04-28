import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ClientDetails } from './ClientDetails';
import { Dialog, DialogContent } from '../../components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { GupioOverlayLoader } from '../../components/ui/gupio-loader';
import { toast } from 'sonner';
import { techParkService } from '@/services/techParkService';
import { AddLocationDialog } from '@/components/add-location-dialog/AddLocationDialog';
import { useQueryClient } from '@tanstack/react-query';
import { techParkKeys } from '@/hooks/use-tech-park-queries';

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

type ClientPageRecord = {
  id: string;
  name?: string;
  phone?: string;
  internationalPhone?: string;
  email?: string;
  address?: string;
  website?: string;
  rating?: number;
  business_status?: string;
  city?: string;
  description?: string;
  opening_hours?: string[];
  types?: string[];
  operator?: string;
  total_ratings?: number;
  plus_code?: string;
  map_url?: string;
  photo_reference?: string;
  locationLat?: number | null;
  locationLng?: number | null;
  createdAt: string;
  updatedAt: string;
};

type ClientFormState = {
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
  status: string;
};

type TechParkByIdRecord = {
  id: string;
  name?: string;
  address_line1?: string;
  address_line2?: string;
  locality?: string;
  reception_phone?: string;
  international_phone?: string;
  generic_email?: string;
  website?: string;
  rating?: number;
  status?: string;
  city?: string;
  challenges?: string;
  types?: string[];
  operator_name?: string;
  operator?: string;
  total_ratings?: number;
  plus_code?: string;
  map_url?: string;
  photo_reference?: string;
  lat?: number;
  lng?: number;
  createdAt?: string;
  updatedAt?: string;
  phone?: string;
  address?: string;
  opening_hours?: string[] | string;
  description?: string;
  locationLat?: number | string;
  locationLng?: number | string;
};

type TechParkByIdResponse = {
  success?: boolean;
  data?: TechParkByIdRecord;
  error?: string;
};

type ClientEditPayload = Parameters<typeof techParkService.editTechPark>[1] & {
  opening_hours?: string[];
  total_ratings?: number;
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
  return result ? result : undefined;
};

const toNumberValue = (value: unknown): number | undefined => {
  const trimmed = toTrimmedString(value);
  if (!trimmed) return undefined;
  const numeric = Number(trimmed);
  return Number.isNaN(numeric) ? undefined : numeric;
};

export function ClientDetailsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { clientId } = useParams();
  const [client, setClient] = useState<ClientPageRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [newLocation, setNewLocation] = useState<ClientFormState>({
    id: "",
    name: "",
    address: "",
    website: "",
    operator: "",
    description: "",
    rating: 0,
    total_ratings: 0,
    business_status: "OPERATIONAL",
    phone: "",
    map_url: "",
    opening_hours: "",
    locationLat: "",
    locationLng: "",
    status: "NOT_CONTACTED",
  });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadClientData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (clientId) {
        try {
          const response = await techParkService.getTechParkById(clientId) as TechParkByIdResponse;

          if (response.success && response.data) {
            const apiClientData = response.data;

            const enhancedClientData: ClientPageRecord = {
              id: apiClientData.id,
              name: apiClientData.name || 'Unknown Company',
              address: [apiClientData.address_line1, apiClientData.address_line2, apiClientData.locality].filter(Boolean).join(', ') || 'N/A',
              phone: apiClientData.reception_phone || apiClientData.international_phone || 'N/A',
              email: apiClientData.generic_email || 'N/A',
              website: apiClientData.website || 'N/A',
              rating: typeof apiClientData.rating === "number" ? apiClientData.rating : undefined,
              business_status: apiClientData.status || 'N/A',
              city: apiClientData.city || 'N/A',
              description: apiClientData.challenges || 'N/A',
              opening_hours: [],
              types: apiClientData.types || [],
              operator: apiClientData.operator_name || 'N/A',
              total_ratings: apiClientData.total_ratings || 0,
              plus_code: apiClientData.plus_code || 'N/A',
              map_url: apiClientData.map_url || 'N/A',
              photo_reference: apiClientData.photo_reference || 'N/A',
              locationLat: apiClientData.lat || null,
              locationLng: apiClientData.lng || null,
              internationalPhone: apiClientData.international_phone || 'N/A',
              createdAt: apiClientData.createdAt || new Date().toISOString(),
              updatedAt: apiClientData.updatedAt || new Date().toISOString(),
            };

            setClient(enhancedClientData);
          } else {
            setError(response.error || 'Failed to load client data');
          }
        } catch (apiError: unknown) {
          if (getApiStatus(apiError) === 404) {
            setError('Client not found');
          } else {
            setError(getApiErrorMessage(apiError, 'Failed to connect to server'));
          }
        }
      } else {
        setError('No client data available');
      }
    } catch {
      setError('Failed to load client data');
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void loadClientData();
  }, [loadClientData]);

  const handleBack = () => {
    const previousPage = sessionStorage.getItem('previousPage');
    
    if (previousPage === 'mock-details') {
      const mockLocationParams = sessionStorage.getItem('mockLocationParams');
      if (mockLocationParams) {
        const { state, city, id } = JSON.parse(mockLocationParams);
        navigate(`/dashboard/mock-techparks/${state}/${city}/${id}`);
        sessionStorage.removeItem('previousPage');
        sessionStorage.removeItem('mockLocationParams');
      } else {
        navigate('/dashboard/mock-demo');
      }
    } else {
      const storedCity = sessionStorage.getItem('currentCity');
      if (storedCity) {
        navigate(`/dashboard?city=${storedCity.toLowerCase()}`);
        sessionStorage.removeItem('currentCity');
      } else {
        navigate('/dashboard');
      }
    }
  };

  const handleEdit = async (clientData: ClientPageRecord) => {
    try {
      const response = await techParkService.getTechParkById(clientData.id) as TechParkByIdResponse;
      const tp: TechParkByIdRecord = response?.data ?? {
        id: clientData.id,
        name: clientData.name,
        address: clientData.address,
        website: clientData.website,
        operator: clientData.operator,
        description: clientData.description,
        rating: clientData.rating,
        map_url: clientData.map_url,
        city: clientData.city,
        opening_hours: clientData.opening_hours,
        locationLat: clientData.locationLat ?? undefined,
        locationLng: clientData.locationLng ?? undefined,
      };
      setEditingLocationId(tp.id);
      setNewLocation({
        id: tp.id || "",
        name: tp.name || "",
        address: tp.address_line1 || tp.address || "",
        website: tp.website || "",
        operator: tp.operator_name || tp.operator || "",
        description: tp.challenges || tp.description || "",
        rating: tp.rating ?? 0,
        total_ratings: tp.total_ratings ?? 0,
        business_status: tp.status || "OPERATIONAL",
        phone: tp.reception_phone || tp.phone || "",
        map_url: tp.map_url || "",
        opening_hours: Array.isArray(tp.opening_hours) ? tp.opening_hours.join(", ") : (tp.opening_hours || ""),
        locationLat: tp.lat ?? tp.locationLat ?? "",
        locationLng: tp.lng ?? tp.locationLng ?? "",
        status: tp.status || "NOT_CONTACTED",
      });
    } finally {
      setIsEditDialogOpen(true);
    }
  };

  const handleEditLocation = async () => {
    if (!editingLocationId) return;
    try {
      setIsEditingLocation(true);
      setError(null);

      const payload: ClientEditPayload = {
        name: String(newLocation.name).trim(),
        address_line1: String(newLocation.address).trim(),
      };

      const website = toTrimmedString(newLocation.website);
      if (website) payload.website = website;

      const challenges = toTrimmedString(newLocation.description);
      if (challenges) payload.challenges = challenges;

      const receptionPhone = toTrimmedString(newLocation.phone);
      if (receptionPhone) payload.reception_phone = receptionPhone;

      const mapUrl = toTrimmedString(newLocation.map_url);
      if (mapUrl) payload.map_url = mapUrl;

      const rating = toNumberValue(newLocation.rating);
      if (rating !== undefined) payload.rating = rating;

      const totalRatings = toNumberValue(newLocation.total_ratings);
      if (totalRatings !== undefined) payload.total_ratings = totalRatings;

      const openingArray = String(newLocation.opening_hours || "")
        .split(/[\n,]+/)
        .map((entry) => entry.trim())
        .filter(Boolean);
      payload.opening_hours = openingArray;

      const lat = toNumberValue(newLocation.locationLat);
      if (lat !== undefined) payload.lat = lat;

      const lng = toNumberValue(newLocation.locationLng);
      if (lng !== undefined) payload.lng = lng;

      const status = toTrimmedString(newLocation.status);
      if (status) payload.status = status;

      await techParkService.editTechPark(editingLocationId, payload);
      setIsEditDialogOpen(false);
      await loadClientData();
      queryClient.invalidateQueries({ queryKey: techParkKeys.all });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to update client'));
    } finally {
      setIsEditingLocation(false);
    }
  };

  const handleDelete = (clientData: ClientPageRecord) => {
    setClient(clientData);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!client?.id) return;
    try {
      setIsDeleting(true);
      await techParkService.deleteTechPark(client.id);
      queryClient.invalidateQueries({ queryKey: techParkKeys.all });
      
      toast.success("Tech park deleted successfully!");
      
      setIsDeleteDialogOpen(false);
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('_refresh', Date.now().toString());
      navigate(`/dashboard${currentUrl.search}`, { replace: true });
    } catch (err: unknown) {
      const apiError = getApiErrorMessage(err, 'Failed to delete client');
      setError(apiError);
      toast.error(apiError);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <GupioOverlayLoader text="Loading client details..." />
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Error Loading Client</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={handleBack} className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Client Not Found</h2>
          <p className="text-muted-foreground mb-4">The client you're looking for doesn't exist.</p>
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
      <ClientDetails
        client={client}
        onBack={handleBack}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <AddLocationDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        newLocation={newLocation}
        setNewLocation={setNewLocation}
        handleAddLocation={handleEditLocation}
        resetForm={() => {}}
        isSubmitting={isEditingLocation}
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
              This action will permanently remove the selected tech park and cannot be undone.
            </p>
            <div className="mt-2">
              <span className="inline-block px-4 py-2 rounded-md bg-destructive/10 text-destructive font-bold text-xl sm:text-2xl">
                {client?.name || 'this tech park'}
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
