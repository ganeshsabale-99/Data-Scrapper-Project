import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DashboardHeader } from "./DashboardHeader";
import { DashboardControls } from "./DashboardControls";
import { StatesView } from "./StatesView";
import { StateDetailsView } from "./StateDetailsView";
import { CityDetailsView } from "./CityDetailsView";
import { DeleteDialog } from "./DeleteDialog";
import { LoadingSpinner } from "./LoadingSpinner";
import { ErrorDisplay } from "./ErrorDisplay";
import { AddLocationDialog } from "../add-location-dialog/AddLocationDialog";

import type {
  Segment,
  NewLocationData,
  BreadcrumbItem
} from "./types";
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_NEW_LOCATION,
  INDIA_STATES_AND_UTS
} from "./constants";
import {
  determineCurrentView,
  getSelectedStateForCityView,
  getSelectedCityForDetailView,
  getBasePath,
  getPageTitle,
  getTabLabel
} from "./utils";

import {
  useOverviewData,
  useStateWiseData,
  useCityWiseData,
  useAddTechPark,
  useDeleteTechPark,
  useChangeTechParkStatus,
  useEditTechPark,
  useVerifyTechPark,
  useUnverifyTechPark,
  useVerifyAllUnverifiedInCity,
} from "@/hooks/use-tech-park-queries";
import {
  useCoworkingSpaceOverviewData,
  useCoworkingSpaceStateWiseData,
  useCoworkingSpaceCityWiseData,
  useAddCoworkingSpace,
  useDeleteCoworkingSpace,
  useChangeStatus,
  useUpdateCoworkingSpace,
  useVerifyCoworkingSpace,
  useUnverifyCoworkingSpace
} from "@/hooks/use-coworking-space-queries";
import {
  useMallOverviewData, useMallStateWiseData, useMallCityWiseData,
  useHospitalOverviewData, useHospitalStateWiseData, useHospitalCityWiseData,
  useStadiumOverviewData, useStadiumStateWiseData, useStadiumCityWiseData,
  useAirportOverviewData, useAirportStateWiseData, useAirportCityWiseData,
  useAddGenericVenue, useDeleteGenericVenue, useChangeGenericVenueStatus,
  useUpdateGenericVenue, useVerifyGenericVenue, useUnverifyGenericVenue,
} from "@/hooks/use-venue-queries";
import { VENUE_SERVICES, type VenueSegment } from "@/services/genericVenueService";
import type { VenueOverviewData, VenueStateWiseData, VenueCityWiseData } from "@/services/genericVenueService";
import { useOperationStatus } from "@/hooks/use-operation-status";
import { getUserPermissions, hasPermission } from "@/lib/token";
import type { Location } from "@/pages/dashboard/LocationTable";
import { techParkService, type CityWiseOverviewData, type CityWiseOverviewItem, type OverviewData, type StateWiseOverviewData, type VerifiedFilter } from "@/services/techParkService";
import { coworkingSpaceService, type CoworkingSpaceCityWiseOverviewData, type CoworkingSpaceCityWiseOverviewItem, type CoworkingSpaceOverviewData, type CoworkingSpaceStateWiseOverviewData } from "@/services/coworkingSpaceService";

type ApiErrorShape = {
  response?: {
    data?: {
      error?: string;
      message?: string;
    };
  };
  message?: string;
};

type EditableLocationRow = Location &
  Partial<NewLocationData> & {
    verifiedByUserId?: string | null;
  };

type CombinedOverviewData = OverviewData | CoworkingSpaceOverviewData | VenueOverviewData;
type CombinedStateWiseData = StateWiseOverviewData | CoworkingSpaceStateWiseOverviewData | VenueStateWiseData;
type CombinedCityWiseData = CityWiseOverviewData | CoworkingSpaceCityWiseOverviewData | VenueCityWiseData;

type VerificationBreakdown = {
  all: number;
  verified: number;
  unverified: number;
  appliedFilter: VerifiedFilter;
};

type RawCityItem = Partial<CityWiseOverviewItem> &
  Partial<CoworkingSpaceCityWiseOverviewItem> &
  Partial<NewLocationData> &
  Record<string, unknown> & {
    contact_phone?: string;
    reception_phone?: string;
    map_url?: string;
    googleMapLink?: string | null;
    opening_hours?: string;
    verifiedByUserId?: string | null;
  };

const isVerificationBreakdown = (value: unknown): value is VerificationBreakdown => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<VerificationBreakdown>;
  return (
    typeof candidate.all === "number" &&
    typeof candidate.verified === "number" &&
    typeof candidate.unverified === "number" &&
    (candidate.appliedFilter === "ALL" ||
      candidate.appliedFilter === "VERIFIED" ||
      candidate.appliedFilter === "UNVERIFIED")
  );
};

const toApiErrorMessage = (error: unknown, fallback: string): string => {
  const apiError = error as ApiErrorShape;
  return apiError?.response?.data?.error || apiError?.response?.data?.message || apiError?.message || fallback;
};

export default function MockTechParkDashboard() {
  const params = useParams<{ state?: string; city?: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const normalizedPermissionSet = useMemo(
    () =>
      new Set(
        getUserPermissions()
          .map((permission) => permission.trim().toUpperCase().replace(/[^A-Z0-9.]+/g, "_"))
          .filter(Boolean),
      ),
    [],
  );
  const canApproveTechParkReview = normalizedPermissionSet.has("SYSTEM.SUPER_ADMIN");
  const canSubmitTechParkReview = hasPermission("TECHPARKS.VERIFY");

  const [searchParams] = useSearchParams();
  const segment = (searchParams.get("tab") as Segment) || "techParks";

  const [cityPage, setCityPage] = useState(1);
  const [verificationFilter, setVerificationFilter] = useState<VerifiedFilter>("ALL");
  const [citySearchTerm, setCitySearchTerm] = useState("");
  const [debouncedCitySearchTerm, setDebouncedCitySearchTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCitySearchTerm(citySearchTerm);
    }, 600);
    return () => clearTimeout(timer);
  }, [citySearchTerm]);

  const cityPageSize = DEFAULT_PAGE_SIZE;

  const currentView = useMemo(() => determineCurrentView(params, pathname), [params, pathname]);
  const selectedStateForCityView = useMemo(() => getSelectedStateForCityView(params, pathname), [params, pathname]);
  const selectedCityForDetailView = useMemo(() => getSelectedCityForDetailView(params, pathname), [params, pathname]);
  const shouldResolveStateFromCity = useMemo(
    () =>
      pathname.includes("/dashboard/city") &&
      !selectedStateForCityView &&
      !!selectedCityForDetailView,
    [pathname, selectedStateForCityView, selectedCityForDetailView],
  );

  const {
    data: cityStateLookupData,
    isLoading: isCityStateLookupLoading,
    error: cityStateLookupError,
  } = useQuery({
    queryKey: ["city-catalog", "state-by-city", selectedCityForDetailView],
    queryFn: () => techParkService.resolveStateByCity(selectedCityForDetailView!),
    enabled: shouldResolveStateFromCity,
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const effectiveStateForCityView =
    selectedStateForCityView || cityStateLookupData?.data?.state;

  const isTechParksSegment = segment === "techParks";
  const isCoworkingSegment = segment === "coworkingSpaces";
  const isGenericVenueSegment = !isTechParksSegment && !isCoworkingSegment;
  const activeVenuePath = isGenericVenueSegment ? (segment as VenueSegment) : null;

  const shouldLoadOverview = currentView === "states";
  const shouldLoadStateWise = currentView === "state-details";
  const shouldLoadCityWise = currentView === "city-details";

  const {
    data: overviewData,
    isLoading: isOverviewLoading,
    error: overviewError
  } = useOverviewData({
    enabled: isTechParksSegment && shouldLoadOverview,
  });

  const {
    data: stateWiseData,
    isLoading: isStateWiseLoading,
    error: stateWiseError
  } = useStateWiseData(effectiveStateForCityView || "", {
    enabled: isTechParksSegment && shouldLoadStateWise,
  });

  const {
    data: cityWiseData,
    isLoading: isCityLoading,
    isFetching: isCityFetching,
    error: cityError
  } = useCityWiseData(
    effectiveStateForCityView || "",
    selectedCityForDetailView || "",
    cityPage,
    cityPageSize,
    debouncedCitySearchTerm,
    verificationFilter,
    {
      enabled: isTechParksSegment && shouldLoadCityWise,
    },
  );

  const {
    data: coworkingOverviewData,
    isLoading: isCoworkingOverviewLoading,
    error: coworkingOverviewError
  } = useCoworkingSpaceOverviewData({
    enabled: isCoworkingSegment && shouldLoadOverview,
  });

  const {
    data: coworkingStateWiseData,
    isLoading: isCoworkingStateWiseLoading,
    error: coworkingStateWiseError
  } = useCoworkingSpaceStateWiseData(effectiveStateForCityView || "", {
    enabled: isCoworkingSegment && shouldLoadStateWise,
  });

  const {
    data: coworkingCityWiseData,
    isLoading: isCoworkingCityLoading,
    isFetching: isCoworkingCityFetching,
    error: coworkingCityError
  } = useCoworkingSpaceCityWiseData(
    effectiveStateForCityView || "",
    selectedCityForDetailView || "",
    cityPage,
    cityPageSize,
    debouncedCitySearchTerm,
    verificationFilter,
    {
      enabled: isCoworkingSegment && shouldLoadCityWise,
    }
  );

  // ── Malls ──────────────────────────────────────────────────────────────────
  const { data: mallsOverviewData, isLoading: isMallsOverviewLoading, error: mallsOverviewError } =
    useMallOverviewData({ enabled: segment === "malls" && shouldLoadOverview });
  const { data: mallsStateWiseData, isLoading: isMallsStateWiseLoading, error: mallsStateWiseError } =
    useMallStateWiseData(effectiveStateForCityView || "", { enabled: segment === "malls" && shouldLoadStateWise });
  const { data: mallsCityWiseData, isLoading: isMallsCityLoading, isFetching: isMallsCityFetching, error: mallsCityError } =
    useMallCityWiseData(effectiveStateForCityView || "", selectedCityForDetailView || "", cityPage, cityPageSize, debouncedCitySearchTerm, verificationFilter, { enabled: segment === "malls" && shouldLoadCityWise });

  // ── Hospitals ──────────────────────────────────────────────────────────────
  const { data: hospitalsOverviewData, isLoading: isHospitalsOverviewLoading, error: hospitalsOverviewError } =
    useHospitalOverviewData({ enabled: segment === "hospitals" && shouldLoadOverview });
  const { data: hospitalsStateWiseData, isLoading: isHospitalsStateWiseLoading, error: hospitalsStateWiseError } =
    useHospitalStateWiseData(effectiveStateForCityView || "", { enabled: segment === "hospitals" && shouldLoadStateWise });
  const { data: hospitalsCityWiseData, isLoading: isHospitalsCityLoading, isFetching: isHospitalsCityFetching, error: hospitalsCityError } =
    useHospitalCityWiseData(effectiveStateForCityView || "", selectedCityForDetailView || "", cityPage, cityPageSize, debouncedCitySearchTerm, verificationFilter, { enabled: segment === "hospitals" && shouldLoadCityWise });

  // ── Stadiums ───────────────────────────────────────────────────────────────
  const { data: stadiumsOverviewData, isLoading: isStadiumsOverviewLoading, error: stadiumsOverviewError } =
    useStadiumOverviewData({ enabled: segment === "stadiums" && shouldLoadOverview });
  const { data: stadiumsStateWiseData, isLoading: isStadiumsStateWiseLoading, error: stadiumsStateWiseError } =
    useStadiumStateWiseData(effectiveStateForCityView || "", { enabled: segment === "stadiums" && shouldLoadStateWise });
  const { data: stadiumsCityWiseData, isLoading: isStadiumsCityLoading, isFetching: isStadiumsCityFetching, error: stadiumsCityError } =
    useStadiumCityWiseData(effectiveStateForCityView || "", selectedCityForDetailView || "", cityPage, cityPageSize, debouncedCitySearchTerm, verificationFilter, { enabled: segment === "stadiums" && shouldLoadCityWise });

  // ── Airports ───────────────────────────────────────────────────────────────
  const { data: airportsOverviewData, isLoading: isAirportsOverviewLoading, error: airportsOverviewError } =
    useAirportOverviewData({ enabled: segment === "airports" && shouldLoadOverview });
  const { data: airportsStateWiseData, isLoading: isAirportsStateWiseLoading, error: airportsStateWiseError } =
    useAirportStateWiseData(effectiveStateForCityView || "", { enabled: segment === "airports" && shouldLoadStateWise });
  const { data: airportsCityWiseData, isLoading: isAirportsCityLoading, isFetching: isAirportsCityFetching, error: airportsCityError } =
    useAirportCityWiseData(effectiveStateForCityView || "", selectedCityForDetailView || "", cityPage, cityPageSize, debouncedCitySearchTerm, verificationFilter, { enabled: segment === "airports" && shouldLoadCityWise });

  // Normalize generic venue data for the active segment
  const genericVenueOverviewData: VenueOverviewData | undefined =
    segment === "malls" ? mallsOverviewData :
    segment === "hospitals" ? hospitalsOverviewData :
    segment === "stadiums" ? stadiumsOverviewData :
    segment === "airports" ? airportsOverviewData : undefined;
  const genericVenueStateWiseData: VenueStateWiseData | undefined =
    segment === "malls" ? mallsStateWiseData :
    segment === "hospitals" ? hospitalsStateWiseData :
    segment === "stadiums" ? stadiumsStateWiseData :
    segment === "airports" ? airportsStateWiseData : undefined;
  const genericVenueCityWiseData: VenueCityWiseData | undefined =
    segment === "malls" ? mallsCityWiseData :
    segment === "hospitals" ? hospitalsCityWiseData :
    segment === "stadiums" ? stadiumsCityWiseData :
    segment === "airports" ? airportsCityWiseData : undefined;

  const addTechParkMutation = useAddTechPark();
  const deleteTechParkMutation = useDeleteTechPark();
  const changeTechParkStatusMutation = useChangeTechParkStatus();
  const editTechParkMutation = useEditTechPark();
  const verifyTechParkMutation = useVerifyTechPark();
  const unverifyTechParkMutation = useUnverifyTechPark();
  const verifyAllUnverifiedInCityMutation = useVerifyAllUnverifiedInCity();

  const addCoworkingSpaceMutation = useAddCoworkingSpace();
  const deleteCoworkingSpaceMutation = useDeleteCoworkingSpace();
  const changeCoworkingStatusMutation = useChangeStatus();
  const editCoworkingSpaceMutation = useUpdateCoworkingSpace();
  const verifyCoworkingSpaceMutation = useVerifyCoworkingSpace();
  const unverifyCoworkingSpaceMutation = useUnverifyCoworkingSpace();

  // Generic venue mutations (malls / hospitals / stadiums / airports)
  const genericAddMutation = useAddGenericVenue();
  const genericDeleteMutation = useDeleteGenericVenue();
  const genericChangeStatusMutation = useChangeGenericVenueStatus();
  const genericUpdateMutation = useUpdateGenericVenue();
  const genericVerifyMutation = useVerifyGenericVenue();
  const genericUnverifyMutation = useUnverifyGenericVenue();

  useOperationStatus([
    addTechParkMutation,
    deleteTechParkMutation,
    changeTechParkStatusMutation,
    editTechParkMutation,
    verifyTechParkMutation,
    unverifyTechParkMutation,
    verifyAllUnverifiedInCityMutation,
    addCoworkingSpaceMutation,
    deleteCoworkingSpaceMutation,
    changeCoworkingStatusMutation,
    editCoworkingSpaceMutation,
    verifyCoworkingSpaceMutation,
    unverifyCoworkingSpaceMutation,
    genericAddMutation,
    genericDeleteMutation,
    genericChangeStatusMutation,
    genericUpdateMutation,
    genericVerifyMutation,
    genericUnverifyMutation,
  ]);

  useEffect(() => {
    setCityPage(1);
  }, [verificationFilter, selectedCityForDetailView, effectiveStateForCityView, debouncedCitySearchTerm]);

  const isResolvingCityState =
    shouldResolveStateFromCity &&
    !effectiveStateForCityView &&
    isCityStateLookupLoading;
  const cityStateResolutionError =
    shouldResolveStateFromCity &&
      !isCityStateLookupLoading &&
      !effectiveStateForCityView
      ? toApiErrorMessage(cityStateLookupError, "Unable to resolve state for selected city.")
      : null;

  const genericOverviewLoading =
    segment === "malls" ? isMallsOverviewLoading :
    segment === "hospitals" ? isHospitalsOverviewLoading :
    segment === "stadiums" ? isStadiumsOverviewLoading :
    isAirportsOverviewLoading;
  const genericStateWiseLoading =
    segment === "malls" ? isMallsStateWiseLoading :
    segment === "hospitals" ? isHospitalsStateWiseLoading :
    segment === "stadiums" ? isStadiumsStateWiseLoading :
    isAirportsStateWiseLoading;
  const genericCityLoading =
    segment === "malls" ? isMallsCityLoading :
    segment === "hospitals" ? isHospitalsCityLoading :
    segment === "stadiums" ? isStadiumsCityLoading :
    isAirportsCityLoading;
  const genericOverviewError =
    segment === "malls" ? mallsOverviewError :
    segment === "hospitals" ? hospitalsOverviewError :
    segment === "stadiums" ? stadiumsOverviewError :
    airportsOverviewError;
  const genericStateWiseError =
    segment === "malls" ? mallsStateWiseError :
    segment === "hospitals" ? hospitalsStateWiseError :
    segment === "stadiums" ? stadiumsStateWiseError :
    airportsStateWiseError;
  const genericCityError =
    segment === "malls" ? mallsCityError :
    segment === "hospitals" ? hospitalsCityError :
    segment === "stadiums" ? stadiumsCityError :
    airportsCityError;

  const currentOverviewLoading =
    segment === "techParks" ? isOverviewLoading :
    segment === "coworkingSpaces" ? isCoworkingOverviewLoading :
    genericOverviewLoading;
  const currentStateWiseLoading =
    segment === "techParks" ? isStateWiseLoading :
    segment === "coworkingSpaces" ? isCoworkingStateWiseLoading :
    genericStateWiseLoading;
  const currentCityLoading =
    (segment === "techParks" ? isCityLoading :
    segment === "coworkingSpaces" ? isCoworkingCityLoading :
    genericCityLoading) || isResolvingCityState;

  const currentOverviewError =
    segment === "techParks" ? overviewError :
    segment === "coworkingSpaces" ? coworkingOverviewError :
    genericOverviewError;
  const currentStateWiseError =
    segment === "techParks" ? stateWiseError :
    segment === "coworkingSpaces" ? coworkingStateWiseError :
    genericStateWiseError;
  const currentCityError =
    segment === "techParks" ? cityError :
    segment === "coworkingSpaces" ? coworkingCityError :
    genericCityError;

  const isLoading = currentView === "states"
    ? currentOverviewLoading
    : currentView === "state-details"
      ? currentStateWiseLoading
      : currentCityLoading;

  const error = currentView === "states"
    ? currentOverviewError?.message || null
    : currentView === "state-details"
      ? currentStateWiseError?.message || null
      : cityStateResolutionError || currentCityError?.message || null;

  const selectedStateFilter = useMemo(() => effectiveStateForCityView || "ALL", [effectiveStateForCityView]);

  const handleStateFilterChange = (newState: string) => {
    const basePath = getBasePath(pathname);
    if (newState === "ALL") {
      navigate(basePath);
    } else {
      navigate(`${basePath}/${encodeURIComponent(newState)}`);
    }
  };

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<EditableLocationRow | null>(null);
  const [locationToEdit, setLocationToEdit] = useState<EditableLocationRow | null>(null);


  const [newLocation, setNewLocation] = useState<NewLocationData>(DEFAULT_NEW_LOCATION);

  const resetForm = () => setNewLocation(DEFAULT_NEW_LOCATION);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewLocation((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddLocation = async (locationData?: NewLocationData) => {

    const dataToUse = locationData || newLocation;
    const state = effectiveStateForCityView;
    const city = selectedCityForDetailView;

    if (!state || !city) {
      toast.error("Select state and city before adding a new location.");
      return;
    }

    if (segment === "techParks") {
      addTechParkMutation.mutate({
        state,
        city,
        payload: {
          name: dataToUse.name,
          address: dataToUse.address,
          website: dataToUse.website || "",
          reception_phone: dataToUse.phone || "",
          status: dataToUse.status || "NOT_CONTACTED",
          rating: dataToUse.rating || 0,
          map_url: dataToUse.map_url || "",

          builder_name: dataToUse.builder_name || "",
          security_agency_name: dataToUse.security_agency_name || "",
          property_manager_name: dataToUse.property_manager_name || "",
          property_manager_phone: dataToUse.property_manager_phone || "",
          property_manager_email: dataToUse.property_manager_email || "",
          parking_floors: dataToUse.parking_floors,
          total_floors: dataToUse.total_floors,
          basement_levels: dataToUse.basement_levels,
          spoc_name: dataToUse.spoc_name || "",
          spoc_phone: dataToUse.spoc_phone || "",
          seating_capacity: dataToUse.seating_capacity,
          challenges: dataToUse.challenges || "",
          lat: dataToUse.lat ?? undefined,
          lng: dataToUse.lng ?? undefined,
          exterior_media_url: dataToUse.exterior_media_url || "",
          exterior_media_urls: Array.isArray(dataToUse.exterior_media_urls) ? dataToUse.exterior_media_urls : undefined,
        }
      }, {
        onSuccess: () => {
          setIsAddDialogOpen(false);
          resetForm();
        }
      });
    } else if (isGenericVenueSegment && activeVenuePath) {
      genericAddMutation.mutate({
        venuePath: activeVenuePath,
        state,
        city,
        payload: {
          name: dataToUse.name,
          city,
          state,
          address: dataToUse.address || null,
          reception_phone: dataToUse.phone || null,
          status: dataToUse.status || "NOT_CONTACTED",
          website: dataToUse.website || null,
          rating: dataToUse.rating || null,
          map_url: dataToUse.map_url || null,
          spoc_name: dataToUse.spoc_name || null,
          spoc_phone: dataToUse.spoc_phone || null,
          challenges: dataToUse.challenges || null,
          lat: dataToUse.lat ?? null,
          lng: dataToUse.lng ?? null,
          district: dataToUse.district || null,
          pincode: dataToUse.pincode || null,
          country: dataToUse.country || null,
          generic_email: dataToUse.generic_email || null,
        },
      }, {
        onSuccess: () => {
          setIsAddDialogOpen(false);
          resetForm();
        },
      });
    } else {
      addCoworkingSpaceMutation.mutate({
        state,
        city,
        payload: {
          name: dataToUse.name,
          city: city,
          state: state,
          address: dataToUse.address,
          contact_phone: dataToUse.phone || "",
          status: dataToUse.status || "NOT_CONTACTED",
          website: dataToUse.website || "",
          rating: dataToUse.rating || 0,
          map_url: dataToUse.map_url || "",
          builder_name: dataToUse.builder_name || "",
          security_agency_name: dataToUse.security_agency_name || "",
          property_manager_name: dataToUse.property_manager_name || "",
          property_manager_phone: dataToUse.property_manager_phone || "",
          property_manager_email: dataToUse.property_manager_email || "",
          parking_floors: dataToUse.parking_floors,
          total_floors: dataToUse.total_floors,
          basement_levels: dataToUse.basement_levels,
          spoc_name: dataToUse.spoc_name || "",
          spoc_phone: dataToUse.spoc_phone || "",
          seating_capacity: dataToUse.seating_capacity,
          challenges: dataToUse.challenges || "",
          lat: dataToUse.lat ?? undefined,
          lng: dataToUse.lng ?? undefined,
          exterior_media_url: dataToUse.exterior_media_url || "",
          exterior_media_urls: Array.isArray(dataToUse.exterior_media_urls) ? dataToUse.exterior_media_urls : undefined,
          generic_email: dataToUse.generic_email || "",
          operator_name: dataToUse.operator_name || "",
          campus_brand: dataToUse.campus_brand || "",
          legal_entity: dataToUse.legal_entity || "",
          campus_size_hint: dataToUse.campus_size_hint || "",
          district: dataToUse.district || "",
          pincode: dataToUse.pincode || "",
          country: dataToUse.country || "",
        }
      }, {
        onSuccess: () => {
          setIsAddDialogOpen(false);
          resetForm();
        }
      });
    }
  };

  const handleEdit = async (location: Location) => {
    const editableLocation = location as EditableLocationRow;
    setLocationToEdit(editableLocation);
    if (segment === "techParks") {
      try {
        const resp = await techParkService.getTechParkById(editableLocation.id);
        const techPark = resp?.data;
        setNewLocation({
          ...DEFAULT_NEW_LOCATION,
          id: editableLocation.id,
          name: techPark?.name || editableLocation.name || "",
          address: techPark?.address_line1 || editableLocation.address || "",
          website: techPark?.website || editableLocation.website || "",
          rating: typeof techPark?.rating === "number" ? techPark.rating : (editableLocation.rating || 0),
          phone: techPark?.reception_phone || editableLocation.phone || "",
          map_url: techPark?.map_url || editableLocation.map_url || "",
          status: techPark?.status || editableLocation.status || "NOT_CONTACTED",

          builder_name: techPark?.builder_name || "",
          security_agency_name: techPark?.security_agency_name || "",
          property_manager_name: techPark?.property_manager_name || "",
          property_manager_phone: techPark?.property_manager_phone || "",
          property_manager_email: techPark?.property_manager_email || "",
          parking_floors: typeof techPark?.parking_floors === "number" ? techPark.parking_floors : 0,
          total_floors: typeof techPark?.total_floors === "number" ? techPark.total_floors : 0,
          basement_levels: typeof techPark?.basement_levels === "number" ? techPark.basement_levels : 0,
          spoc_name: techPark?.spoc_name || "",
          spoc_phone: techPark?.spoc_phone || "",
          seating_capacity: typeof techPark?.seating_capacity === "number" ? techPark.seating_capacity : 0,
          challenges: techPark?.challenges || "",
          coordinates:
            typeof techPark?.lat === "number" && typeof techPark?.lng === "number"
              ? `${techPark.lat}, ${techPark.lng}`
              : "",
          exterior_media_url: techPark?.exterior_media_url || "",
          exterior_media_urls: Array.isArray(techPark?.exterior_media_urls)
            ? techPark.exterior_media_urls
            : techPark?.exterior_media_url
              ? [techPark.exterior_media_url]
              : [],
        });
      } catch {
        setNewLocation({
          ...DEFAULT_NEW_LOCATION,
          id: editableLocation.id,
          name: editableLocation.name || "",
          address: editableLocation.address || "",
          website: editableLocation.website || "",
          rating: editableLocation.rating || 0,
          phone: editableLocation.phone || "",
          map_url: editableLocation.map_url || "",
          status: editableLocation.status || "NOT_CONTACTED",
        });
      }
    } else {
      setNewLocation({
        ...DEFAULT_NEW_LOCATION,
        id: editableLocation.id,
        name: editableLocation.name || "",
        address: editableLocation.address || "",
        website: editableLocation.website || "",
        rating: editableLocation.rating || 0,
        phone: editableLocation.phone || "",
        map_url: editableLocation.map_url || "",
        status: editableLocation.status || "NOT_CONTACTED",
        builder_name: editableLocation.builder_name || "",
        security_agency_name: editableLocation.security_agency_name || "",
        property_manager_name: editableLocation.property_manager_name || "",
        property_manager_phone: editableLocation.property_manager_phone || "",
        property_manager_email: editableLocation.property_manager_email || "",
        parking_floors: editableLocation.parking_floors || 0,
        total_floors: editableLocation.total_floors || 0,
        basement_levels: editableLocation.basement_levels || 0,
        spoc_name: editableLocation.spoc_name || "",
        spoc_phone: editableLocation.spoc_phone || "",
        seating_capacity: editableLocation.seating_capacity || 0,
        challenges: editableLocation.challenges || "",
        lat: typeof editableLocation.lat === "number" ? editableLocation.lat : null,
        lng: typeof editableLocation.lng === "number" ? editableLocation.lng : null,
        exterior_media_url: editableLocation.exterior_media_url || "",
        exterior_media_urls: Array.isArray(editableLocation.exterior_media_urls) ? editableLocation.exterior_media_urls : [],
        generic_email: editableLocation.generic_email || "",
        campus_size_hint: editableLocation.campus_size_hint || "",
        district: editableLocation.district || "",
        pincode: editableLocation.pincode || "",
      });
    }
    // For generic venue segments, also populate from row data
    if (isGenericVenueSegment) {
      setNewLocation({
        ...DEFAULT_NEW_LOCATION,
        id: editableLocation.id,
        name: editableLocation.name || "",
        address: editableLocation.address || "",
        website: editableLocation.website || "",
        rating: editableLocation.rating || 0,
        phone: editableLocation.phone || "",
        map_url: editableLocation.map_url || "",
        status: editableLocation.status || "NOT_CONTACTED",
        spoc_name: editableLocation.spoc_name || "",
        spoc_phone: editableLocation.spoc_phone || "",
        challenges: editableLocation.challenges || "",
        lat: typeof editableLocation.lat === "number" ? editableLocation.lat : null,
        lng: typeof editableLocation.lng === "number" ? editableLocation.lng : null,
        district: editableLocation.district || "",
        pincode: editableLocation.pincode || "",
        generic_email: editableLocation.generic_email || "",
      });
    }
    setIsEditDialogOpen(true);
  };

  const handleEditLocation = async (locationData?: NewLocationData) => {
    if (!locationToEdit?.id) {
      toast.error("Invalid location data");
      return;
    }

    const dataToUse = locationData || newLocation;

    if (segment === "techParks") {
      editTechParkMutation.mutate({
        id: locationToEdit.id,
        payload: {
          name: dataToUse.name,
          address_line1: dataToUse.address,
          website: dataToUse.website || "",
          reception_phone: dataToUse.phone || "",
          status: dataToUse.status || "NOT_CONTACTED",
          rating: dataToUse.rating || 0,
          map_url: dataToUse.map_url || "",
          is_active: true,

          builder_name: dataToUse.builder_name || "",
          security_agency_name: dataToUse.security_agency_name || "",
          property_manager_name: dataToUse.property_manager_name || "",
          property_manager_phone: dataToUse.property_manager_phone || "",
          property_manager_email: dataToUse.property_manager_email || "",
          parking_floors: dataToUse.parking_floors,
          total_floors: dataToUse.total_floors,
          basement_levels: dataToUse.basement_levels,
          spoc_name: dataToUse.spoc_name || "",
          spoc_phone: dataToUse.spoc_phone || "",
          seating_capacity: dataToUse.seating_capacity,
          challenges: dataToUse.challenges || "",
          lat: dataToUse.lat ?? undefined,
          lng: dataToUse.lng ?? undefined,
          exterior_media_url: dataToUse.exterior_media_url || "",
          exterior_media_urls: Array.isArray(dataToUse.exterior_media_urls) ? dataToUse.exterior_media_urls : undefined,
        }
      }, {
        onSuccess: () => {
          setIsEditDialogOpen(false);
          setLocationToEdit(null);
          resetForm();
        }
      });
    } else if (isGenericVenueSegment && activeVenuePath) {
      genericUpdateMutation.mutate({
        venuePath: activeVenuePath,
        id: locationToEdit.id,
        payload: {
          name: dataToUse.name,
          address: dataToUse.address || null,
          reception_phone: dataToUse.phone || null,
          status: dataToUse.status || "NOT_CONTACTED",
          website: dataToUse.website || null,
          rating: dataToUse.rating || null,
          map_url: dataToUse.map_url || null,
          spoc_name: dataToUse.spoc_name || null,
          spoc_phone: dataToUse.spoc_phone || null,
          challenges: dataToUse.challenges || null,
          lat: dataToUse.lat ?? null,
          lng: dataToUse.lng ?? null,
          district: dataToUse.district || null,
          pincode: dataToUse.pincode || null,
          generic_email: dataToUse.generic_email || null,
        },
      }, {
        onSuccess: () => {
          setIsEditDialogOpen(false);
          setLocationToEdit(null);
          resetForm();
        },
      });
    } else {
      editCoworkingSpaceMutation.mutate({
        id: locationToEdit.id,
        payload: {
          name: dataToUse.name,
          address: dataToUse.address,
          contact_phone: dataToUse.phone || "",
          status: dataToUse.status || "NOT_CONTACTED",
          website: dataToUse.website || "",
          rating: dataToUse.rating || 0,
          map_url: dataToUse.map_url || "",
          builder_name: dataToUse.builder_name || "",
          security_agency_name: dataToUse.security_agency_name || "",
          property_manager_name: dataToUse.property_manager_name || "",
          property_manager_phone: dataToUse.property_manager_phone || "",
          property_manager_email: dataToUse.property_manager_email || "",
          parking_floors: dataToUse.parking_floors,
          total_floors: dataToUse.total_floors,
          basement_levels: dataToUse.basement_levels,
          spoc_name: dataToUse.spoc_name || "",
          spoc_phone: dataToUse.spoc_phone || "",
          seating_capacity: dataToUse.seating_capacity,
          challenges: dataToUse.challenges || "",
          lat: dataToUse.lat ?? undefined,
          lng: dataToUse.lng ?? undefined,
          exterior_media_url: dataToUse.exterior_media_url || "",
          exterior_media_urls: Array.isArray(dataToUse.exterior_media_urls) ? dataToUse.exterior_media_urls : undefined,
          generic_email: dataToUse.generic_email || "",
          operator_name: dataToUse.operator_name || "",
          campus_brand: dataToUse.campus_brand || "",
          legal_entity: dataToUse.legal_entity || "",
          campus_size_hint: dataToUse.campus_size_hint || "",
          district: dataToUse.district || "",
          pincode: dataToUse.pincode || "",
          country: dataToUse.country || "",
        }
      }, {
        onSuccess: () => {
          setIsEditDialogOpen(false);
          setLocationToEdit(null);
          resetForm();
        }
      });
    }
  };

  const handleDelete = (location: Location) => {
    setLocationToDelete(location as EditableLocationRow);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!locationToDelete) return;

    if (segment === "techParks") {
      deleteTechParkMutation.mutate(locationToDelete.id, {
        onSuccess: () => {
          setIsDeleteDialogOpen(false);
          setLocationToDelete(null);
        }
      });
    } else if (isGenericVenueSegment && activeVenuePath) {
      genericDeleteMutation.mutate({ venuePath: activeVenuePath, id: locationToDelete.id }, {
        onSuccess: () => {
          setIsDeleteDialogOpen(false);
          setLocationToDelete(null);
        },
      });
    } else {
      deleteCoworkingSpaceMutation.mutate(locationToDelete.id, {
        onSuccess: () => {
          setIsDeleteDialogOpen(false);
          setLocationToDelete(null);
        }
      });
    }
  };

  const handleChangeStatus = async (location: Location, newStatus: string) => {
    if (segment === "techParks") {
      changeTechParkStatusMutation.mutate({ id: location.id, status: newStatus });
    } else if (isGenericVenueSegment && activeVenuePath) {
      genericChangeStatusMutation.mutate({ venuePath: activeVenuePath, id: location.id, status: newStatus });
    } else {
      changeCoworkingStatusMutation.mutate({ id: location.id, status: newStatus });
    }
  };

  const handleVerifyLocation = (location: Location) => {
    if (!location?.id) return;
    if (!canApproveTechParkReview && !canSubmitTechParkReview) {
      toast.error("You are not allowed to submit or approve verification.");
      return;
    }
    if (segment === "techParks") {
      verifyTechParkMutation.mutate(location.id);
    } else if (isGenericVenueSegment && activeVenuePath) {
      genericVerifyMutation.mutate({ venuePath: activeVenuePath, id: location.id });
    } else {
      verifyCoworkingSpaceMutation.mutate(location.id);
    }
  };

  const handleUnverifyLocation = (location: Location) => {
    if (!location?.id) return;
    if (!canApproveTechParkReview) {
      toast.error("Only super admin can unverify locations.");
      return;
    }
    if (segment === "techParks") {
      unverifyTechParkMutation.mutate(location.id);
    } else if (isGenericVenueSegment && activeVenuePath) {
      genericUnverifyMutation.mutate({ venuePath: activeVenuePath, id: location.id });
    } else {
      unverifyCoworkingSpaceMutation.mutate(location.id);
    }
  };

  const handleBulkVerifyTechParks = () => {
    if (segment !== "techParks") return;
    if (!effectiveStateForCityView || !selectedCityForDetailView) {
      toast.error("State and city are required for bulk verification.");
      return;
    }

    verifyAllUnverifiedInCityMutation.mutate({
      state: effectiveStateForCityView,
      city: selectedCityForDetailView,
    });
  };

  const handleStateClick = (state: string) => {
    const basePath = getBasePath(pathname);
    if (segment === "techParks") {
      void queryClient.prefetchQuery({
        queryKey: ["techParks", "stateWise", state],
        queryFn: () => techParkService.getStateWiseOverview(state),
        staleTime: 5 * 60 * 1000,
      });
    } else if (segment === "coworkingSpaces") {
      void queryClient.prefetchQuery({
        queryKey: ["coworkingSpaces", "stateWise", state],
        queryFn: () => coworkingSpaceService.getStateWiseOverview(state),
        staleTime: 5 * 60 * 1000,
      });
    } else if (activeVenuePath) {
      void queryClient.prefetchQuery({
        queryKey: [segment, "stateWise", state],
        queryFn: () => VENUE_SERVICES[activeVenuePath].getStateWiseOverview(state),
        staleTime: 5 * 60 * 1000,
      });
    }
    navigate(`${basePath}/${encodeURIComponent(state)}`);
  };

  const handleBackToStates = () => {
    const basePath = getBasePath(pathname);
    navigate(basePath);
  };

  const handleCityClick = (city: string) => {
    if (effectiveStateForCityView) {
      const basePath = getBasePath(pathname);
      if (segment === "techParks") {
        void queryClient.prefetchQuery({
          queryKey: ["techParks", "cityWise", effectiveStateForCityView, city, 1, cityPageSize, "", "ALL"],
          queryFn: () =>
            techParkService.getCityWiseOverview(
              effectiveStateForCityView,
              city,
              1,
              cityPageSize,
              undefined,
              "ALL",
            ),
          staleTime: 2 * 60 * 1000,
        });
      } else if (segment === "coworkingSpaces") {
        void queryClient.prefetchQuery({
          queryKey: ["coworkingSpaces", "cityWise", effectiveStateForCityView, city, 1, cityPageSize, "ALL", ""],
          queryFn: () =>
            coworkingSpaceService.getCityWiseOverview(
              effectiveStateForCityView,
              city,
              1,
              cityPageSize,
              undefined,
              "ALL",
            ),
          staleTime: 2 * 60 * 1000,
        });
      } else if (activeVenuePath) {
        void queryClient.prefetchQuery({
          queryKey: [segment, "cityWise", effectiveStateForCityView, city, 1, cityPageSize, "", "ALL"],
          queryFn: () =>
            VENUE_SERVICES[activeVenuePath].getCityWiseOverview(
              effectiveStateForCityView,
              city,
              1,
              cityPageSize,
              undefined,
              "ALL",
            ),
          staleTime: 2 * 60 * 1000,
        });
      }
      navigate(`${basePath}/${encodeURIComponent(effectiveStateForCityView)}/${encodeURIComponent(city)}`);
    }
  };

  const handleBackToCities = () => {
    if (!effectiveStateForCityView) return;
    const basePath = getBasePath(pathname);
    navigate(`${basePath}/${encodeURIComponent(effectiveStateForCityView)}`);
  };


  const handleViewDetails = (row: Location) => {
    if (!effectiveStateForCityView || !selectedCityForDetailView) {
      toast.error("Unable to open details: missing state/city context.");
      return;
    }

    if (segment === "coworkingSpaces") {
      navigate(`/dashboard/coworking-spaces/${row.id}`);
      return;
    }

    // Generic venue types don't have a separate detail page — no-op for now
    if (isGenericVenueSegment) return;

    const basePath = getBasePath(pathname);
    navigate(
      `${basePath}/${encodeURIComponent(effectiveStateForCityView)}/${encodeURIComponent(selectedCityForDetailView)}/${row.id}`
    );
  };

  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const basePath = getBasePath(pathname);
    const tabLabel = getTabLabel(pathname, segment);

    const breadcrumbs: BreadcrumbItem[] = [
      { label: tabLabel, path: basePath, active: currentView === "states" }
    ];

    if (effectiveStateForCityView && currentView === "state-details") {
      breadcrumbs.push({
        label: effectiveStateForCityView,
        path: `${basePath}/${encodeURIComponent(effectiveStateForCityView)}`,
        active: currentView === "state-details"
      });
    }

    if (selectedCityForDetailView && currentView === "city-details") {
      const cityPath = effectiveStateForCityView
        ? `${basePath}/${encodeURIComponent(effectiveStateForCityView)}/${encodeURIComponent(selectedCityForDetailView)}`
        : basePath;
      breadcrumbs.push({
        label: selectedCityForDetailView,
        path: cityPath,
        active: currentView === "city-details"
      });
    }

    return breadcrumbs;
  };

  const currentOverviewData: CombinedOverviewData | undefined =
    segment === "techParks" ? overviewData :
    segment === "coworkingSpaces" ? coworkingOverviewData :
    genericVenueOverviewData;
  const currentStateWiseData: CombinedStateWiseData | undefined =
    segment === "techParks" ? stateWiseData :
    segment === "coworkingSpaces" ? coworkingStateWiseData :
    genericVenueStateWiseData;
  const currentCityWiseData: CombinedCityWiseData | undefined =
    segment === "techParks" ? cityWiseData :
    segment === "coworkingSpaces" ? coworkingCityWiseData :
    genericVenueCityWiseData;

  const statesDistribution = useMemo(() => {
    if (currentOverviewData?.stateData) {
      const labels = currentOverviewData.stateData.map(item => item.state);
      const values = currentOverviewData.stateData.map(item => item.count);
      return { labels, values };
    }
    return { labels: [], values: [] };
  }, [currentOverviewData]);


  const overallStats = useMemo(() => {
    if (segment === "techParks") {
      if (!overviewData) return undefined;
      return {
        total: overviewData.totalTechParks,
        contacted: overviewData.contactedTechParks,
        responseRate: overviewData.responseRate,
        positive: overviewData.positiveResponses,
      };
    }
    if (segment === "coworkingSpaces") {
      if (!coworkingOverviewData) return undefined;
      return {
        total: coworkingOverviewData.totalCoworkingSpaces,
        contacted: coworkingOverviewData.contactedCoworkingSpaces,
        responseRate: coworkingOverviewData.responseRate,
        positive: coworkingOverviewData.positiveResponses,
      };
    }
    if (!genericVenueOverviewData) return undefined;
    return {
      total: genericVenueOverviewData.total,
      contacted: genericVenueOverviewData.contacted,
      responseRate: genericVenueOverviewData.responseRate,
      positive: genericVenueOverviewData.positiveResponses,
    };
  }, [segment, overviewData, coworkingOverviewData, genericVenueOverviewData]);

  const stateRows = useMemo(() => {
    const stateData = currentOverviewData?.stateData ?? [];
    if (!Array.isArray(stateData) || stateData.length === 0) {
      return INDIA_STATES_AND_UTS.map((state) => ({ state, techParks: 0 }));
    }

    const countsByState = new Map<string, number>();
    stateData.forEach((x) => {
      if (!x || typeof x.state !== "string") return;
      const state = x.state.trim();
      if (!state) return;
      const count = typeof x.count === "number" ? x.count : Number(x.count || 0);
      countsByState.set(state, Number.isFinite(count) ? count : 0);
    });

    const rows = INDIA_STATES_AND_UTS.map((state) => ({
      state,
      techParks: countsByState.get(state) ?? 0,
    }));

    const extras = Array.from(countsByState.keys()).filter(
      (s) => !INDIA_STATES_AND_UTS.includes(s),
    );
    extras.sort((a, b) => a.localeCompare(b));
    extras.forEach((state) => {
      rows.push({ state, techParks: countsByState.get(state) ?? 0 });
    });

    return rows;
  }, [currentOverviewData]);

  const cityRows = useMemo(() => {
    if (currentStateWiseData?.cityData) {
      return currentStateWiseData.cityData.map(cityData => ({
        city: cityData.city,
        techParks: cityData.count,
      }));
    }
    return [];
  }, [currentStateWiseData]);

  const apiCity_LocationRows = useMemo(() => {
    if (!currentCityWiseData?.items) return [];
    return currentCityWiseData.items.map((item) => {
      const rawItem = item as RawCityItem;
      const exteriorMediaUrls = Array.isArray(rawItem.exterior_media_urls)
        ? rawItem.exterior_media_urls.filter((entry): entry is string => typeof entry === "string")
        : [];
      const isTechPark = segment === "techParks";

      return ({
        id: rawItem.id || "",
        name: rawItem.name || "",
        address: rawItem.address || "",
        website: typeof rawItem.website === "string" ? rawItem.website : "",
        rating: typeof rawItem.rating === "number" ? rawItem.rating : 0,
      total_ratings: 0,
        business_status: typeof rawItem.business_status === "string" ? rawItem.business_status : "OPERATIONAL",
        phone: rawItem.contact_phone || rawItem.reception_phone || rawItem.contactPhone || rawItem.contactNumber || "N/A",
        map_url: rawItem.map_url || rawItem.googleMapLink || "",
        lat: typeof rawItem.lat === "number" ? rawItem.lat : null,
        lng: typeof rawItem.lng === "number" ? rawItem.lng : null,
        opening_hours: typeof rawItem.opening_hours === "string" ? rawItem.opening_hours : "",
        status: (rawItem.status || "NOT_CONTACTED").toUpperCase(),

        // Additional fields to prevent data loss on edit
        builder_name: rawItem.builder_name || "",
        security_agency_name: rawItem.security_agency_name || "",
        property_manager_name: rawItem.property_manager_name || "",
        property_manager_phone: rawItem.property_manager_phone || "",
        property_manager_email: rawItem.property_manager_email || "",
        parking_floors: typeof rawItem.parking_floors === "number" ? rawItem.parking_floors : 0,
        total_floors: typeof rawItem.total_floors === "number" ? rawItem.total_floors : 0,
        basement_levels: typeof rawItem.basement_levels === "number" ? rawItem.basement_levels : 0,
        spoc_name: rawItem.spoc_name || "",
        spoc_phone: rawItem.spoc_phone || "",
        seating_capacity: typeof rawItem.seating_capacity === "number" ? rawItem.seating_capacity : 0,
        challenges: rawItem.challenges || "",
        exterior_media_url: rawItem.exterior_media_url || "",
        exterior_media_urls: exteriorMediaUrls,
        generic_email: rawItem.generic_email || "",
        operator_name: rawItem.operator_name || rawItem.operator || "",
        campus_brand: rawItem.campus_brand || rawItem.campusBrand || "",
        legal_entity: rawItem.legal_entity || "",
        campus_size_hint: rawItem.campus_size_hint || "",
        district: rawItem.district || "",
        pincode: rawItem.pincode || "",
        country: rawItem.country || "",
        ...(isTechPark
        ? {
          isVerified: Boolean(rawItem.isVerified),
          reviewStatus: rawItem.reviewStatus,
          submittedByUserId: rawItem.submittedByUserId || null,
          verificationLifecycleStatus: rawItem.verificationLifecycleStatus,
          isVerificationFormComplete: rawItem.isVerificationFormComplete,
          hasVerificationProgress: rawItem.hasVerificationProgress,
          verifiedAt: rawItem.verifiedAt || null,
          verifiedByName: rawItem.verifiedByName || null,
        }
        : {
          isVerified: Boolean(rawItem.isVerified),
          verifiedAt: rawItem.verifiedAt || null,
          verifiedByUserId: rawItem.verifiedByUserId || null,
        }),
      });
    });
  }, [currentCityWiseData, segment]);

  const cityVerificationBreakdown = useMemo(() => {
    const techParkBreakdown = cityWiseData?.verificationBreakdown;
    const coworkingBreakdown =
      (coworkingCityWiseData as unknown as { verificationBreakdown?: unknown } | undefined)
        ?.verificationBreakdown;
    const candidate = segment === "techParks" ? techParkBreakdown : coworkingBreakdown;
    return isVerificationBreakdown(candidate) ? candidate : undefined;
  }, [segment, cityWiseData, coworkingCityWiseData]);

  const cityStatusDistribution = useMemo(() => {
    if (!selectedCityForDetailView) return { labels: [], values: [] };
    if (currentCityWiseData?.statusBreakdown) {
      const allowed = [
        "NOT_CONTACTED",
        "CONTACTED",
        "INTERESTED",
        "MEETING_SCHEDULED",
        "PROPOSAL_SENT",
        "IN_PROGRESS",
        "CLOSED",
      ];
      const labels = allowed;
      const values = labels.map((k) => currentCityWiseData.statusBreakdown[k] ?? 0);
      return { labels, values };
    }
    return { labels: [], values: [] };
  }, [selectedCityForDetailView, currentCityWiseData]);

  const cityStats = useMemo(() => {
    if (segment === "techParks") {
      if (!cityWiseData) return null;
      return {
        total: cityWiseData.totalTechParks,
        contacted: cityWiseData.contactedTechParks,
        responseRate: cityWiseData.responseRate,
        positive: cityWiseData.positiveResponses,
      };
    }
    if (segment === "coworkingSpaces") {
      if (!coworkingCityWiseData) return null;
      return {
        total: coworkingCityWiseData.totalCoworkingSpaces,
        contacted: coworkingCityWiseData.contactedCoworkingSpaces,
        responseRate: coworkingCityWiseData.responseRate,
        positive: coworkingCityWiseData.positiveResponses,
      };
    }
    if (!genericVenueCityWiseData) return null;
    return {
      total: genericVenueCityWiseData.total,
      contacted: genericVenueCityWiseData.contacted,
      responseRate: genericVenueCityWiseData.responseRate,
      positive: genericVenueCityWiseData.positiveResponses,
    };
  }, [segment, cityWiseData, coworkingCityWiseData, genericVenueCityWiseData]);

  const routeStateStats = useMemo(() => {
    if (segment === "techParks") {
      if (!stateWiseData) return null;
      return {
        total: stateWiseData.totalTechParks,
        contacted: stateWiseData.contactedTechParks,
        responseRate: stateWiseData.responseRate,
        positive: stateWiseData.positiveResponses,
      };
    }
    if (segment === "coworkingSpaces") {
      if (!coworkingStateWiseData) return null;
      return {
        total: coworkingStateWiseData.totalCoworkingSpaces,
        contacted: coworkingStateWiseData.contactedCoworkingSpaces,
        responseRate: coworkingStateWiseData.responseRate,
        positive: coworkingStateWiseData.positiveResponses,
      };
    }
    if (!genericVenueStateWiseData) return null;
    return {
      total: genericVenueStateWiseData.total,
      contacted: genericVenueStateWiseData.contacted,
      responseRate: genericVenueStateWiseData.responseRate,
      positive: genericVenueStateWiseData.positiveResponses,
    };
  }, [segment, stateWiseData, coworkingStateWiseData, genericVenueStateWiseData]);

  const selectedStateCitiesDistributionRoute = useMemo(() => {
    if (currentStateWiseData?.cityData) {
      const labels = currentStateWiseData.cityData.map(item => item.city);
      const values = currentStateWiseData.cityData.map(item => item.count);
      return { labels, values };
    }
    return { labels: [], values: [] };
  }, [currentStateWiseData]);

  useEffect(() => {
    if (currentView !== "states") return;

    const topStates = (currentOverviewData?.stateData ?? [])
      .filter((item) => typeof item?.state === "string" && item.state.trim().length > 0)
      .slice(0, 4);

    topStates.forEach((item) => {
      const state = item.state.trim();

      if (segment === "techParks") {
        void queryClient.prefetchQuery({
          queryKey: ["techParks", "stateWise", state],
          queryFn: () => techParkService.getStateWiseOverview(state),
          staleTime: 5 * 60 * 1000,
        });
      } else if (segment === "coworkingSpaces") {
        void queryClient.prefetchQuery({
          queryKey: ["coworkingSpaces", "stateWise", state],
          queryFn: () => coworkingSpaceService.getStateWiseOverview(state),
          staleTime: 5 * 60 * 1000,
        });
      } else if (activeVenuePath) {
        void queryClient.prefetchQuery({
          queryKey: [segment, "stateWise", state],
          queryFn: () => VENUE_SERVICES[activeVenuePath].getStateWiseOverview(state),
          staleTime: 5 * 60 * 1000,
        });
      }
    });
  }, [currentOverviewData, currentView, queryClient, segment, activeVenuePath]);

  useEffect(() => {
    if (currentView !== "state-details" || !effectiveStateForCityView) return;

    const topCities = (currentStateWiseData?.cityData ?? [])
      .filter((item) => typeof item?.city === "string" && item.city.trim().length > 0)
      .slice(0, 5);

    topCities.forEach((item) => {
      const city = item.city.trim();

      if (segment === "techParks") {
        void queryClient.prefetchQuery({
          queryKey: ["techParks", "cityWise", effectiveStateForCityView, city, 1, cityPageSize, "", "ALL"],
          queryFn: () =>
            techParkService.getCityWiseOverview(
              effectiveStateForCityView,
              city,
              1,
              cityPageSize,
              undefined,
              "ALL",
            ),
          staleTime: 2 * 60 * 1000,
        });
      } else if (segment === "coworkingSpaces") {
        void queryClient.prefetchQuery({
          queryKey: ["coworkingSpaces", "cityWise", effectiveStateForCityView, city, 1, cityPageSize, "ALL", ""],
          queryFn: () =>
            coworkingSpaceService.getCityWiseOverview(
              effectiveStateForCityView,
              city,
              1,
              cityPageSize,
              undefined,
              "ALL",
            ),
          staleTime: 2 * 60 * 1000,
        });
      } else if (activeVenuePath) {
        void queryClient.prefetchQuery({
          queryKey: [segment, "cityWise", effectiveStateForCityView, city, 1, cityPageSize, "", "ALL"],
          queryFn: () =>
            VENUE_SERVICES[activeVenuePath].getCityWiseOverview(
              effectiveStateForCityView,
              city,
              1,
              cityPageSize,
              undefined,
              "ALL",
            ),
          staleTime: 2 * 60 * 1000,
        });
      }
    });
  }, [cityPageSize, currentStateWiseData, currentView, effectiveStateForCityView, queryClient, segment, activeVenuePath]);

  useEffect(() => {
    if (
      currentView !== "city-details" ||
      !effectiveStateForCityView ||
      !selectedCityForDetailView
    ) {
      return;
    }

    const totalPages =
      segment === "techParks" ? cityWiseData?.totalPages ?? 0 :
      segment === "coworkingSpaces" ? coworkingCityWiseData?.totalPages ?? 0 :
      genericVenueCityWiseData?.totalPages ?? 0;

    if (totalPages <= 1) return;

    const pagesToWarm = [cityPage + 1, cityPage - 1].filter(
      (page) => page >= 1 && page <= totalPages,
    );

    pagesToWarm.forEach((targetPage) => {
      if (segment === "techParks") {
        void queryClient.prefetchQuery({
          queryKey: [
            "techParks",
            "cityWise",
            effectiveStateForCityView,
            selectedCityForDetailView,
            targetPage,
            cityPageSize,
            debouncedCitySearchTerm,
            verificationFilter,
          ],
          queryFn: () =>
            techParkService.getCityWiseOverview(
              effectiveStateForCityView,
              selectedCityForDetailView,
              targetPage,
              cityPageSize,
              debouncedCitySearchTerm || undefined,
              verificationFilter,
            ),
          staleTime: 2 * 60 * 1000,
        });
        return;
      }

      if (segment === "coworkingSpaces") {
        void queryClient.prefetchQuery({
          queryKey: [
            "coworkingSpaces",
            "cityWise",
            effectiveStateForCityView,
            selectedCityForDetailView,
            targetPage,
            cityPageSize,
            verificationFilter,
            debouncedCitySearchTerm,
          ],
          queryFn: () =>
            coworkingSpaceService.getCityWiseOverview(
              effectiveStateForCityView,
              selectedCityForDetailView,
              targetPage,
              cityPageSize,
              debouncedCitySearchTerm || undefined,
              verificationFilter,
            ),
          staleTime: 2 * 60 * 1000,
        });
        return;
      }

      if (activeVenuePath) {
        void queryClient.prefetchQuery({
          queryKey: [
            segment,
            "cityWise",
            effectiveStateForCityView,
            selectedCityForDetailView,
            targetPage,
            cityPageSize,
            debouncedCitySearchTerm,
            verificationFilter,
          ],
          queryFn: () =>
            VENUE_SERVICES[activeVenuePath].getCityWiseOverview(
              effectiveStateForCityView,
              selectedCityForDetailView,
              targetPage,
              cityPageSize,
              debouncedCitySearchTerm || undefined,
              verificationFilter,
            ),
          staleTime: 2 * 60 * 1000,
        });
      }
    });
  }, [
    activeVenuePath,
    cityPage,
    cityPageSize,
    cityWiseData?.totalPages,
    coworkingCityWiseData?.totalPages,
    genericVenueCityWiseData?.totalPages,
    currentView,
    debouncedCitySearchTerm,
    effectiveStateForCityView,
    queryClient,
    segment,
    selectedCityForDetailView,
    verificationFilter,
  ]);


  if (isLoading && currentView === "states") {
    return <LoadingSpinner message="Loading overview data..." size="lg" />;
  }

  if (error && currentView === "states") {
    return <ErrorDisplay error={error} showRetry onRetry={() => window.location.reload()} />;
  }

  if (error && currentView === "state-details") {
    return (
      <div className="flex flex-col gap-6 p-4">
        <DashboardHeader title={getPageTitle(pathname, segment)} breadcrumbs={generateBreadcrumbs()} />
        <DashboardControls
          isLoading={isLoading}
          selectedState={selectedStateFilter}
          onStateChange={handleStateFilterChange}
        />
        <ErrorDisplay error={error} showRetry onRetry={() => window.location.reload()} />
      </div>
    );
  }

  const title = getPageTitle(pathname, segment);
  const breadcrumbs = generateBreadcrumbs();


  return (
    <div className="flex flex-col gap-6 p-4">
      <DashboardHeader title={title} breadcrumbs={breadcrumbs} />

      <DashboardControls
        isLoading={isLoading}
        selectedState={selectedStateFilter}
        onStateChange={handleStateFilterChange}
      />

      {currentView === "states" && selectedStateFilter === "ALL" && (
        <StatesView
          overallStats={overallStats}
          statesDistribution={statesDistribution}
          stateRows={stateRows}
          segment={segment}
          isLoading={isLoading}
          onStateClick={handleStateClick}
        />
      )}

      {currentView === "state-details" && effectiveStateForCityView && (
        <StateDetailsView
          stateStats={routeStateStats || undefined}
          citiesDistribution={selectedStateCitiesDistributionRoute}
          cityRows={cityRows}
          segment={segment}
          isLoading={currentStateWiseLoading}
          stateName={effectiveStateForCityView}
          onCityClick={handleCityClick}
          onBack={handleBackToStates}
        />
      )}

      {currentView === "city-details" && selectedCityForDetailView && (
        <CityDetailsView
          cityStats={cityStats || undefined}
          statusDistribution={cityStatusDistribution}
          locationRows={apiCity_LocationRows}
          segment={segment}
          isLoading={currentCityLoading}
          cityName={selectedCityForDetailView}
          stateName={effectiveStateForCityView}
          onBack={handleBackToCities}
          isAddDialogOpen={isAddDialogOpen}
          onAddDialogOpenChange={setIsAddDialogOpen}
          newLocation={newLocation}
          onNewLocationChange={setNewLocation}
          searchTerm={citySearchTerm}
          onSearchChange={setCitySearchTerm}
          onInputChange={handleInputChange}
          onAddLocation={handleAddLocation}
          onResetForm={resetForm}
          onViewDetails={handleViewDetails}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onChangeStatus={handleChangeStatus}
          onVerify={handleVerifyLocation}
          onUnverify={canApproveTechParkReview ? handleUnverifyLocation : undefined}
          onBulkVerify={handleBulkVerifyTechParks}
          canBulkVerify={canApproveTechParkReview}
          canApproveVerification={canApproveTechParkReview}
          isBulkVerifying={verifyAllUnverifiedInCityMutation.isPending}
          verificationFilter={verificationFilter}
          onVerificationFilterChange={setVerificationFilter}
          verificationBreakdown={cityVerificationBreakdown}
          error={cityStateResolutionError || currentCityError?.message || null}
          paginationInfo={{
            currentPage: cityPage,
            totalPages: (
              segment === "techParks" ? cityWiseData :
              segment === "coworkingSpaces" ? coworkingCityWiseData :
              genericVenueCityWiseData
            )?.totalPages || 1,
            totalItems: (
              segment === "techParks" ? cityWiseData :
              segment === "coworkingSpaces" ? coworkingCityWiseData :
              genericVenueCityWiseData
            )?.totalItems || 0,
            pageSize: cityPageSize,
            onPageChange: setCityPage,
          }}
          isSubmitting={addTechParkMutation.isPending || addCoworkingSpaceMutation.isPending || genericAddMutation.isPending}
          isSearchLoading={
            segment === "techParks" ? isCityFetching && !isCityLoading :
            segment === "coworkingSpaces" ? isCoworkingCityFetching && !isCoworkingCityLoading :
            segment === "malls" ? isMallsCityFetching && !isMallsCityLoading :
            segment === "hospitals" ? isHospitalsCityFetching && !isHospitalsCityLoading :
            segment === "stadiums" ? isStadiumsCityFetching && !isStadiumsCityLoading :
            isAirportsCityFetching && !isAirportsCityLoading
          }
        />
      )}

      <AddLocationDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        newLocation={newLocation}
        setNewLocation={setNewLocation}
        handleAddLocation={handleEditLocation}
        resetForm={resetForm}
        isSubmitting={editTechParkMutation.isPending || editCoworkingSpaceMutation.isPending || genericUpdateMutation.isPending}
        segment={segment}
        enableExtendedTechParkFields={true}
      />

      <DeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        locationToDelete={locationToDelete}
        isDeleting={deleteTechParkMutation.isPending || deleteCoworkingSpaceMutation.isPending || genericDeleteMutation.isPending}
        onConfirmDelete={confirmDelete}
      />
    </div>
  );
} 
