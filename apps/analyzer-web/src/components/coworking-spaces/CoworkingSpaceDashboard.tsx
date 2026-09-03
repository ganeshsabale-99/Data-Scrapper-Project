import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Building2, Users, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ChartContainer } from "@/components/charts/chart-containers";
import { Pagination } from "@/components/pagination/Pagination";
import { LocationTable, type Location } from "@/pages/dashboard/LocationTable";
import { AddCoworkingSpaceDialog } from "./AddCoworkingSpaceDialog";
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
import { LoadingSpinner } from "@/components/dashboard/LoadingSpinner";
import { ErrorDisplay } from "@/components/dashboard/ErrorDisplay";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRoleAccess } from "@/hooks/use-role-access";
import { coworkingSpaceService, type CoworkingSpaceCityWiseOverviewItem } from "@/services/coworkingSpaceService";

type CoworkingSpacePayload = Parameters<typeof coworkingSpaceService.addCoworkingSpaceToCity>[0]["payload"];
type CoworkingSpaceUpdatePayload = Parameters<typeof coworkingSpaceService.updateCoworkingSpace>[1];
type CoworkingSpaceRowRef = { id: string };
type CoworkingVerificationFilter = 'ALL' | 'VERIFIED' | 'UNVERIFIED';
type CoworkingSpaceListItem = CoworkingSpaceCityWiseOverviewItem & {
  isVerified?: boolean;
  reviewStatus?: string;
  verifiedByUser?: { name?: string };
  verifiedAt?: string;
  verificationLifecycleStatus?: string;
  isVerificationFormComplete?: boolean;
  hasVerificationProgress?: boolean;
};

const normalizeReviewStatus = (value?: string) => {
  if (value === "PENDING_REVIEW" || value === "APPROVED" || value === "REJECTED") {
    return value;
  }
  return undefined;
};

const normalizeLifecycleStatus = (value?: string) => {
  if (
    value === "PENDING" ||
    value === "IN_PROGRESS" ||
    value === "READY_FOR_REVIEW" ||
    value === "VERIFIED" ||
    value === "REJECTED"
  ) {
    return value;
  }
  return undefined;
};

const mapLocationToUpdatePayload = (location: Location): CoworkingSpaceUpdatePayload => ({
  name: location.name,
  address: location.address,
  contact_phone: location.phone,
  status: location.status,
  website: location.website,
  rating: location.rating,
  map_url: location.map_url,
  lat: location.lat ?? undefined,
  lng: location.lng ?? undefined,
});

interface CoworkingSpaceDashboardProps {
  selectedStateFilter?: string;
  selectedCityFilter?: string;
  onStateFilterChange?: (state: string) => void;
  onCityFilterChange?: (city: string) => void;
}

export function CoworkingSpaceDashboard({
  selectedStateFilter = "ALL",
  selectedCityFilter = "ALL",
}: CoworkingSpaceDashboardProps) {
  const params = useParams<{ state?: string; city?: string }>();
  const navigate = useNavigate();
  const { isAdmin, isSalesManager } = useRoleAccess();
  const pathname = window.location.pathname;
  const [searchTerm, setSearchTerm] = useState("");
  const [verificationFilter, setVerificationFilter] = useState<'ALL' | 'VERIFIED' | 'UNVERIFIED'>('ALL');

  const [cityPage, setCityPage] = useState(1);
  const cityPageSize = 10;

  const currentView = useMemo(() => {
    if (pathname.includes('/dashboard/coworking-spaces/city')) return "city";
    if (pathname.includes('/dashboard/coworking-spaces/state')) return "state";
    return "national";
  }, [pathname]);

  const selectedStateForCityView = useMemo(() => {
    if (currentView === "city") return params.state;
    return selectedStateFilter !== "ALL" ? selectedStateFilter : null;
  }, [currentView, params.state, selectedStateFilter]);

  const selectedCityForDetailView = useMemo(() => {
    if (currentView === "city") return params.city;
    return selectedCityFilter !== "ALL" ? selectedCityFilter : null;
  }, [currentView, params.city, selectedCityFilter]);

  const {
    data: overviewData,
    isLoading: isOverviewLoading,
    error: overviewError
  } = useCoworkingSpaceOverviewData();

  const {
    data: stateWiseData,
    isLoading: isStateWiseLoading,
    error: stateWiseError
  } = useCoworkingSpaceStateWiseData(selectedStateForCityView || "");

  const {
    data: cityWiseData,
    isLoading: isCityLoading,
    error: cityError
  } = useCoworkingSpaceCityWiseData(
    selectedStateForCityView || "",
    selectedCityForDetailView || "",
    cityPage,
    cityPageSize,
    searchTerm || undefined,
    verificationFilter
  );

  const addCoworkingSpaceMutation = useAddCoworkingSpace();
  const deleteCoworkingSpaceMutation = useDeleteCoworkingSpace();
  const changeStatusMutation = useChangeStatus();
  const editCoworkingSpaceMutation = useUpdateCoworkingSpace();
  const verifyMutation = useVerifyCoworkingSpace();
  const unverifyMutation = useUnverifyCoworkingSpace();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const canManageCoworkingData = isAdmin || isSalesManager;
  const canDeleteCoworkingData = isAdmin;
  const canVerifyCoworkingData = isAdmin; // Update based on actual role


  const isLoading = isOverviewLoading || isStateWiseLoading || isCityLoading;
  const error = overviewError?.message || stateWiseError?.message || cityError?.message || null;

  const nationalStats = useMemo(() => {
    if (!overviewData) return null;

    return {
      totalCoworkingSpaces: overviewData.totalCoworkingSpaces,
      contactedCoworkingSpaces: overviewData.contactedCoworkingSpaces,
      positiveResponses: overviewData.positiveResponses,
      responseRate: overviewData.responseRate,
    };
  }, [overviewData]);

  const stateStats = useMemo(() => {
    if (!stateWiseData) return null;

    return {
      totalCoworkingSpaces: stateWiseData.totalCoworkingSpaces,
      contactedCoworkingSpaces: stateWiseData.contactedCoworkingSpaces,
      positiveResponses: stateWiseData.positiveResponses,
      responseRate: stateWiseData.responseRate,
    };
  }, [stateWiseData]);

  const cityStats = useMemo(() => {
    if (!cityWiseData) return null;

    return {
      totalCoworkingSpaces: cityWiseData.totalCoworkingSpaces,
      contactedCoworkingSpaces: cityWiseData.contactedCoworkingSpaces,
      positiveResponses: cityWiseData.positiveResponses,
      responseRate: cityWiseData.responseRate,
    };
  }, [cityWiseData]);

  const statusDistribution = useMemo(() => {
    const data = currentView === "national" ? overviewData?.stateData :
      currentView === "state" ? stateWiseData?.cityData :
        cityWiseData?.statusBreakdown;

    if (!data) return { labels: [], values: [] };

    if (currentView === "city" && cityWiseData?.statusBreakdown) {
      const breakdown = cityWiseData.statusBreakdown;
      return {
        labels: Object.keys(breakdown),
        values: Object.values(breakdown),
      };
    }

    if (Array.isArray(data)) {
      return {
        labels: data.map(item => (item as { city?: string; state?: string }).city || (item as { city?: string; state?: string }).state || ''),
        values: data.map(item => (item as { count: number }).count),
      };
    }

    return { labels: [], values: [] };
  }, [currentView, overviewData, stateWiseData, cityWiseData]);

  const handleAddCoworkingSpace = async (coworkingSpaceData: CoworkingSpacePayload) => {
    if (!selectedStateForCityView || !selectedCityForDetailView) {
      console.error("State and city must be selected");
      return;
    }

    await addCoworkingSpaceMutation.mutateAsync({
      state: selectedStateForCityView,
      city: selectedCityForDetailView,
      payload: coworkingSpaceData,
    });
  };

  const handleDeleteCoworkingSpace = async (location: { id: string }) => {
    await deleteCoworkingSpaceMutation.mutateAsync(location.id);
  };

  const handleChangeStatus = async (location: { id: string }, status: string) => {
    await changeStatusMutation.mutateAsync({ id: location.id, status });
  };

  const handleEditCoworkingSpace = async (id: string, data: CoworkingSpaceUpdatePayload) => {
    await editCoworkingSpaceMutation.mutateAsync({ id, payload: data });
  };

  const handleVerify = async (coworkingSpace: CoworkingSpaceRowRef) => {
    await verifyMutation.mutateAsync(coworkingSpace.id);
  };

  const handleUnverify = async (coworkingSpace: CoworkingSpaceRowRef) => {
    await unverifyMutation.mutateAsync(coworkingSpace.id);
  };

  const handleViewDetails = (coworkingSpace: CoworkingSpaceRowRef) => {
    navigate(`/dashboard/coworking-spaces/${coworkingSpace.id}`);
  };

  if (isLoading && currentView === "national") {
    return <LoadingSpinner message="Loading coworking spaces overview..." size="lg" />;
  }

  if (error && currentView === "national") {
    return <ErrorDisplay error={error} showRetry onRetry={() => window.location.reload()} />;
  }

  const currentStats = currentView === "national" ? nationalStats :
    currentView === "state" ? stateStats :
      cityStats;

  if (!currentStats) {
    return <LoadingSpinner message="Loading data..." size="lg" />;
  }

  const statCards: Array<{
    title: string;
    value: number;
    icon: LucideIcon;
    color: string;
    bgColor: string;
  }> = [
    {
      title: 'Total Coworking Spaces',
      value: currentStats.totalCoworkingSpaces,
      icon: Building2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Contacted Spaces',
      value: currentStats.contactedCoworkingSpaces,
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
  ];

  const getPageTitle = () => {
    if (currentView === "city") return `Coworking Spaces in ${params.city}, ${params.state}`;
    if (currentView === "state") return `Coworking Spaces in ${selectedStateForCityView}`;
    return "Coworking Spaces Overview";
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{getPageTitle()}</h1>
          <p className="text-muted-foreground">
            {currentView === "national" && "Overview of all coworking spaces across India"}
            {currentView === "state" && `Coworking spaces in ${selectedStateForCityView}`}
            {currentView === "city" && `Coworking spaces in ${params.city}, ${params.state}`}
          </p>
        </div>

        {currentView === "city" && (
          <Button onClick={() => setIsAddDialogOpen(true)} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Add Coworking Space
          </Button>
        )}
      </div>

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
        <CardHeader>
          <CardTitle>
            {currentView === "city" ? "Status Distribution" :
              currentView === "state" ? "City Distribution" :
                "State Distribution"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            data={{
              statusCounts: statusDistribution.values.reduce((acc, val, index) => {
                acc[statusDistribution.labels[index]] = val;
                return acc;
              }, {} as Record<string, number>)
            }}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>


      {currentView === "city" && cityWiseData && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full sm:w-auto">
              <h2 className="text-xl font-semibold">Coworking Spaces</h2>
              <Tabs
                value={verificationFilter}
                onValueChange={(v: string) => {
                  if (v !== "ALL" && v !== "VERIFIED" && v !== "UNVERIFIED") return;
                  setVerificationFilter(v as CoworkingVerificationFilter);
                  setCityPage(1); // Reset page on filter change
                }}
                className="w-full sm:w-auto"
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="ALL">All</TabsTrigger>
                  <TabsTrigger value="VERIFIED">Verified</TabsTrigger>
                  <TabsTrigger value="UNVERIFIED">Unverified</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <SearchInput
              placeholder="Search coworking spaces..."
              value={searchTerm}
              onChange={setSearchTerm}
              className="w-full sm:max-w-md"
            />
          </div>

          <LocationTable
            data={cityWiseData.items.map((cs: CoworkingSpaceListItem) => ({
              id: cs.id,
              name: cs.name,
              address: cs.address || 'N/A',
              website: cs.operator || 'N/A',
              rating: cs.rating ?? 0,
              total_ratings: cs.total_ratings ?? 0,
              company_count: cs.company_count,
              business_status: cs.status,
              phone: cs.contactPhone || 'N/A',
              map_url: '',
              opening_hours: '',
              status: cs.status,
              serialNumber: cs.serialNumber,
              isVerified: cs.isVerified,
              reviewStatus: normalizeReviewStatus(cs.reviewStatus),
              verifiedByName: cs?.verifiedByUser?.name,
              verifiedAt: cs.verifiedAt,
              verificationLifecycleStatus: normalizeLifecycleStatus(cs.verificationLifecycleStatus),
              isVerificationFormComplete: cs.isVerificationFormComplete,
              hasVerificationProgress: cs.hasVerificationProgress,
              review_priority: cs.review_priority,
              review_issue_score: cs.review_issue_score,
              reviews_analyzed: cs.reviews_analyzed,
              issue_review_count: cs.issue_review_count,
              parking_review_count: cs.parking_review_count,
              builder_name: cs.builder_name,
              security_agency_name: cs.security_agency_name,
              property_manager_name: cs.property_manager_name,
            }))}
            nameLabel="Coworking Space"
            locationLabel="Address"
            enableSearch={false}
            onViewDetails={handleViewDetails}
            onEdit={(cs) => handleEditCoworkingSpace(cs.id, mapLocationToUpdatePayload(cs))}
            onChangeStatus={handleChangeStatus}
            onDelete={handleDeleteCoworkingSpace}
            onVerify={handleVerify}
            onUnverify={handleUnverify}
            canApproveVerification={canVerifyCoworkingData}
            canEdit={canManageCoworkingData}
            canChangeStatus={canManageCoworkingData}
            canDelete={canDeleteCoworkingData}
          />

          <Pagination
            currentPage={cityWiseData.page}
            totalPages={cityWiseData.totalPages}
            totalItems={cityWiseData.totalItems}
            pageSize={cityWiseData.pageSize}
            onPageChange={(page) => setCityPage(page)}
          />
        </div>
      )}

      <AddCoworkingSpaceDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAddCoworkingSpace={handleAddCoworkingSpace}
        state={selectedStateForCityView || ""}
        city={selectedCityForDetailView || ""}
        isLoading={addCoworkingSpaceMutation.isPending}
      />
    </div>
  );
}
