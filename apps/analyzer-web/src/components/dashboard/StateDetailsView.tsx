import { useState } from "react";
import { StatsRow } from "./StatsRow";
import { ChartCard } from "./ChartCard";
import { CitiesTable } from "./CitiesTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DashboardStats, ChartDistribution, CityRow, Segment } from "./types";
import { getSegmentSingularLabel } from "./constants";
import { useRoleAccess } from "@/hooks/use-role-access";
import { toast } from "sonner";
import { techParkService } from "@/services/techParkService";
import { coworkingSpaceService } from "@/services/coworkingSpaceService";
import { addCustomLocationOption } from "@/services/locationCatalogService";

type ApiErrorShape = {
  response?: {
    data?: {
      error?: string;
      message?: string;
    };
  };
  message?: string;
};

interface StateDetailsViewProps {
  stateStats?: DashboardStats;
  citiesDistribution: ChartDistribution;
  cityRows: CityRow[];
  segment: Segment;
  isLoading: boolean;
  stateName: string;
  onCityClick: (city: string) => void;
  onBack: () => void;
}

export function StateDetailsView({
  stateStats,
  citiesDistribution,
  cityRows,
  segment,
  isLoading,
  stateName,
  onCityClick,
  onBack,
}: StateDetailsViewProps) {
  const [isCityDialogOpen, setIsCityDialogOpen] = useState(false);
  const [cityName, setCityName] = useState("");
  const [cityError, setCityError] = useState<string | null>(null);
  const [isSavingCity, setIsSavingCity] = useState(false);
  const { isAdmin, isSalesManager } = useRoleAccess();
  const canManualAddCity = isAdmin || isSalesManager;

  const openCity = async () => {
    const city = cityName.trim();
    if (!city) {
      setCityError("City name is required");
      return;
    }
    if (city.length < 2) {
      setCityError("City name must be at least 2 characters");
      return;
    }
    setCityError(null);

    try {
      setIsSavingCity(true);
      if (segment === "coworkingSpaces") {
        await coworkingSpaceService.addCityToState(stateName, city);
      } else {
        await techParkService.addCityToState(stateName, city);
      }

      toast.success(`City "${city}" added under ${stateName}`);
      addCustomLocationOption(stateName, city);
      setIsCityDialogOpen(false);
      setCityName("");
      onCityClick(city);
    } catch (err: unknown) {
      const apiErr = err as ApiErrorShape;
      const apiError =
        apiErr.response?.data?.error ||
        apiErr.response?.data?.message ||
        apiErr.message ||
        "Failed to add city";
      toast.error(apiError);
    } finally {
      setIsSavingCity(false);
    }
  };

  return (
    <>
      <div>
        <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      <StatsRow stats={stateStats} segment={segment} isLoading={isLoading} />
      
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-base font-medium">Cities in {stateName}</h2>
        {canManualAddCity && (
          <Button type="button" variant="outline" onClick={() => setIsCityDialogOpen(true)}>
            Add City
          </Button>
        )}
      </div>
      
      {canManualAddCity && (
        <Dialog
          open={isCityDialogOpen}
          onOpenChange={(open) => {
            if (isSavingCity) return;
            setIsCityDialogOpen(open);
            if (!open) {
              setCityName("");
              setCityError(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Add City</DialogTitle>
              <DialogDescription>
                Create/open a city under <span className="font-medium">{stateName}</span> so the team can add a{" "}
                {getSegmentSingularLabel(segment).toLowerCase()} manually.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="space-y-1">
                <Label htmlFor="stateName">State</Label>
                <Input id="stateName" value={stateName} disabled />
              </div>

              <div className="space-y-1">
                <Label htmlFor="cityName">City Name</Label>
                <Input
                  id="cityName"
                  value={cityName}
                  onChange={(e) => {
                    setCityName(e.target.value);
                    if (cityError) setCityError(null);
                  }}
                  placeholder="Enter city name (e.g., Bengaluru)"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      openCity();
                    }
                  }}
                  className={cityError ? "border-red-500" : ""}
                  disabled={isSavingCity}
                />
                {cityError && <p className="text-sm text-red-500">{cityError}</p>}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCityDialogOpen(false)} disabled={isSavingCity}>
                Cancel
              </Button>
              <Button type="button" onClick={openCity} disabled={!cityName.trim() || isSavingCity}>
                {isSavingCity ? "Creating..." : "Create City"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      <ChartCard distribution={citiesDistribution} isLoading={isLoading} />
      
      <CitiesTable
        cityRows={cityRows}
        segment={segment}
        isLoading={isLoading}
        onViewDetails={onCityClick}
      />
    </>
  );
} 
