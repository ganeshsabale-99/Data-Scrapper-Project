import { Button } from "@/components/ui/button";
import { StatsRow } from "./StatsRow";
import { ChartCard } from "./ChartCard";
import { LocationTable } from "@/pages/dashboard/LocationTable";
import { AddLocationDialog } from "@/components/add-location-dialog/AddLocationDialog";
import { Pagination } from "@/components/pagination/Pagination";
import { LoadingSpinner } from "./LoadingSpinner";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorDisplay } from "./ErrorDisplay";
import type { DashboardStats, ChartDistribution, Segment, NewLocationData } from "./types";
import type { VerifiedFilter } from "@/services/techParkService";
import { useRoleAccess } from "@/hooks/use-role-access";
import type { Location } from "@/pages/dashboard/LocationTable";

interface CityDetailsViewProps {
  cityStats?: DashboardStats;
  statusDistribution: ChartDistribution;
  locationRows: Location[];
  segment: Segment;
  isLoading: boolean;
  cityName: string;
  stateName?: string;
  isAddDialogOpen: boolean;
  onAddDialogOpenChange: (open: boolean) => void;
  newLocation: NewLocationData;
  onNewLocationChange: (location: NewLocationData) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onAddLocation: () => void;
  onResetForm: () => void;
  onViewDetails: (row: Location) => void;
  onEdit: (row: Location) => void;
  onDelete: (row: Location) => void;
  onChangeStatus: (row: Location, status: string) => void;
  onVerify?: (row: Location) => void;
  onUnverify?: (row: Location) => void;
  onBulkVerify?: () => void;
  canBulkVerify?: boolean;
  canApproveVerification?: boolean;
  isBulkVerifying?: boolean;
  verificationFilter?: VerifiedFilter;
  onVerificationFilterChange?: (value: VerifiedFilter) => void;
  verificationBreakdown?: {
    all: number;
    verified: number;
    unverified: number;
    appliedFilter: VerifiedFilter;
  };
  paginationInfo: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
  };
  error?: string | null;
  isSubmitting?: boolean;
  isSearchLoading?: boolean;
}

export function CityDetailsView({
  cityStats,
  statusDistribution,
  locationRows,
  segment,
  isLoading,
  cityName,
  stateName,
  isAddDialogOpen,
  onAddDialogOpenChange,
  newLocation,
  onNewLocationChange,
  searchTerm,
  onSearchChange,
  onInputChange: _onInputChange,
  onAddLocation,
  onResetForm,
  onViewDetails,
  onEdit,
  onDelete,
  onChangeStatus,
  onVerify,
  onUnverify,
  canApproveVerification = false,
  verificationFilter = "ALL",
  onVerificationFilterChange,
  verificationBreakdown,
  paginationInfo,
  error,
  isSubmitting,
  isSearchLoading,
}: CityDetailsViewProps) {
  const { isAdmin, isSalesManager } = useRoleAccess();
  const canManageLocations = isAdmin || isSalesManager;
  const canDeleteLocations = isAdmin;
  const showVerificationTabs = Boolean(onVerificationFilterChange);
  const verificationCounts = verificationBreakdown || {
    all: locationRows.length,
    verified: locationRows.filter((row) => row?.isVerified).length,
    unverified: locationRows.filter((row) => !row?.isVerified).length,
    appliedFilter: verificationFilter,
  };

  const verificationTabs: Array<{ key: VerifiedFilter; label: string; count: number }> = [
    { key: "ALL", label: "All", count: verificationCounts.all },
    { key: "VERIFIED", label: "Verified", count: verificationCounts.verified },
    {
      key: "UNVERIFIED",
      label: canApproveVerification ? "Unverified" : "Pending / In Progress",
      count: verificationCounts.unverified,
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <StatsRow stats={cityStats} segment={segment} isLoading={isLoading} />
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-medium">
            {cityName}
            {stateName && `, ${stateName}`}
          </h2>
        </div>
        <LoadingSpinner message="Loading city data..." size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <StatsRow stats={cityStats} segment={segment} isLoading={isLoading} />
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-medium">
            {cityName}
            {stateName && `, ${stateName}`}
          </h2>
        </div>
        <ErrorDisplay error={error} showRetry onRetry={() => window.location.reload()} />
      </div>
    );
  }

  if ((!locationRows || locationRows.length === 0) && !isLoading) {
    return (
      <div className="space-y-6">
        <StatsRow stats={cityStats} segment={segment} isLoading={isLoading} />
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-medium">
            {cityName}
            {stateName && `, ${stateName}`}
          </h2>
        </div>
        <ChartCard distribution={statusDistribution} isLoading={isLoading} />

        {showVerificationTabs ? (
          <div className="flex flex-wrap items-center gap-2">
            {verificationTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${verificationFilter === tab.key
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                onClick={() => onVerificationFilterChange?.(tab.key)}
              >
                <span>{tab.label}</span>
                <span className="text-xs text-slate-500">{tab.count}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex justify-end mb-2">
          <Button size="sm" onClick={() => onAddDialogOpenChange(true)}>
            {segment === "techParks" ? "Add Tech Park" : "Add Coworking Space"}
          </Button>
        </div>

        <Card>
          <CardContent className="p-12 text-center">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No data available</h3>
                <p className="text-muted-foreground">
                  {segment === "techParks"
                    ? "No tech parks found in this city."
                    : "No coworking spaces found in this city."
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <AddLocationDialog
          open={isAddDialogOpen}
          onOpenChange={onAddDialogOpenChange}
          newLocation={newLocation}
          setNewLocation={onNewLocationChange}
          handleAddLocation={onAddLocation}
          resetForm={onResetForm}
          segment={segment}
          enableExtendedTechParkFields={true}
          isSubmitting={isSubmitting}
        />
      </div>
    );
  }

  return (
    <>
      <StatsRow stats={cityStats} segment={segment} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h2 className="text-base font-medium break-words">
          {cityName}
          {stateName && `, ${stateName}`}
        </h2>
        <div className="flex w-full sm:w-auto gap-2">
          <Button size="sm" onClick={() => onAddDialogOpenChange(true)} className="w-full sm:w-auto">
            {segment === "techParks" ? "Add Tech Park" : "Add Coworking Space"}
          </Button>
        </div>
      </div>

      <ChartCard distribution={statusDistribution} isLoading={isLoading} />

      {showVerificationTabs ? (
        <div className="flex flex-wrap items-center gap-2">
          {verificationTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${verificationFilter === tab.key
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              onClick={() => onVerificationFilterChange?.(tab.key)}
            >
              <span>{tab.label}</span>
              <span className="text-xs text-slate-500">{tab.count}</span>
            </button>
          ))}
        </div>
      ) : null}

      <LocationTable
        data={locationRows}
        isLoading={isLoading}
        isSearchLoading={isSearchLoading}
        error={null}
        nameLabel={segment === "techParks" ? "Tech Park" : "Coworking Space"}
        locationLabel="Address"
        onViewDetails={onViewDetails}
        onEdit={onEdit}
        onDelete={onDelete}
        onChangeStatus={onChangeStatus}
        onVerify={onVerify}
        onUnverify={onUnverify}
        canApproveVerification={canApproveVerification}
        canEdit={canManageLocations}
        canChangeStatus={canManageLocations}
        canDelete={canDeleteLocations}
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
      />
      {segment !== "coworkingSpaces" && (
        <Pagination
          currentPage={paginationInfo.currentPage}
          totalPages={paginationInfo.totalPages}
          totalItems={paginationInfo.totalItems}
          pageSize={paginationInfo.pageSize}
          onPageChange={paginationInfo.onPageChange}
        />
      )}

      <AddLocationDialog
        open={isAddDialogOpen}
        onOpenChange={onAddDialogOpenChange}
        newLocation={newLocation}
        setNewLocation={onNewLocationChange}
        handleAddLocation={onAddLocation}
        resetForm={onResetForm}
        segment={segment}
        enableExtendedTechParkFields={true}
        isSubmitting={isSubmitting}
      />
    </>
  );
} 
