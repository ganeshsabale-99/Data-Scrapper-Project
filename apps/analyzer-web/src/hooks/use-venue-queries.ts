import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { VENUE_SERVICES, type VenueSegment } from "@/services/genericVenueService";
import type { VerifiedFilter } from "@/services/techParkService";

type QueryBehaviorOptions = { enabled?: boolean };

const readApiErrorMessage = (error: unknown, fallback: string): string => {
  const e = error as { response?: { data?: { message?: string; error?: string } }; message?: string };
  return e?.response?.data?.message || e?.response?.data?.error || e?.message || fallback;
};

function makeVenueQueryKeys(ns: VenueSegment) {
  return {
    all: [ns] as const,
    overview: () => [ns, "overview"] as const,
    stateWise: (state: string) => [ns, "stateWise", state] as const,
    cityWise: (state: string, city: string, page: number, pageSize: number, search: string, verified: string) =>
      [ns, "cityWise", state, city, page, pageSize, search, verified] as const,
  };
}

const mallKeys = makeVenueQueryKeys("malls");
const hospitalKeys = makeVenueQueryKeys("hospitals");
const stadiumKeys = makeVenueQueryKeys("stadiums");
const airportKeys = makeVenueQueryKeys("airports");

export const venueQueryKeys = { malls: mallKeys, hospitals: hospitalKeys, stadiums: stadiumKeys, airports: airportKeys };

// ── Overview hooks ─────────────────────────────────────────────────────────

export const useMallOverviewData = (options?: QueryBehaviorOptions) =>
  useQuery({
    queryKey: mallKeys.overview(),
    queryFn: () => VENUE_SERVICES.malls.getOverviewData(),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

export const useHospitalOverviewData = (options?: QueryBehaviorOptions) =>
  useQuery({
    queryKey: hospitalKeys.overview(),
    queryFn: () => VENUE_SERVICES.hospitals.getOverviewData(),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

export const useStadiumOverviewData = (options?: QueryBehaviorOptions) =>
  useQuery({
    queryKey: stadiumKeys.overview(),
    queryFn: () => VENUE_SERVICES.stadiums.getOverviewData(),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

export const useAirportOverviewData = (options?: QueryBehaviorOptions) =>
  useQuery({
    queryKey: airportKeys.overview(),
    queryFn: () => VENUE_SERVICES.airports.getOverviewData(),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

// ── State-wise hooks ────────────────────────────────────────────────────────

export const useMallStateWiseData = (state: string, options?: QueryBehaviorOptions) =>
  useQuery({
    queryKey: mallKeys.stateWise(state),
    queryFn: () => VENUE_SERVICES.malls.getStateWiseOverview(state),
    enabled: (options?.enabled ?? true) && !!state,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

export const useHospitalStateWiseData = (state: string, options?: QueryBehaviorOptions) =>
  useQuery({
    queryKey: hospitalKeys.stateWise(state),
    queryFn: () => VENUE_SERVICES.hospitals.getStateWiseOverview(state),
    enabled: (options?.enabled ?? true) && !!state,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

export const useStadiumStateWiseData = (state: string, options?: QueryBehaviorOptions) =>
  useQuery({
    queryKey: stadiumKeys.stateWise(state),
    queryFn: () => VENUE_SERVICES.stadiums.getStateWiseOverview(state),
    enabled: (options?.enabled ?? true) && !!state,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

export const useAirportStateWiseData = (state: string, options?: QueryBehaviorOptions) =>
  useQuery({
    queryKey: airportKeys.stateWise(state),
    queryFn: () => VENUE_SERVICES.airports.getStateWiseOverview(state),
    enabled: (options?.enabled ?? true) && !!state,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

// ── City-wise hooks ─────────────────────────────────────────────────────────

export const useMallCityWiseData = (
  state: string,
  city: string,
  page = 1,
  pageSize = 10,
  search = "",
  verified: VerifiedFilter = "ALL",
  options?: QueryBehaviorOptions,
) =>
  useQuery({
    queryKey: mallKeys.cityWise(state, city, page, pageSize, search, verified),
    queryFn: () => VENUE_SERVICES.malls.getCityWiseOverview(state, city, page, pageSize, search || undefined, verified),
    enabled: (options?.enabled ?? true) && !!state && !!city,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

export const useHospitalCityWiseData = (
  state: string,
  city: string,
  page = 1,
  pageSize = 10,
  search = "",
  verified: VerifiedFilter = "ALL",
  options?: QueryBehaviorOptions,
) =>
  useQuery({
    queryKey: hospitalKeys.cityWise(state, city, page, pageSize, search, verified),
    queryFn: () => VENUE_SERVICES.hospitals.getCityWiseOverview(state, city, page, pageSize, search || undefined, verified),
    enabled: (options?.enabled ?? true) && !!state && !!city,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

export const useStadiumCityWiseData = (
  state: string,
  city: string,
  page = 1,
  pageSize = 10,
  search = "",
  verified: VerifiedFilter = "ALL",
  options?: QueryBehaviorOptions,
) =>
  useQuery({
    queryKey: stadiumKeys.cityWise(state, city, page, pageSize, search, verified),
    queryFn: () => VENUE_SERVICES.stadiums.getCityWiseOverview(state, city, page, pageSize, search || undefined, verified),
    enabled: (options?.enabled ?? true) && !!state && !!city,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

export const useAirportCityWiseData = (
  state: string,
  city: string,
  page = 1,
  pageSize = 10,
  search = "",
  verified: VerifiedFilter = "ALL",
  options?: QueryBehaviorOptions,
) =>
  useQuery({
    queryKey: airportKeys.cityWise(state, city, page, pageSize, search, verified),
    queryFn: () => VENUE_SERVICES.airports.getCityWiseOverview(state, city, page, pageSize, search || undefined, verified),
    enabled: (options?.enabled ?? true) && !!state && !!city,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

// ── Generic mutations (accept venuePath to route to the right API) ──────────

export const useAddGenericVenue = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ venuePath, state, city, payload }: { venuePath: VenueSegment; state: string; city: string; payload: Record<string, unknown> }) =>
      VENUE_SERVICES[venuePath].addVenueToCity(state, city, payload),
    onError: (error: unknown) => {
      toast.error(readApiErrorMessage(error, "Failed to add venue"));
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: [vars.venuePath] });
      toast.success("Added successfully!");
    },
    onSettled: (_, __, vars) => {
      queryClient.invalidateQueries({ queryKey: [vars.venuePath] });
    },
  });
};

export const useDeleteGenericVenue = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ venuePath, id }: { venuePath: VenueSegment; id: string }) =>
      VENUE_SERVICES[venuePath].deleteVenue(id),
    onError: (error: unknown) => {
      toast.error(readApiErrorMessage(error, "Failed to delete"));
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: [vars.venuePath] });
      toast.success("Deleted successfully!");
    },
    onSettled: (_, __, vars) => {
      queryClient.invalidateQueries({ queryKey: [vars.venuePath] });
    },
  });
};

export const useChangeGenericVenueStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ venuePath, id, status }: { venuePath: VenueSegment; id: string; status: string }) =>
      VENUE_SERVICES[venuePath].changeStatus(id, status),
    onError: (error: unknown) => {
      toast.error(readApiErrorMessage(error, "Failed to change status"));
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: [vars.venuePath] });
      toast.success(`Status changed to ${vars.status.replace(/_/g, " ").toLowerCase()}`);
    },
    onSettled: (_, __, vars) => {
      queryClient.invalidateQueries({ queryKey: [vars.venuePath] });
    },
  });
};

export const useUpdateGenericVenue = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ venuePath, id, payload }: { venuePath: VenueSegment; id: string; payload: Record<string, unknown> }) =>
      VENUE_SERVICES[venuePath].updateVenue(id, payload),
    onError: (error: unknown) => {
      toast.error(readApiErrorMessage(error, "Failed to update"));
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: [vars.venuePath] });
      toast.success("Updated successfully!");
    },
    onSettled: (_, __, vars) => {
      queryClient.invalidateQueries({ queryKey: [vars.venuePath] });
    },
  });
};

export const useVerifyGenericVenue = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ venuePath, id }: { venuePath: VenueSegment; id: string }) =>
      VENUE_SERVICES[venuePath].verifyVenue(id),
    onError: (error: unknown) => {
      toast.error(readApiErrorMessage(error, "Failed to verify"));
    },
    onSuccess: (res, vars) => {
      queryClient.invalidateQueries({ queryKey: [vars.venuePath] });
      toast.success(res?.message || "Verified successfully");
    },
    onSettled: (_, __, vars) => {
      queryClient.invalidateQueries({ queryKey: [vars.venuePath] });
    },
  });
};

export const useUnverifyGenericVenue = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ venuePath, id }: { venuePath: VenueSegment; id: string }) =>
      VENUE_SERVICES[venuePath].unverifyVenue(id),
    onError: (error: unknown) => {
      toast.error(readApiErrorMessage(error, "Failed to unverify"));
    },
    onSuccess: (res, vars) => {
      queryClient.invalidateQueries({ queryKey: [vars.venuePath] });
      toast.success(res?.message || "Marked as unverified");
    },
    onSettled: (_, __, vars) => {
      queryClient.invalidateQueries({ queryKey: [vars.venuePath] });
    },
  });
};
