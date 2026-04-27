import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { CoworkingSpaceDashboard } from "@/components/coworking-spaces/CoworkingSpaceDashboard";
import { LoadingSpinner } from "@/components/dashboard/LoadingSpinner";
import { ErrorDisplay } from "@/components/dashboard/ErrorDisplay";
import { useCoworkingSpaceOverviewData, useCoworkingSpaceStateWiseData } from "@/hooks/use-coworking-space-queries";

export default function CoworkingSpacesPage() {
  const params = useParams<{ state?: string; city?: string }>();
  const navigate = useNavigate();
  const pathname = window.location.pathname;

  const [selectedStateFilter, setSelectedStateFilter] = useState("ALL");
  const [selectedCityFilter, setSelectedCityFilter] = useState("ALL");

  const currentView = useMemo(() => {
    if (pathname.includes('/dashboard/coworking-spaces/city')) return "city";
    if (pathname.includes('/dashboard/coworking-spaces/state')) return "state";
    return "national";
  }, [pathname]);

  const selectedStateForCityView = useMemo(() => {
    if (currentView === "city") return params.state;
    return selectedStateFilter !== "ALL" ? selectedStateFilter : null;
  }, [currentView, params.state, selectedStateFilter]);

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

  const isLoading = isOverviewLoading || isStateWiseLoading;
  const error = overviewError?.message || stateWiseError?.message || null;

  if (isLoading && currentView === "national") {
    return <LoadingSpinner message="Loading coworking spaces overview..." size="lg" />;
  }

  if (error && currentView === "national") {
    return <ErrorDisplay error={error} showRetry onRetry={() => window.location.reload()} />;
  }
  if (currentView === "national" && overviewData && overviewData.totalCoworkingSpaces === 0) {
    return (
      <div className="p-4 space-y-6">
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Coworking Spaces Yet</h2>
          <p className="text-gray-600 mb-6">
            Get started by adding your first coworking space. Sales team can add coworking spaces to begin tracking.
          </p>
          <div className="text-sm text-gray-500">
            Contact your sales team to add coworking spaces to the system.
          </div>
        </div>
      </div>
    );
  }

  if (currentView === "state" && stateWiseData && stateWiseData.totalCoworkingSpaces === 0) {
    return (
      <div className="p-4 space-y-6">
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Coworking Spaces in {selectedStateForCityView}</h2>
          <p className="text-gray-600 mb-6">
            No coworking spaces have been added to this state yet.
          </p>
          <button
            onClick={() => navigate('/dashboard/coworking-spaces')}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back to National Overview
          </button>
        </div>
      </div>
    );
  }

  return (
    <CoworkingSpaceDashboard
      selectedStateFilter={selectedStateFilter}
      selectedCityFilter={selectedCityFilter}
      onStateFilterChange={setSelectedStateFilter}
      onCityFilterChange={setSelectedCityFilter}
    />
  );
}
