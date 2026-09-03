import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { Building2, Users, ArrowLeft } from "lucide-react";
import { AddCoworkingCompanyDialog } from "@/components/coworking-spaces/AddCoworkingCompanyDialog";
import { ChartContainer } from "@/components/charts/chart-containers";
import { Pagination } from "@/components/pagination/Pagination";
import { LocationTable } from "./LocationTable";
import { coworkingSpaceService } from "@/services/coworkingSpaceService";
import { useParams, useNavigate } from "react-router";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, MapPin, Edit, ExternalLink } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { coworkingSpaceKeys } from "@/hooks/use-coworking-space-queries";
import { useRoleAccess } from "@/hooks/use-role-access";
import { AddLocationDialog } from "@/components/add-location-dialog/AddLocationDialog";
import { statuses } from "@/const/contact-status";
import type { LucideIcon } from "lucide-react";
import { PlacesReviews } from "@/components/places-reviews/PlacesReviews";
import { ParkingComplaintsReviews } from "@/components/places-reviews/ParkingComplaintsReviews";
import { ReviewIssuePriority } from "@/components/places-reviews/ReviewIssuePriority";
import { StoredVenueReviews } from "@/components/places-reviews/StoredVenueReviews";

type ApiErrorShape = {
  response?: {
    data?: {
      message?: string;
      error?: string;
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
  serialNumber?: number;
};

type CompanyDraftState = {
  id?: string;
  name: string;
  description?: string;
  business_status?: string;
  operator?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_international_phone?: string;
};

type CoworkingSpaceRecord = {
  id: string;
  name?: string;
  address?: string;
  district?: string;
  city?: string;
  state?: string;
  pincode?: string;
  website?: string;
  contact_phone?: string;
  generic_email?: string;
  builder_name?: string;
  security_agency_name?: string;
  property_manager_name?: string;
  property_manager_phone?: string;
  property_manager_email?: string;
  spoc_name?: string;
  spoc_phone?: string;
  seating_capacity?: number;
  challenges?: string;
  total_floors?: number;
  parking_floors?: number;
  basement_levels?: number;
  lat?: number | null;
  lng?: number | null;
  status?: string;
  rating?: number | string;
  total_ratings?: number | string;
  exterior_media_url?: string;
  exterior_media_urls?: string[];
  map_url?: string;
  createdAt?: string;
  updatedAt?: string;
  phone?: string;
  coordinates?: string;
  review_issue_score?: number;
  review_priority?: string;
  review_issue_categories?: string[];
  review_issue_summary?: string;
  reviews_analyzed?: number;
  issue_review_count?: number;
  parking_review_count?: number;
  review_analyzed_at?: string;
};

type CompanyStats = {
  totalCompanies: number;
  contactedCompanies: number;
  positiveResponses: number;
  responseRate: number;
};

type CompanyListResponse = {
  data?: {
    stats?: CompanyStats;
    statusBreakdown?: Partial<Record<
      "NOT_CONTACTED" | "CONTACTED" | "INTERESTED" | "MEETING_SCHEDULED" | "PROPOSAL_SENT" | "IN_PROGRESS" | "CLOSED",
      number
    >>;
    items?: CoworkingCompanyRecord[];
    pagination?: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      pageSize: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  };
};

type CoworkingSpaceResponse = {
  success?: boolean;
  data?: CoworkingSpaceRecord;
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const parsed = error as ApiErrorShape;
  return parsed.response?.data?.message || parsed.response?.data?.error || parsed.message || fallback;
};

export default function CoworkingSpaceDetailsPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isSalesManager } = useRoleAccess();
  const id = params.id;
  const [coworkingSpace, setCoworkingSpace] = useState<CoworkingSpaceRecord | null>(null);
  const [companies, setCompanies] = useState<CoworkingCompanyRecord[]>([]);
  const [stats, setStats] = useState<CompanyStats>({ totalCompanies: 0, contactedCompanies: 0, positiveResponses: 0, responseRate: 0 });
  const [statusBreakdown, setStatusBreakdown] = useState<{ NOT_CONTACTED: number; CONTACTED: number; INTERESTED: number; MEETING_SCHEDULED: number; PROPOSAL_SENT: number; IN_PROGRESS: number; CLOSED: number }>({ NOT_CONTACTED: 0, CONTACTED: 0, INTERESTED: 0, MEETING_SCHEDULED: 0, PROPOSAL_SENT: 0, IN_PROGRESS: 0, CLOSED: 0 });
  const [, setLoading] = useState<boolean>(false);
  const [companiesLoading, setCompaniesLoading] = useState<boolean>(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [pagination, setPagination] = useState<{
    currentPage: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  }>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    pageSize: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [company, setCompany] = useState<CompanyDraftState>({
    name: "",
    description: "",
    business_status: "NOT_CONTACTED",
    operator: "",
    contact_phone: "",
    contact_email: "",
    contact_international_phone: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyDraftState>({
    id: "",
    name: "",
    description: "",
    business_status: "NOT_CONTACTED",
    operator: "",
    contact_phone: "",
    contact_email: "",
    contact_international_phone: "",
  });
  const handleBack = () => {
    navigate(-1);
  };

  // Delete modal state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingCompany, setDeletingCompany] = useState<CoworkingCompanyRecord | null>(null);

  // Edit Coworking Space Dialog State
  const [isEditCoworkingDialogOpen, setIsEditCoworkingDialogOpen] = useState(false);
  const [isUpdatingCoworking, setIsUpdatingCoworking] = useState(false);
  const [coworkingFormData, setCoworkingFormData] = useState<CoworkingSpaceRecord | null>(null);

  const canManageCoworkingData = isAdmin || isSalesManager;
  const canDeleteCoworkingData = isAdmin;

  useEffect(() => {
    if (!id) return;
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
  }, [id]);

  useEffect(() => {
    const loadCoworkingSpace = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const csResp = await coworkingSpaceService.getCoworkingSpaceById(id);

        if ((csResp as CoworkingSpaceResponse).success) {
          setCoworkingSpace(csResp.data);
        }
      } catch (error: unknown) {
        console.error('Failed to load coworking space:', error);
        const errorMsg = getApiErrorMessage(error, 'Failed to load coworking space');
        toast.error(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    loadCoworkingSpace();
  }, [id, refreshTick]);

  useEffect(() => {
    const loadCompanies = async () => {
      if (!id) return;
      setCompaniesLoading(true);
      try {
        const companiesResp = await coworkingSpaceService.getCompaniesByCoworkingSpace(
          id,
          page,
          pageSize,
          searchTerm || undefined,
        );

        const data = (companiesResp as CompanyListResponse)?.data || {};
        setCompanies(Array.isArray(data.items) ? data.items : []);
        if (data.stats) setStats(data.stats);
        if (data.statusBreakdown) {
          setStatusBreakdown({
            NOT_CONTACTED: data.statusBreakdown.NOT_CONTACTED || 0,
            CONTACTED: data.statusBreakdown.CONTACTED || 0,
            INTERESTED: data.statusBreakdown.INTERESTED || 0,
            MEETING_SCHEDULED: data.statusBreakdown.MEETING_SCHEDULED || 0,
            PROPOSAL_SENT: data.statusBreakdown.PROPOSAL_SENT || 0,
            IN_PROGRESS: data.statusBreakdown.IN_PROGRESS || 0,
            CLOSED: data.statusBreakdown.CLOSED || 0,
          });
        }
        if (data.pagination) setPagination(data.pagination);
      } catch (error: unknown) {
        console.error('Failed to load companies:', error);
        const errorMsg = getApiErrorMessage(error, 'Failed to load companies');
        toast.error(errorMsg);
      } finally {
        setCompaniesLoading(false);
      }
    };

    loadCompanies();
  }, [id, page, pageSize, searchTerm, refreshTick]);

  const chartAnalytics = useMemo(() => {
    // Use server-side statusBreakdown for accurate counts across all companies
    const counts = { ...statusBreakdown };
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0) || 1;
    const percentages = Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Math.round((v / total) * 100)]));
    return { statusCounts: counts, statusPercentages: percentages };
  }, [statusBreakdown]);

  const resetForm = () => {
    setCompany({
      name: "",
      description: "",
      business_status: "NOT_CONTACTED",
      operator: "",
      contact_phone: "",
      contact_email: "",
      contact_international_phone: "",
    });
  };

  const handleAddCompany = async (companyData?: CompanyDraftState) => {
    if (!id || isSubmitting) return; // Prevent multiple calls

    const dataToUse = companyData || company;

    // Validate required fields
    if (!dataToUse.name || dataToUse.name.trim() === '') {
      toast.error('Company name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const resp = await coworkingSpaceService.addCompanyToCoworkingSpace(id, dataToUse);
      const created = resp?.data;
      if (created) {
        // Reload the current page to get updated data from server
        const reloadResp = await coworkingSpaceService.getCompaniesByCoworkingSpace(id, page, pageSize);
        const data = reloadResp?.data || {};
        setCompanies(Array.isArray(data.items) ? data.items : []);
        if (data.stats) setStats(data.stats);
        if (data.pagination) setPagination(data.pagination);
        queryClient.invalidateQueries({ queryKey: coworkingSpaceKeys.all });
        toast.success('Company added successfully!');
      }
      resetForm();
      setIsDialogOpen(false);
    } catch (error: unknown) {
      console.error('Failed to add company:', error);
      const errorMsg = getApiErrorMessage(error, 'Failed to add company');
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewDetails = (company: CoworkingCompanyRecord) => {
    navigate(`/dashboard/coworking-company/${company.id}`);
  };

  const handleEdit = (company: CoworkingCompanyRecord) => {
    setEditingCompany({
      id: company.id,
      name: company.name || "",
      description: company.description || "",
      business_status: company.business_status || "NOT_CONTACTED",
      operator: company.operator || "",
      contact_phone: company.contact_phone || "",
      contact_email: company.contact_email || "",
      contact_international_phone: company.contact_international_phone || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleEditCompany = async (formData?: CompanyDraftState) => {
    if (!editingCompany?.id || isEditingCompany) return; // Prevent multiple calls
    try {
      setIsEditingCompany(true);

      // Use formData if provided, otherwise fall back to editingCompany
      const dataToUse = formData || editingCompany;

      const payload: Parameters<typeof coworkingSpaceService.updateCompany>[1] = {};

      // Required fields - ensure they have values
      payload.name = String(dataToUse.name || '').trim();

      // Optional fields
      if (dataToUse.description !== undefined) payload.description = dataToUse.description;
      if (dataToUse.operator !== undefined) payload.operator = dataToUse.operator;
      if (dataToUse.contact_phone !== undefined) payload.contact_phone = dataToUse.contact_phone;
      if (dataToUse.contact_email !== undefined) payload.contact_email = dataToUse.contact_email;
      if (dataToUse.contact_international_phone !== undefined) payload.contact_international_phone = dataToUse.contact_international_phone;
      if (dataToUse.business_status !== undefined && dataToUse.business_status !== null && dataToUse.business_status !== '') {
        payload.business_status = dataToUse.business_status;
      }

      await coworkingSpaceService.updateCompany(editingCompany.id, payload);
      setIsEditDialogOpen(false);

      // Reload the current page to get updated data from server
      const reloadResp = await coworkingSpaceService.getCompaniesByCoworkingSpace(id!, page, pageSize);
      const data = reloadResp?.data || {};
      setCompanies(Array.isArray(data.items) ? data.items : []);
      if (data.stats) setStats(data.stats);
      if (data.pagination) setPagination(data.pagination);
      queryClient.invalidateQueries({ queryKey: coworkingSpaceKeys.all });

      toast.success('Company updated successfully!');
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, 'Failed to update company');
      toast.error(errorMsg);
    } finally {
      setIsEditingCompany(false);
    }
  };

  const handleChangeStatus = async (company: CoworkingCompanyRecord, status: string) => {
    try {
      await coworkingSpaceService.changeCompanyStatus(company.id, status);

      // Reload the current page to get updated data from server
      const reloadResp = await coworkingSpaceService.getCompaniesByCoworkingSpace(id!, page, pageSize);
      const data = reloadResp?.data || {};
      setCompanies(Array.isArray(data.items) ? data.items : []);
      if (data.stats) setStats(data.stats);
      if (data.pagination) setPagination(data.pagination);
      queryClient.invalidateQueries({ queryKey: coworkingSpaceKeys.all });

      toast.success(`Status changed to ${status}`);
    } catch (error: unknown) {
      console.error('Failed to change status:', error);
      const errorMsg = getApiErrorMessage(error, 'Failed to change status');
      toast.error(errorMsg);
    }
  };

  const handleDelete = async (company: CoworkingCompanyRecord) => {
    setDeletingCompany(company);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingCompany?.id || isDeleting) return; // Prevent multiple calls
    try {
      setIsDeleting(true);
      await coworkingSpaceService.deleteCompany(deletingCompany.id);

      // Reload the current page to get updated data from server
      const reloadResp = await coworkingSpaceService.getCompaniesByCoworkingSpace(id!, page, pageSize);
      const data = reloadResp?.data || {};
      setCompanies(Array.isArray(data.items) ? data.items : []);
      if (data.stats) setStats(data.stats);
      if (data.pagination) setPagination(data.pagination);
      queryClient.invalidateQueries({ queryKey: coworkingSpaceKeys.all });

      toast.success('Company deleted successfully!');
      setIsDeleteDialogOpen(false);
    } catch (error: unknown) {
      console.error('Failed to delete company:', error);
      const errorMsg = getApiErrorMessage(error, 'Failed to delete company');
      toast.error(errorMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditCoworkingClick = () => {
    if (!coworkingSpace) return;
    setCoworkingFormData({
      ...coworkingSpace,
      phone: coworkingSpace.contact_phone,
      coordinates: coworkingSpace.lat && coworkingSpace.lng ? `${coworkingSpace.lat}, ${coworkingSpace.lng}` : '',
    });
    setIsEditCoworkingDialogOpen(true);
  };

  const handleUpdateCoworking = async (updatedData?: CoworkingSpaceRecord) => {
    if (!id || !updatedData || isUpdatingCoworking) return;
    setIsUpdatingCoworking(true);
    try {
      // Map form data back to API payload structure
      const {
        id: _id,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        phone: _phone,
        coordinates: _coordinates,
        ...rest
      } = updatedData;
      const payload = {
        ...rest,
        contact_phone: updatedData.phone,
        lat: updatedData.lat ?? undefined,
        lng: updatedData.lng ?? undefined,
      } as Parameters<typeof coworkingSpaceService.updateCoworkingSpace>[1];

      await coworkingSpaceService.updateCoworkingSpace(id, payload);

      // Refresh Coworking Space Data
      const csResp = await coworkingSpaceService.getCoworkingSpaceById(id);
      if (csResp.success) {
        setCoworkingSpace(csResp.data);
      }
      queryClient.invalidateQueries({ queryKey: coworkingSpaceKeys.all });
      toast.success("Coworking Space updated successfully");
      setIsEditCoworkingDialogOpen(false);
    } catch (error: unknown) {
      console.error("Failed to update coworking space:", error);
      const errorMsg = getApiErrorMessage(error, 'Failed to update coworking space');
      toast.error(errorMsg);
    } finally {
      setIsUpdatingCoworking(false);
    }
  };

  const statCards: Array<{ title: string; value: number; icon: LucideIcon; color: string; bgColor: string }> = [
    { title: 'Total Companies', value: stats.totalCompanies, icon: Building2, color: 'text-blue-600', bgColor: 'bg-blue-100' },
    { title: 'Contacted Companies', value: stats.contactedCompanies, icon: Users, color: 'text-green-600', bgColor: 'bg-green-100' },
  ];

  const displayValue = (value: unknown, fallback = "N/A") => {
    if (value === null || value === undefined) return fallback;
    const asString = String(value).trim();
    return asString.length > 0 ? asString : fallback;
  };

  const withProtocol = (value?: string | null) => {
    const trimmed = (value || "").trim();
    if (!trimmed) return "";
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  const websiteUrl = withProtocol(coworkingSpace?.website);
  const mapUrl = withProtocol(coworkingSpace?.map_url);
  const statusClass = statuses[coworkingSpace?.status as keyof typeof statuses] || "bg-slate-100 text-slate-700";

  // Server-side pagination and search - no need for client-side filtering
  const pagedCompanies = companies;

  return (
    <div className="p-4 space-y-6">
      <div>
        <Button variant="outline" onClick={handleBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Coworking Space Details Section */}
      {coworkingSpace && (
        <Card className="overflow-hidden border-slate-200/70 shadow-sm">
          <div className="bg-gradient-to-r from-slate-50 via-white to-sky-50/60 border-b">
            <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="uppercase tracking-wide">
                    Coworking Space
                  </Badge>
                  <Badge className={statusClass}>{displayValue(coworkingSpace.status)}</Badge>
                </div>
                <CardTitle className="text-2xl leading-tight">{displayValue(coworkingSpace.name)}</CardTitle>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {displayValue(coworkingSpace.address)}, {displayValue(coworkingSpace.district || coworkingSpace.city)}, {displayValue(coworkingSpace.state)}
                </p>
              </div>

              <div className="flex gap-2">
                {canManageCoworkingData ? (
                  <Button variant="outline" size="sm" onClick={handleEditCoworkingClick}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(mapUrl, '_blank')}
                  disabled={!mapUrl}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Map
                </Button>
              </div>
            </CardHeader>
          </div>

          {(coworkingSpace.exterior_media_url || (coworkingSpace.exterior_media_urls && coworkingSpace.exterior_media_urls.length > 0)) && (
            <div className="w-full h-48 sm:h-64 md:h-80 relative bg-slate-100 border-b overflow-hidden">
              <div
                className="absolute inset-0 bg-center bg-cover blur-xl scale-110 opacity-35"
                style={{
                  backgroundImage: `url("${coworkingSpace.exterior_media_url || coworkingSpace.exterior_media_urls?.[0] || ""}")`,
                }}
              />
              <img
                src={coworkingSpace.exterior_media_url || coworkingSpace.exterior_media_urls?.[0]}
                alt={coworkingSpace.name}
                className="relative z-10 w-full h-full object-contain"
                fetchPriority="high"
                loading="eager"
                decoding="async"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-4 text-white font-medium text-lg drop-shadow-md">
                {coworkingSpace.name} View
              </div>
            </div>
          )}

          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <section className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-4 space-y-3">
                <h3 className="font-semibold text-sm text-slate-600">Basic Information</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium text-slate-700">Address:</span> {displayValue(coworkingSpace.address)}</div>
                  <div><span className="font-medium text-slate-700">Locality:</span> {displayValue(coworkingSpace.district || coworkingSpace.city)}</div>
                  <div><span className="font-medium text-slate-700">State / District:</span> {displayValue(coworkingSpace.state)} / {displayValue(coworkingSpace.district)}</div>
                  <div><span className="font-medium text-slate-700">Pincode:</span> {displayValue(coworkingSpace.pincode)}</div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-4 space-y-3">
                <h3 className="font-semibold text-sm text-slate-600">Contact Details</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-slate-700">Website:</span>{" "}
                    {websiteUrl ? (
                      <a href={websiteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline break-all">
                        {displayValue(coworkingSpace.website)} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : "N/A"}
                  </div>
                  <div><span className="font-medium text-slate-700">Reception Phone:</span> {displayValue(coworkingSpace.contact_phone)}</div>
                  <div><span className="font-medium text-slate-700">Generic Email:</span> {displayValue(coworkingSpace.generic_email)}</div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-4 space-y-3">
                <h3 className="font-semibold text-sm text-slate-600">Management</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium text-slate-700">Builder:</span> {displayValue(coworkingSpace.builder_name)}</div>
                  <div><span className="font-medium text-slate-700">Security Agency:</span> {displayValue(coworkingSpace.security_agency_name)}</div>
                  <div><span className="font-medium text-slate-700">Property Manager:</span> {displayValue(coworkingSpace.property_manager_name)}</div>
                  <div><span className="font-medium text-slate-700">Manager Phone:</span> {displayValue(coworkingSpace.property_manager_phone)}</div>
                  <div><span className="font-medium text-slate-700">Manager Email:</span> {displayValue(coworkingSpace.property_manager_email)}</div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-4 space-y-3">
                <h3 className="font-semibold text-sm text-slate-600">SPOC & Challenges</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium text-slate-700">SPOC Name:</span> {displayValue(coworkingSpace.spoc_name)}</div>
                  <div><span className="font-medium text-slate-700">SPOC Phone:</span> {displayValue(coworkingSpace.spoc_phone)}</div>
                  <div><span className="font-medium text-slate-700">Seating Capacity:</span> {displayValue(coworkingSpace.seating_capacity)}</div>
                  <div><span className="font-medium text-slate-700">Challenges:</span> {displayValue(coworkingSpace.challenges)}</div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-4 space-y-3">
                <h3 className="font-semibold text-sm text-slate-600">Infrastructure</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium text-slate-700">Total Floors:</span> {displayValue(coworkingSpace.total_floors)}</div>
                  <div><span className="font-medium text-slate-700">Parking Floors:</span> {displayValue(coworkingSpace.parking_floors)}</div>
                  <div><span className="font-medium text-slate-700">Basement Levels:</span> {displayValue(coworkingSpace.basement_levels)}</div>
                  <div><span className="font-medium text-slate-700">Coordinates:</span> {(coworkingSpace.lat !== undefined && coworkingSpace.lat !== null && coworkingSpace.lng !== undefined && coworkingSpace.lng !== null) ? `${coworkingSpace.lat}, ${coworkingSpace.lng}` : "N/A"}</div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-4 space-y-3">
                <h3 className="font-semibold text-sm text-slate-600">Status & Rating</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-700">Status:</span>
                    <Badge className={statusClass}>{displayValue(coworkingSpace.status)}</Badge>
                  </div>
                  <div><span className="font-medium text-slate-700">Rating:</span> {displayValue(coworkingSpace.rating)} ({displayValue(coworkingSpace.total_ratings, "0")} reviews)</div>
                </div>
              </section>
            </div>

            {coworkingSpace.exterior_media_urls && coworkingSpace.exterior_media_urls.length > 0 && (
              <section className="rounded-xl border border-slate-200/70 bg-white p-4">
                <h3 className="font-semibold text-sm text-slate-600 mb-3">Gallery</h3>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {coworkingSpace.exterior_media_urls.map((url: string, index: number) => (
                    <a
                      key={index}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="block w-52 h-32 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden border border-slate-200 hover:shadow-sm transition-shadow"
                    >
                      <img
                        src={url}
                        alt={`Exterior ${index + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    </a>
                  ))}
                </div>
              </section>
            )}
          </CardContent>
        </Card>
      )}

      {/* Google Reviews Section */}
      {coworkingSpace && (
        <ReviewIssuePriority data={coworkingSpace} />
      )}

      {coworkingSpace && <StoredVenueReviews venueType="coworking" venueId={coworkingSpace.id} />}

      {/* Google Reviews Section */}
      {coworkingSpace && (
        <PlacesReviews
          name={coworkingSpace.name || ""}
          location={[coworkingSpace.city, coworkingSpace.state].filter(Boolean).join(", ")}
          rating={coworkingSpace.rating}
          totalRatings={coworkingSpace.total_ratings}
          mapUrl={coworkingSpace.map_url}
        />
      )}

      {/* Parking Complaints Section */}
      {coworkingSpace && (
        <ParkingComplaintsReviews
          name={coworkingSpace.name || ""}
          location={[coworkingSpace.city, coworkingSpace.state].filter(Boolean).join(", ")}
          rating={coworkingSpace.rating}
          totalRatings={coworkingSpace.total_ratings}
          mapUrl={coworkingSpace.map_url}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <div className={`${stat.bgColor} p-2 rounded-md`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent>
          <ChartContainer data={chartAnalytics} isLoading={companiesLoading} />
        </CardContent>
      </Card>

      <div className="space-y-4">
        {/* Header with title and Add Company button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-xl font-semibold">Companies</h2>
          {canManageCoworkingData ? (
            <Button onClick={() => setIsDialogOpen(true)} className="w-full sm:w-auto">
              Add Company
            </Button>
          ) : null}
        </div>

        {/* Search Input with results count */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <SearchInput
            placeholder="Search companies..."
            value={searchTerm}
            onChange={setSearchTerm}
            className="w-full sm:max-w-md"
          />
          {searchTerm && (
            <div className="text-sm text-muted-foreground text-center sm:text-right">
              {pagination.totalItems} results
            </div>
          )}
        </div>
        <LocationTable
          data={pagedCompanies.map((co) => ({
            id: co.id,
            name: co.name || "",
            address: co.description || '',
            website: co.operator || '',
            rating: 0,
            total_ratings: 0,
            business_status: String(co.business_status || 'NOT_CONTACTED'),
            phone: co.contact_phone || co.contact_international_phone || 'N/A',
            map_url: '',
            opening_hours: '',
            status: String(co.business_status || 'NOT_CONTACTED'),
            serialNumber: co.serialNumber,
          }))}
          nameLabel="Company"
          locationLabel="Description"
          enableSearch={false}
          onViewDetails={handleViewDetails}
          onEdit={handleEdit}
          onChangeStatus={handleChangeStatus}
          onDelete={handleDelete}
          canEdit={canManageCoworkingData}
          canChangeStatus={canManageCoworkingData}
          canDelete={canDeleteCoworkingData}
          isLoading={companiesLoading}
        />
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          onPageChange={(p) => setPage(p)}
        />
      </div>

      {/* Edit Coworking Space Dialog */}
      <AddLocationDialog
        open={isEditCoworkingDialogOpen}
        onOpenChange={setIsEditCoworkingDialogOpen}
        newLocation={coworkingFormData || { id: id || "", name: "", address: "", contact_phone: "", status: "NOT_CONTACTED" }}
        setNewLocation={(location) => setCoworkingFormData(location as CoworkingSpaceRecord)}
        handleAddLocation={handleUpdateCoworking}
        resetForm={() => { }}
        isSubmitting={isUpdatingCoworking}
        segment="coworkingSpaces"
        enableExtendedTechParkFields={true}
      />

      {/* Add Company Dialog */}
      <AddCoworkingCompanyDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        company={company}
        setCompany={(next) => setCompany(next)}
        handleAddCompany={(companyData) => {
          void handleAddCompany(companyData as CompanyDraftState | undefined);
        }}
        resetForm={resetForm}
        isLoading={isSubmitting}
      />

      {/* Edit Company Dialog */}
      <AddCoworkingCompanyDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        company={editingCompany}
        setCompany={(next) => setEditingCompany(next)}
        handleAddCompany={(companyData) => {
          void handleEditCompany(companyData as CompanyDraftState | undefined);
        }}
        resetForm={() => { }}
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
                {deletingCompany?.name || 'this company'}
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
    </div>
  );
}
