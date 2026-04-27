import { useQuery, useMutation, useQueryClient, keepPreviousData, type QueryKey } from "@tanstack/react-query";
import { techParkService, type VerifiedFilter } from "@/services/techParkService";
import { toast } from "sonner";

// Query Keys
export const techParkKeys = {
  all: ['techParks'] as const,
  overview: () => [...techParkKeys.all, 'overview'] as const,
  stateWise: (state: string) => [...techParkKeys.all, 'stateWise', state] as const,
  cityWise: (
    state: string,
    city: string,
    page: number,
    pageSize: number,
    search: string = "",
    verified: VerifiedFilter = "ALL",
  ) =>
    [...techParkKeys.all, 'cityWise', state, city, page, pageSize, search, verified] as const,
};

const readApiErrorMessage = (error: unknown, fallback: string): string => {
  const errorObj = error as {
    response?: { status?: number; data?: { message?: string; error?: string } };
    message?: string;
  };
  let apiError = errorObj?.response?.data?.message || errorObj?.response?.data?.error;
  if (!apiError && errorObj?.response?.status === 413) {
    apiError = "Payload Too Large: File or data exceeds maximum allowed size";
  }
  return apiError || errorObj?.message || fallback;
};

// Hooks for fetching data
export const useOverviewData = () => {
  return useQuery({
    queryKey: techParkKeys.overview(),
    queryFn: () => techParkService.getOverviewData(),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
  });
};

export const useStateWiseData = (state: string) => {
  return useQuery({
    queryKey: techParkKeys.stateWise(state),
    queryFn: () => techParkService.getStateWiseOverview(state),
    enabled: !!state,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
  });
};

export const useCityWiseData = (
  state: string,
  city: string,
  page: number = 1,
  pageSize: number = 10,
  search: string = "",
  verified: VerifiedFilter = "ALL",
) => {
  return useQuery({
    queryKey: techParkKeys.cityWise(state, city, page, pageSize, search, verified),
    queryFn: () => techParkService.getCityWiseOverview(state, city, page, pageSize, search || undefined, verified),
    enabled: !!state && !!city,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

// Mutation hooks for data modifications
export const useAddTechPark = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: techParkService.addTechParkToCity,
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: techParkKeys.all });

      // Snapshot the previous values
      const previousOverview = queryClient.getQueryData(techParkKeys.overview());
      const previousStateWise = queryClient.getQueryData(techParkKeys.stateWise(variables.state));
      const previousCityWise = queryClient.getQueryData(techParkKeys.cityWise(variables.state, variables.city, 1, 10, "", "ALL"));

      return { previousOverview, previousStateWise, previousCityWise };
    },
    onError: (error: unknown, variables, context) => {
      // Rollback on error
      if (context?.previousOverview) {
        queryClient.setQueryData(techParkKeys.overview(), context.previousOverview);
      }
      if (context?.previousStateWise) {
        queryClient.setQueryData(techParkKeys.stateWise(variables.state), context.previousStateWise);
      }
      if (context?.previousCityWise) {
        queryClient.setQueryData(techParkKeys.cityWise(variables.state, variables.city, 1, 10, "", "ALL"), context.previousCityWise);
      }

      const apiError = readApiErrorMessage(error, "Failed to add tech park");
      console.error("Failed to add tech park", error);
      toast.error(apiError);
    },
    onSuccess: () => {
      // Refresh all tech park views to avoid cross-page stale data.
      queryClient.invalidateQueries({
        queryKey: techParkKeys.all,
      });

      toast.success("Tech park added successfully!");
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({
        queryKey: techParkKeys.all,
      });
    },
  });
};

export const useDeleteTechPark = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: techParkService.deleteTechPark,
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: techParkKeys.all });

      // Snapshot all previous values
      const previousQueries = new Map<QueryKey, unknown>();

      // Get all cached queries
      const queryCache = queryClient.getQueryCache();
      queryCache.getAll().forEach(query => {
        if (query.queryKey[0] === 'techParks') {
          previousQueries.set(query.queryKey, query.state.data);
        }
      });

      return { previousQueries };
    },
    onError: (error: unknown, _, context) => {
      // Rollback all queries on error
      if (context?.previousQueries) {
        context.previousQueries.forEach((data: unknown, queryKey: QueryKey) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      const apiError = readApiErrorMessage(error, "Failed to delete tech park");
      console.error("Failed to delete tech park", error);
      toast.error(apiError);
    },
    onSuccess: () => {
      // Invalidate all queries to refresh data
      queryClient.invalidateQueries({
        queryKey: techParkKeys.all,
      });

      toast.success("Tech park deleted successfully!");
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: techParkKeys.all,
      });
    },
  });
};

export const useChangeTechParkStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      techParkService.changeTechParkStatus(id, status),
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: techParkKeys.all });

      // Snapshot previous values
      const previousQueries = new Map<QueryKey, unknown>();
      const queryCache = queryClient.getQueryCache();
      queryCache.getAll().forEach(query => {
        if (query.queryKey[0] === 'techParks') {
          previousQueries.set(query.queryKey, query.state.data);
        }
      });

      return { previousQueries };
    },
    onError: (error: unknown, _, context) => {
      // Rollback on error
      if (context?.previousQueries) {
        context.previousQueries.forEach((data: unknown, queryKey: QueryKey) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      const apiError = readApiErrorMessage(error, "Failed to change status");
      console.error("Failed to change status", error);
      toast.error(apiError);
    },
    onSuccess: (_, variables) => {
      // Invalidate all queries to refresh data
      queryClient.invalidateQueries({
        queryKey: techParkKeys.all,
      });

      toast.success(`Status changed to ${variables.status.replace(/_/g, ' ').toLowerCase()}`);
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: techParkKeys.all,
      });
    },
  });
};

export const useEditTechPark = () => {
  const queryClient = useQueryClient();
  type EditTechParkPayload = Parameters<typeof techParkService.editTechPark>[1];

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EditTechParkPayload }) =>
      techParkService.editTechPark(id, payload),
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: techParkKeys.all });

      // Snapshot previous values
      const previousQueries = new Map<QueryKey, unknown>();
      const queryCache = queryClient.getQueryCache();
      queryCache.getAll().forEach(query => {
        if (query.queryKey[0] === 'techParks') {
          previousQueries.set(query.queryKey, query.state.data);
        }
      });

      return { previousQueries };
    },
    onError: (error: unknown, _, context) => {
      // Rollback on error
      if (context?.previousQueries) {
        context.previousQueries.forEach((data: unknown, queryKey: QueryKey) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      const apiError = readApiErrorMessage(error, "Failed to edit tech park");
      console.error("Failed to edit tech park", error);
      toast.error(apiError);
    },
    onSuccess: () => {
      // Invalidate all queries to refresh data
      queryClient.invalidateQueries({
        queryKey: techParkKeys.all,
      });

      toast.success("Tech park updated successfully!");
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: techParkKeys.all,
      });
    },
  });
};

export const useVerifyTechPark = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => techParkService.verifyTechPark(id),
    onError: (error: unknown) => {
      const apiError = readApiErrorMessage(error, "Failed to verify tech park");
      console.error("Failed to verify tech park", error);
      toast.error(apiError);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({
        queryKey: techParkKeys.all,
      });
      toast.success(response?.message || "Tech park verified successfully");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: techParkKeys.all,
      });
    },
  });
};

export const useUnverifyTechPark = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => techParkService.unverifyTechPark(id),
    onError: (error: unknown) => {
      const apiError = readApiErrorMessage(error, "Failed to unverify tech park");
      console.error("Failed to unverify tech park", error);
      toast.error(apiError);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({
        queryKey: techParkKeys.all,
      });
      toast.success(response?.message || "Tech park marked as unverified");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: techParkKeys.all,
      });
    },
  });
};

export const useVerifyAllUnverifiedInCity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ state, city }: { state: string; city: string }) =>
      techParkService.verifyAllUnverifiedInCity(state, city),
    onError: (error: unknown) => {
      const apiError = readApiErrorMessage(error, "Failed to bulk verify tech parks");
      console.error("Failed to bulk verify tech parks", error);
      toast.error(apiError);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({
        queryKey: techParkKeys.all,
      });
      toast.success(response?.message || "Tech parks verified successfully");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: techParkKeys.all,
      });
    },
  });
};

// Utility hook to prefetch data
export const usePrefetchTechParkData = () => {
  const queryClient = useQueryClient();

  const prefetchOverview = () => {
    queryClient.prefetchQuery({
      queryKey: techParkKeys.overview(),
      queryFn: () => techParkService.getOverviewData(),
      staleTime: 5 * 60 * 1000,
    });
  };

  const prefetchStateWise = (state: string) => {
    queryClient.prefetchQuery({
      queryKey: techParkKeys.stateWise(state),
      queryFn: () => techParkService.getStateWiseOverview(state),
      staleTime: 5 * 60 * 1000,
    });
  };

  const prefetchCityWise = (state: string, city: string, page: number = 1, pageSize: number = 10, search: string = "", verified: VerifiedFilter = "ALL") => {
    queryClient.prefetchQuery({
      queryKey: techParkKeys.cityWise(state, city, page, pageSize, search, verified),
      queryFn: () => techParkService.getCityWiseOverview(state, city, page, pageSize, search || undefined, verified),
      staleTime: 3 * 60 * 1000,
    });
  };

  return {
    prefetchOverview,
    prefetchStateWise,
    prefetchCityWise,
  };
};
