import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { Building2, Users, RefreshCcw, ArrowLeft } from "lucide-react";
import { AddCompanyDialog } from "@/components/add-company-dialog/AddCompanyDialog";
import { ChartContainer } from "@/components/charts/chart-containers";
import { Pagination } from "@/components/pagination/Pagination";
import { LocationTable } from "./LocationTable";
import { techParkService } from "@/services/techParkService";
import { useParams, useNavigate } from "react-router";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertTriangle, MapPin, Edit, ExternalLink, HeadphonesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { statuses } from "@/const/contact-status";
import { AddLocationDialog } from "@/components/add-location-dialog/AddLocationDialog";
import { useQueryClient } from "@tanstack/react-query";
import { techParkKeys } from "@/hooks/use-tech-park-queries";
import { useRoleAccess } from "@/hooks/use-role-access";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityTimeline } from "@/components/tech-parks/ActivityTimeline";
import { AddVisitModal } from "@/components/tech-parks/AddVisitModal";
import { AddContactLogModal } from "@/components/tech-parks/AddContactLogModal";
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

type TechParkCompanyRecord = {
  id: string;
  name?: string;
  address?: string;
  website?: string;
  operator?: string;
  description?: string;
  rating?: number | string;
  total_ratings?: number | string;
  business_status?: string;
  phone?: string;
  map_url?: string;
  opening_hours?: string | string[];
  locationLat?: string | number;
  locationLng?: string | number;
  contact_email?: string;
  contact_phone?: string;
  contact_international_phone?: string;
  city?: string;
  serialNumber?: number;
  isActive?: boolean;
};

type TechParkCompanyDraft = {
  id?: string;
  name: string;
  address: string;
  contact: string;
  website: string;
  map_url: string;
  rating: string;
  status: string;
  description: string;
  operator?: string;
  total_ratings?: number;
  business_status?: string;
  phone?: string;
  opening_hours?: string;
  locationLat?: string | number;
  locationLng?: string | number;
  contact_email?: string;
  contact_phone?: string;
  contact_international_phone?: string;
  city?: string;
};

type EditingTechParkCompany = {
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

type TechParkRecord = {
  id: string;
  isVerified?: boolean;
  name?: string;
  status?: string;
  reviewStatus?: string;
  verificationLifecycleStatus?: string;
  verifiedByUserId?: string | null;
  hasVerificationProgress?: boolean;
  locality?: string;
  city?: string;
  state?: string;
  district?: string;
  pincode?: string;
  country?: string;
  address_line1?: string;
  address_line2?: string;
  website?: string;
  reception_phone?: string;
  generic_email?: string;
  contact_page_url?: string;
  builder_name?: string;
  security_agency_name?: string;
  property_manager_name?: string;
  property_manager_phone?: string;
  property_manager_email?: string;
  spoc_name?: string;
  spoc_phone?: string;
  seating_capacity?: number | string;
  challenges?: string;
  total_floors?: number | string;
  parking_floors?: number | string;
  basement_levels?: number | string;
  lat?: number | null;
  lng?: number | null;
  rating?: number | string;
  total_ratings?: number | string;
  business_status?: string;
  photo_url?: string;
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

type TechParkStats = {
  totalCompanies: number;
  contactedCompanies: number;
  positiveResponses: number;
  responseRate: number;
};

type CompanyListResponse = {
  data?: {
    stats?: TechParkStats;
    statusBreakdown?: Partial<Record<
      "NOT_CONTACTED" | "CONTACTED" | "INTERESTED" | "MEETING_SCHEDULED" | "PROPOSAL_SENT" | "IN_PROGRESS" | "CLOSED",
      number
    >>;
    items?: TechParkCompanyRecord[];
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

type TechParkResponse = {
  success?: boolean;
  data?: TechParkRecord;
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const parsed = error as ApiErrorShape;
  return parsed.response?.data?.message || parsed.response?.data?.error || parsed.message || fallback;
};

const toTrimmedString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const output = String(value).trim();
  if (!output || output === "N/A") return undefined;
  return output;
};

const toNumberValue = (value: unknown): number | undefined => {
  const normalized = toTrimmedString(value);
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export default function TechParkDetailsPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isSalesManager } = useRoleAccess();
  const id = params.id;
  const [techPark, setTechPark] = useState<TechParkRecord | null>(null);
  const [companies, setCompanies] = useState<TechParkCompanyRecord[]>([]);
  const [stats, setStats] = useState<TechParkStats>({ totalCompanies: 0, contactedCompanies: 0, positiveResponses: 0, responseRate: 0 });
  const [statusBreakdown, setStatusBreakdown] = useState<{ NOT_CONTACTED: number; CONTACTED: number; INTERESTED: number; MEETING_SCHEDULED: number; PROPOSAL_SENT: number; IN_PROGRESS: number; CLOSED: number }>({ NOT_CONTACTED: 0, CONTACTED: 0, INTERESTED: 0, MEETING_SCHEDULED: 0, PROPOSAL_SENT: 0, IN_PROGRESS: 0, CLOSED: 0 });
  const [, setLoading] = useState<boolean>(false);
  const [companiesLoading, setCompaniesLoading] = useState<boolean>(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDiscoveringCompanies, setIsDiscoveringCompanies] = useState(false);
  const [showRemovedCompanies, setShowRemovedCompanies] = useState(false);
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
  const [company, setCompany] = useState<TechParkCompanyDraft>({
    name: "",
    address: "",
    contact: "",
    website: "",
    map_url: "",
    rating: "",
    status: "NOT_CONTACTED",
    description: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  // Activity Tab State
  const [activeTab, setActiveTab] = useState("companies");
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [isContactLogModalOpen, setIsContactLogModalOpen] = useState(false);

  // Edit modal state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [editingCompany, setEditingCompany] = useState<EditingTechParkCompany>({
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

  // Delete modal state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingCompany, setDeletingCompany] = useState<TechParkCompanyRecord | null>(null);

  // Edit Tech Park Dialog State
  const [isEditTechParkDialogOpen, setIsEditTechParkDialogOpen] = useState(false);
  const [isUpdatingTechPark, setIsUpdatingTechPark] = useState(false);
  const [techParkFormData, setTechParkFormData] = useState<TechParkRecord | null>(null);
  const [heroImageSrc, setHeroImageSrc] = useState<string>("");
  const [isEnriching, setIsEnriching] = useState(false);
  const canManageTechParkData = isAdmin || isSalesManager;
  const canDeleteTechParkData = isAdmin;

  const applyCompanyListResponse = (response: CompanyListResponse | undefined) => {
    const data = response?.data || {};
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
  };

  const reloadCompanies = async (search = searchTerm || undefined) => {
    if (!id) return;
    const response = await techParkService.getCompaniesByTechPark(id, page, pageSize, search, showRemovedCompanies);
    applyCompanyListResponse(response as CompanyListResponse);
  };

  const reviewStatusLabel = useMemo(() => {
    if (!techPark) return "PENDING";
    const explicit = String(techPark.verificationLifecycleStatus || "")
      .trim()
      .toUpperCase();
    if (explicit === "READY_FOR_REVIEW") return "READY FOR REVIEW";
    if (explicit === "IN_PROGRESS") return "IN PROGRESS";
    if (explicit === "PENDING") return "PENDING";
    if (explicit === "VERIFIED") return "VERIFIED";
    if (explicit === "REJECTED") return "REJECTED";
    if (techPark.isVerified) return "VERIFIED";
    if (String(techPark.reviewStatus || "").trim().toUpperCase() === "REJECTED") return "REJECTED";
    if (techPark.verifiedByUserId) return "READY FOR REVIEW";
    if (techPark.hasVerificationProgress) return "IN PROGRESS";
    return "PENDING";
  }, [techPark]);

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
    const primaryImage =
      techPark?.photo_url ||
      (Array.isArray(techPark?.exterior_media_urls) ? techPark.exterior_media_urls[0] : "") ||
      "";
    setHeroImageSrc(primaryImage);
  }, [techPark]);

  useEffect(() => {
    const loadTechPark = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const tpResp = await techParkService.getTechParkById(id);

        if ((tpResp as TechParkResponse).success) {
          setTechPark(tpResp.data);
        }
      } catch (error: unknown) {
        console.error('Failed to load tech park:', error);
        const errorMsg = getApiErrorMessage(error, 'Failed to load tech park');
        toast.error(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    loadTechPark();
  }, [id, refreshTick]);

  useEffect(() => {
    const loadCompanies = async () => {
      if (!id) return;
      setCompaniesLoading(true);
      try {
        const companiesResp = await techParkService.getCompaniesByTechPark(
          id,
          page,
          pageSize,
          searchTerm || undefined,
          showRemovedCompanies,
        );
        applyCompanyListResponse(companiesResp as CompanyListResponse);
      } catch (error: unknown) {
        console.error('Failed to load companies:', error);
        const errorMsg = getApiErrorMessage(error, 'Failed to load companies');
        toast.error(errorMsg);
      } finally {
        setCompaniesLoading(false);
      }
    };

    loadCompanies();
  }, [id, page, pageSize, searchTerm, showRemovedCompanies, refreshTick]);

  // Note: calculateStats function removed as we now use server-side stats

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
      address: "",
      contact: "",
      website: "",
      map_url: "",
      rating: "",
      status: "NOT_CONTACTED",
      description: "",
    });
  };

  // Removed unused handleInputChange function

  const handleAddCompany = async (companyData?: TechParkCompanyDraft) => {
    if (!id || isSubmitting) return; // Prevent multiple calls

    const dataToUse = companyData || company;

    // Validate required fields
    if (!dataToUse.name || dataToUse.name.trim() === '') {
      toast.error('Company name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const addPayload: Parameters<typeof techParkService.addCompanyToTechPark>[1] = {
        name: dataToUse.name,
        address: dataToUse.address || undefined,
        contact: dataToUse.contact || undefined,
        website: dataToUse.website || undefined,
        map_url: dataToUse.map_url || undefined,
        rating: toNumberValue(dataToUse.rating),
        status: dataToUse.status || undefined,
        description: dataToUse.description || undefined,
      };
      const resp = await techParkService.addCompanyToTechPark(id, addPayload);
      const created = resp?.data;
      if (created) {
        await reloadCompanies();
        queryClient.invalidateQueries({ queryKey: techParkKeys.all });
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

  const handleViewDetails = (company: TechParkCompanyRecord) => {
    navigate(`/dashboard/company/${company.id}`);
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleDiscoverCompanies = async () => {
    if (!id || isDiscoveringCompanies) return;

    try {
      setIsDiscoveringCompanies(true);
      const response = await techParkService.discoverCompaniesByTechPark(id);
      const summary = response?.data;

      await reloadCompanies(searchTerm || undefined);
      queryClient.invalidateQueries({ queryKey: techParkKeys.all });

      const removedCount = summary?.markedInactive || 0;
      toast.success(
        `Fetched companies: ${summary?.created || 0} new, ${summary?.updated || 0} updated` +
          (removedCount > 0 ? `, ${removedCount} no longer found` : "") +
          ".",
      );
    } catch (error: unknown) {
      const errorMsg = getApiErrorMessage(error, "Failed to fetch companies for this tech park");
      toast.error(errorMsg);
    } finally {
      setIsDiscoveringCompanies(false);
    }
  };

  const handleEdit = (company: TechParkCompanyRecord) => {
    setEditingCompany({
      id: company.id,
      name: company.name || "",
      address: company.address || "",
      website: company.website || "",
      operator: company.operator || "",
      description: company.description || "",
      rating: typeof company.rating === "number" ? company.rating : Number(company.rating || 0),
      total_ratings: typeof company.total_ratings === "number" ? company.total_ratings : Number(company.total_ratings || 0),
      business_status: company.business_status || "NOT_CONTACTED",
      phone: company.contact_phone || company.phone || "",
      map_url: company.map_url || "",
      opening_hours: Array.isArray(company.opening_hours) ? company.opening_hours.join(", ") : (company.opening_hours || ""),
      locationLat: company.locationLat ?? "",
      locationLng: company.locationLng ?? "",
      contact_email: company.contact_email || "",
      contact_phone: company.contact_phone || "",
      contact_international_phone: company.contact_international_phone || "",
      city: company.city || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleEditCompany = async (formData?: EditingTechParkCompany) => {
    if (!editingCompany?.id || isEditingCompany) return; // Prevent multiple calls
    try {
      setIsEditingCompany(true);

      // Use formData if provided, otherwise fall back to editingCompany
      const dataToUse = formData || editingCompany;

      const payload: Parameters<typeof techParkService.updateCompany>[1] = {};

      // Required fields - ensure they have values
      payload.name = String(dataToUse.name || '').trim();
      payload.address = String(dataToUse.address || '').trim();
      payload.city = String(dataToUse.city || '').trim();
      payload.business_status = String(dataToUse.business_status || 'NOT_CONTACTED').trim();

      // Required numeric fields
      const lat = dataToUse.locationLat;
      const lng = dataToUse.locationLng;
      payload.locationLat = typeof lat === 'number' ? lat : lat ? Number(lat) : 0;
      payload.locationLng = typeof lng === 'number' ? lng : lng ? Number(lng) : 0;

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

      const rating = toNumberValue(dataToUse.rating);
      if (rating !== undefined) payload.rating = rating;
      const totalRatings = toNumberValue(dataToUse.total_ratings);
      if (totalRatings !== undefined) payload.total_ratings = totalRatings;

      const oh = dataToUse.opening_hours;
      const openingArray: string[] = Array.isArray(oh)
        ? oh.map((s) => String(s).trim()).filter((s) => s !== '')
        : typeof oh === 'string'
          ? oh.split(/[\n,]+/).map((s) => s.trim()).filter((s) => s !== '')
          : [];
      payload.opening_hours = openingArray;

      await techParkService.updateCompany(editingCompany.id, payload);
      setIsEditDialogOpen(false);

      await reloadCompanies();
      queryClient.invalidateQueries({ queryKey: techParkKeys.all });

      toast.success('Company updated successfully!');
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, 'Failed to update company');
      toast.error(errorMsg);
    } finally {
      setIsEditingCompany(false);
    }
  };

  const handleChangeStatus = async (company: TechParkCompanyRecord, status: string) => {
    try {
      await techParkService.changeCompanyStatus(company.id, status);

      await reloadCompanies();
      queryClient.invalidateQueries({ queryKey: techParkKeys.all });

      toast.success(`Status changed to ${status}`);
    } catch (error: unknown) {
      console.error('Failed to change status:', error);
      const errorMsg = getApiErrorMessage(error, 'Failed to change status');
      toast.error(errorMsg);
    }
  };

  const handleDelete = async (company: TechParkCompanyRecord) => {
    setDeletingCompany(company);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingCompany?.id || isDeleting) return; // Prevent multiple calls
    try {
      setIsDeleting(true);
      await techParkService.deleteCompany(deletingCompany.id);

      await reloadCompanies();
      queryClient.invalidateQueries({ queryKey: techParkKeys.all });

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



  const handleEditTechParkClick = () => {
    if (!techPark) return;
    setTechParkFormData({
      ...techPark,
      phone: techPark.reception_phone,
      coordinates: techPark.lat && techPark.lng ? `${techPark.lat}, ${techPark.lng}` : '',
    });
    setIsEditTechParkDialogOpen(true);
  };

  const handleRunEnrichment = async () => {
    if (!id || isEnriching) return;
    setIsEnriching(true);
    try {
      // Website enrichment only fills details when an official website can
      // be found; directory enrichment then fills any remaining gaps from
      // open-web search, which is the only source for campuses without one.
      const websiteResp = await techParkService.enrichTechParkWebsiteDetails(id).catch(() => null);
      const directoryResp = await techParkService.enrichTechParkDirectoryDetails(id).catch(() => null);

      const messages = [websiteResp, directoryResp].filter((r) => r?.success && r.data).map((r) => r.message);
      if (messages.length > 0) {
        toast.success(messages.join(" "));
      } else {
        toast.error("No new details were found for this tech park.");
      }

      const tpResp = await techParkService.getTechParkById(id);
      if (tpResp.success) {
        setTechPark(tpResp.data);
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to run enrichment"));
    } finally {
      setIsEnriching(false);
    }
  };

  const handleUpdateTechPark = async (updatedData?: TechParkRecord) => {
    if (!id || !updatedData || isUpdatingTechPark) return;
    setIsUpdatingTechPark(true);
    try {
      // Map form data back to API payload structure if needed
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
        reception_phone: updatedData.phone,
        lat: updatedData.lat ?? undefined,
        lng: updatedData.lng ?? undefined,
      } as Parameters<typeof techParkService.editTechPark>[1];

      await techParkService.editTechPark(id, payload);

      // Refresh Tech Park Data
      const tpResp = await techParkService.getTechParkById(id);
      if (tpResp.success) {
        setTechPark(tpResp.data);
      }
      queryClient.invalidateQueries({ queryKey: techParkKeys.all });
      toast.success("Tech Park updated successfully");
      setIsEditTechParkDialogOpen(false);
    } catch (error: unknown) {
      console.error("Failed to update tech park:", error);
      const errorMsg = getApiErrorMessage(error, 'Failed to update tech park');
      toast.error(errorMsg);
    } finally {
      setIsUpdatingTechPark(false);
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

  const websiteUrl = withProtocol(techPark?.website);
  const contactPageUrl = withProtocol(techPark?.contact_page_url);
  const mapUrl = withProtocol(techPark?.map_url);
  const statusClass = statuses[techPark?.status as keyof typeof statuses] || "bg-slate-100 text-slate-700";

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

      {/* Tech Park Details Section */}
      {techPark && (
        <Card className="overflow-hidden border-slate-200/70 shadow-sm">
          <div className="bg-gradient-to-r from-slate-50 via-white to-sky-50/60 border-b">
            <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="uppercase tracking-wide">
                    Tech Park
                  </Badge>
                  <Badge className={statusClass}>{displayValue(techPark.status)}</Badge>
                </div>
                <CardTitle className="text-2xl leading-tight">{displayValue(techPark.name)}</CardTitle>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {displayValue(techPark.locality)}, {displayValue(techPark.city)}, {displayValue(techPark.state)}
                </p>
              </div>

              <div className="flex gap-2">
                {canManageTechParkData ? (
                  <Button variant="outline" size="sm" onClick={handleEditTechParkClick}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                ) : null}
                {canManageTechParkData ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRunEnrichment}
                    disabled={isEnriching}
                    title="Re-scan the tech park's website for contact, management, and SPOC details"
                  >
                    <RefreshCcw className={`h-4 w-4 mr-2 ${isEnriching ? "animate-spin" : ""}`} />
                    {isEnriching ? "Finding details..." : "Find Missing Details"}
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

          {heroImageSrc && (
            <div className="w-full h-48 sm:h-64 md:h-80 relative bg-slate-100 border-b overflow-hidden">
              <div
                className="absolute inset-0 bg-center bg-cover blur-xl scale-110 opacity-35"
                style={{ backgroundImage: `url("${heroImageSrc}")` }}
              />
              <img
                src={heroImageSrc}
                alt={techPark.name}
                className="relative z-10 w-full h-full object-contain"
                fetchPriority="high"
                loading="eager"
                decoding="async"
                onError={(e) => {
                  const fallback = techPark.exterior_media_urls?.find((url) => url && url !== heroImageSrc) || "";
                  if (fallback) {
                    setHeroImageSrc(fallback);
                    return;
                  }
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-4 text-white font-medium text-lg drop-shadow-md">
                {techPark.name} View
              </div>
            </div>
          )}

          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <section className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-4 space-y-3">
                <h3 className="font-semibold text-sm text-slate-600">Basic Information</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium text-slate-700">Address:</span> {displayValue(`${techPark.address_line1 || ""} ${techPark.address_line2 || ""}`)}</div>
                  <div><span className="font-medium text-slate-700">Locality:</span> {displayValue(techPark.locality)}, {displayValue(techPark.city)}</div>
                  <div><span className="font-medium text-slate-700">State / District:</span> {displayValue(techPark.state)} / {displayValue(techPark.district)}</div>
                  <div><span className="font-medium text-slate-700">Pincode:</span> {displayValue(techPark.pincode)}</div>
                  <div><span className="font-medium text-slate-700">Country:</span> {displayValue(techPark.country)}</div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-4 space-y-3">
                <h3 className="font-semibold text-sm text-slate-600">Contact Details</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-slate-700">Website:</span>{" "}
                    {websiteUrl ? (
                      <a href={websiteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline break-all">
                        {displayValue(techPark.website)} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : "N/A"}
                  </div>
                  <div><span className="font-medium text-slate-700">Reception Phone:</span> {displayValue(techPark.reception_phone)}</div>
                  <div><span className="font-medium text-slate-700">Generic Email:</span> {displayValue(techPark.generic_email)}</div>
                  <div>
                    <span className="font-medium text-slate-700">Contact Page:</span>{" "}
                    {contactPageUrl ? (
                      <a href={contactPageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline break-all">
                        Open Link <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : "N/A"}
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-4 space-y-3">
                <h3 className="font-semibold text-sm text-slate-600">Management</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium text-slate-700">Builder:</span> {displayValue(techPark.builder_name)}</div>
                  <div><span className="font-medium text-slate-700">Security Agency:</span> {displayValue(techPark.security_agency_name)}</div>
                  <div><span className="font-medium text-slate-700">Property Manager:</span> {displayValue(techPark.property_manager_name)}</div>
                  <div><span className="font-medium text-slate-700">Manager Phone:</span> {displayValue(techPark.property_manager_phone)}</div>
                  <div><span className="font-medium text-slate-700">Manager Email:</span> {displayValue(techPark.property_manager_email)}</div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-4 space-y-3">
                <h3 className="font-semibold text-sm text-slate-600">SPOC & Challenges</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium text-slate-700">SPOC Name:</span> {displayValue(techPark.spoc_name)}</div>
                  <div><span className="font-medium text-slate-700">SPOC Phone:</span> {displayValue(techPark.spoc_phone)}</div>
                  <div><span className="font-medium text-slate-700">Seating Capacity:</span> {displayValue(techPark.seating_capacity)}</div>
                  <div><span className="font-medium text-slate-700">Challenges:</span> {displayValue(techPark.challenges)}</div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-4 space-y-3">
                <h3 className="font-semibold text-sm text-slate-600">Infrastructure</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium text-slate-700">Total Floors:</span> {displayValue(techPark.total_floors)}</div>
                  <div><span className="font-medium text-slate-700">Parking Floors:</span> {displayValue(techPark.parking_floors)}</div>
                  <div><span className="font-medium text-slate-700">Basement Levels:</span> {displayValue(techPark.basement_levels)}</div>
                  <div><span className="font-medium text-slate-700">Coordinates:</span> {techPark.lat && techPark.lng ? `${techPark.lat}, ${techPark.lng}` : "N/A"}</div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-4 space-y-3">
                <h3 className="font-semibold text-sm text-slate-600">Status & Rating</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-700">Status:</span>
                    <Badge className={statusClass}>{displayValue(techPark.status)}</Badge>
                  </div>
                  <div><span className="font-medium text-slate-700">Rating:</span> {displayValue(techPark.rating)} ({displayValue(techPark.total_ratings, "0")} reviews)</div>
                  <div><span className="font-medium text-slate-700">Business Status:</span> {displayValue(techPark.business_status)}</div>
                  <div>
                    <span className="font-medium text-slate-700">Review Status:</span>{" "}
                    {displayValue(reviewStatusLabel, "PENDING")}
                  </div>
                </div>
              </section>
            </div>

            {techPark.exterior_media_urls && techPark.exterior_media_urls.length > 0 && (
              <section className="rounded-xl border border-slate-200/70 bg-white p-4">
                <h3 className="font-semibold text-sm text-slate-600 mb-3">Gallery</h3>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {techPark.exterior_media_urls.map((url: string, index: number) => (
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
      {techPark && (
        <ReviewIssuePriority data={techPark} />
      )}

      {techPark && <StoredVenueReviews venueType="techpark" venueId={techPark.id} />}

      {/* Google Reviews Section */}
      {techPark && (
        <PlacesReviews
          name={techPark.name || ""}
          location={[techPark.city, techPark.state].filter(Boolean).join(", ")}
          rating={techPark.rating}
          totalRatings={techPark.total_ratings}
          mapUrl={techPark.map_url}
        />
      )}

      {/* Parking Complaints Section */}
      {techPark && (
        <ParkingComplaintsReviews
          name={techPark.name || ""}
          location={[techPark.city, techPark.state].filter(Boolean).join(", ")}
          rating={techPark.rating}
          totalRatings={techPark.total_ratings}
          mapUrl={techPark.map_url}
        />
      )}

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <TabsList>
            <TabsTrigger value="companies">Companies Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity & Logs</TabsTrigger>
          </TabsList>

          {activeTab === "activity" && canManageTechParkData && (
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" onClick={() => setIsContactLogModalOpen(true)}>
                <HeadphonesIcon className="h-4 w-4 mr-2" />
                Log Contact
              </Button>
              <Button size="sm" onClick={() => setIsVisitModalOpen(true)}>
                <MapPin className="h-4 w-4 mr-2" />
                Log Site Visit
              </Button>
            </div>
          )}
        </div>

        <TabsContent value="companies" className="space-y-6 mt-0">
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
              {canManageTechParkData ? (
                <div className="flex w-full sm:w-auto gap-2">
                  <Button
                    variant="outline"
                    onClick={handleDiscoverCompanies}
                    disabled={isDiscoveringCompanies}
                    className="w-full sm:w-auto"
                  >
                    <RefreshCcw className={`h-4 w-4 mr-2 ${isDiscoveringCompanies ? "animate-spin" : ""}`} />
                    {isDiscoveringCompanies ? "Fetching..." : "Fetch Companies"}
                  </Button>
                  <Button onClick={() => setIsDialogOpen(true)} className="w-full sm:w-auto">
                    Add Company
                  </Button>
                </div>
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
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={showRemovedCompanies}
                    onChange={(e) => {
                      setShowRemovedCompanies(e.target.checked);
                      setPage(1);
                    }}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Show removed companies
                </label>
                {searchTerm && (
                  <div className="text-sm text-muted-foreground text-center sm:text-right">
                    {pagination.totalItems} results
                  </div>
                )}
              </div>
            </div>
            <LocationTable
              data={pagedCompanies.map((co) => ({
                id: co.id,
                name: co.isActive === false ? `${co.name || ""} (Removed)` : (co.name || ""),
                address: co.address || '',
                website: co.website || '',
                rating: typeof co.rating === "number" ? co.rating : Number(co.rating || 0),
                total_ratings: typeof co.total_ratings === "number" ? co.total_ratings : Number(co.total_ratings || 0),
                business_status: String(co.business_status || 'NOT_CONTACTED'),
                phone: co.phone || 'N/A',
                map_url: co.map_url || '',
                opening_hours: Array.isArray(co.opening_hours) ? co.opening_hours.join(", ") : (co.opening_hours || ''),
                status: String(co.business_status || 'NOT_CONTACTED'),
                serialNumber: co.serialNumber,
              }))}
              nameLabel="Company"
              locationLabel="Address"
              enableSearch={false}
              onViewDetails={handleViewDetails}
              onEdit={handleEdit}
              onChangeStatus={handleChangeStatus}
              onDelete={handleDelete}
              canEdit={canManageTechParkData}
              canChangeStatus={canManageTechParkData}
              canDelete={canDeleteTechParkData}
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
        </TabsContent>

        <TabsContent value="activity" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {id && <ActivityTimeline techParkId={id} />}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Company Dialog */}
      <AddCompanyDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        company={company}
        setCompany={setCompany}
        handleAddCompany={handleAddCompany}
        resetForm={resetForm}
        isLoading={isSubmitting}
      />

      {/* Edit Company Dialog */}
      <AddCompanyDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        company={editingCompany}
        setCompany={setEditingCompany}
        handleAddCompany={handleEditCompany}
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

      {/* Edit Tech Park Dialog */}
      <AddLocationDialog
        open={isEditTechParkDialogOpen}
        onOpenChange={setIsEditTechParkDialogOpen}
        newLocation={(techParkFormData as unknown as {
          id?: string;
          name?: string;
          address?: string;
          phone?: string;
          website?: string;
          map_url?: string;
          rating?: number | string;
          status?: string;
          city?: string;
          state?: string;
          parking_floors?: number;
          total_floors?: number;
          basement_levels?: number;
          lat?: number;
          lng?: number;
        }) || { id: id || "", name: "", address: "", city: "", state: "", status: "NOT_CONTACTED" }}
        setNewLocation={(location) => setTechParkFormData(location as unknown as TechParkRecord)}
        handleAddLocation={(locationData) => {
          void handleUpdateTechPark(locationData as unknown as TechParkRecord | undefined);
        }}
        resetForm={() => { }}
        isSubmitting={isUpdatingTechPark}
        segment="techParks"
        enableExtendedTechParkFields={true}
      />

      {/* Activity Modals */}
      {id && (
        <>
          <AddVisitModal
            techParkId={id}
            open={isVisitModalOpen}
            onOpenChange={setIsVisitModalOpen}
          />
          <AddContactLogModal
            techParkId={id}
            open={isContactLogModalOpen}
            onOpenChange={setIsContactLogModalOpen}
          />
        </>
      )}
    </div>
  );
}
