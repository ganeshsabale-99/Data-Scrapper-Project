import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { coworkingSpaceService } from "@/services/coworkingSpaceService";
import { toast } from "sonner";

// Query Keys
export const coworkingSpaceKeys = {
  all: ['coworkingSpaces'] as const,
  overview: () => [...coworkingSpaceKeys.all, 'overview'] as const,
  stateWise: (state: string) => [...coworkingSpaceKeys.all, 'stateWise', state] as const,
  cityWise: (state: string, city: string, page: number, pageSize: number, verified?: string) =>
    [...coworkingSpaceKeys.all, 'cityWise', state, city, page, pageSize, verified] as const,
  companies: (coworkingSpaceId: string, page: number, limit: number) =>
    [...coworkingSpaceKeys.all, 'companies', coworkingSpaceId, page, limit] as const,
  details: (id: string) => [...coworkingSpaceKeys.all, 'details', id] as const,
};

const readApiErrorMessage = (error: unknown, fallback: string): string => {
  const errorObj = error as {
    response?: { status?: number; data?: { message?: string; error?: string } };
    message?: string;
  };
  let errorMessage = errorObj?.response?.data?.message || errorObj?.response?.data?.error;
  if (!errorMessage && errorObj?.response?.status === 413) {
    errorMessage = "Payload Too Large: File or data exceeds maximum allowed size";
  }
  return errorMessage || errorObj?.message || fallback;
};

// Hooks for fetching data
export const useCoworkingSpaceOverviewData = () =>
  useQuery({
    queryKey: coworkingSpaceKeys.overview(),
    queryFn: () => coworkingSpaceService.getOverviewData(),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
  });

export const useCoworkingSpaceStateWiseData = (state: string) => {
  return useQuery({
    queryKey: coworkingSpaceKeys.stateWise(state),
    queryFn: () => coworkingSpaceService.getStateWiseOverview(state),
    enabled: !!state,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
  });
};

export const useCoworkingSpaceCityWiseData = (
  state: string,
  city: string,
  page: number = 1,
  pageSize: number = 10,
  search?: string,
  verified: 'ALL' | 'VERIFIED' | 'UNVERIFIED' = 'ALL'
) => {
  return useQuery({
    queryKey: [...coworkingSpaceKeys.cityWise(state, city, page, pageSize, verified), search],
    queryFn: () => coworkingSpaceService.getCityWiseOverview(state, city, page, pageSize, search, verified),
    enabled: !!state && !!city,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export const useCoworkingSpaceCompanies = (
  coworkingSpaceId: string,
  page: number = 1,
  limit: number = 10,
  search?: string
) => {
  return useQuery({
    queryKey: [...coworkingSpaceKeys.companies(coworkingSpaceId, page, limit), search],
    queryFn: () => coworkingSpaceService.getCompaniesByCoworkingSpace(coworkingSpaceId, page, limit, search),
    enabled: !!coworkingSpaceId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export const useCoworkingSpaceDetails = (id: string) => {
  return useQuery({
    queryKey: coworkingSpaceKeys.details(id),
    queryFn: () => coworkingSpaceService.getCoworkingSpaceById(id),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
};

// Mutation hooks for data modifications
export const useAddCoworkingSpace = () => {
  const queryClient = useQueryClient();
  type AddCoworkingPayload = Parameters<typeof coworkingSpaceService.addCoworkingSpaceToCity>[0]["payload"];

  return useMutation({
    mutationFn: (params: {
      state: string;
      city: string;
      payload: AddCoworkingPayload;
    }) => coworkingSpaceService.addCoworkingSpaceToCity(params),
    onSuccess: () => {
      // Refresh all coworking views to avoid stale state between sections.
      queryClient.invalidateQueries({ queryKey: coworkingSpaceKeys.all });

      toast.success("Coworking space added successfully!");
    },
    onError: (error: unknown) => {
      toast.error(readApiErrorMessage(error, "Failed to add coworking space"));
    },
  });
};

export const useUpdateCoworkingSpace = () => {
  const queryClient = useQueryClient();
  type UpdateCoworkingPayload = Parameters<typeof coworkingSpaceService.updateCoworkingSpace>[1];

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCoworkingPayload }) =>
      coworkingSpaceService.updateCoworkingSpace(id, payload),
    onSuccess: () => {
      // Invalidate all coworking space queries to refresh data
      queryClient.invalidateQueries({ queryKey: coworkingSpaceKeys.all });
      toast.success("Coworking space updated successfully!");
    },
    onError: (error: unknown) => {
      toast.error(readApiErrorMessage(error, "Failed to update coworking space"));
    },
  });
};

export const useDeleteCoworkingSpace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => coworkingSpaceService.deleteCoworkingSpace(id),
    onSuccess: () => {
      // Invalidate all coworking space queries to refresh data
      queryClient.invalidateQueries({ queryKey: coworkingSpaceKeys.all });
      toast.success("Coworking space deleted successfully!");
    },
    onError: (error: unknown) => {
      toast.error(readApiErrorMessage(error, "Failed to delete coworking space"));
    },
  });
};

export const useChangeStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      coworkingSpaceService.changeStatus(id, status),
    onSuccess: () => {
      // Invalidate all coworking space queries to refresh data
      queryClient.invalidateQueries({ queryKey: coworkingSpaceKeys.all });
      toast.success("Status updated successfully!");
    },
    onError: (error: unknown) => {
      toast.error(readApiErrorMessage(error, "Failed to update status"));
    },
  });
};

export const useVerifyCoworkingSpace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => coworkingSpaceService.verifyCoworkingSpace(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coworkingSpaceKeys.all });
      toast.success("Coworking space verified successfully!");
    },
    onError: (error: unknown) => {
      toast.error(readApiErrorMessage(error, "Failed to verify coworking space"));
    },
  });
};

export const useUnverifyCoworkingSpace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => coworkingSpaceService.unverifyCoworkingSpace(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coworkingSpaceKeys.all });
      toast.success("Coworking space unverified successfully!");
    },
    onError: (error: unknown) => {
      toast.error(readApiErrorMessage(error, "Failed to unverify coworking space"));
    },
  });
};

// Company mutations
export const useAddCompanyToCoworkingSpace = () => {
  const queryClient = useQueryClient();
  type AddCompanyPayload = Parameters<typeof coworkingSpaceService.addCompanyToCoworkingSpace>[1];

  return useMutation({
    mutationFn: ({ coworkingSpaceId, payload }: { coworkingSpaceId: string; payload: AddCompanyPayload }) =>
      coworkingSpaceService.addCompanyToCoworkingSpace(coworkingSpaceId, payload),
    onSuccess: (_data, variables) => {
      // Invalidate company queries for this coworking space
      queryClient.invalidateQueries({
        queryKey: coworkingSpaceKeys.companies(variables.coworkingSpaceId, 1, 10)
      });
      toast.success("Company added successfully!");
    },
    onError: (error: unknown) => {
      toast.error(readApiErrorMessage(error, "Failed to add company"));
    },
  });
};

export const useUpdateCompany = () => {
  const queryClient = useQueryClient();
  type UpdateCompanyPayload = Parameters<typeof coworkingSpaceService.updateCompany>[1];

  return useMutation({
    mutationFn: ({ companyId, payload }: { companyId: string; payload: UpdateCompanyPayload }) =>
      coworkingSpaceService.updateCompany(companyId, payload),
    onSuccess: () => {
      // Invalidate all company queries
      queryClient.invalidateQueries({ queryKey: [...coworkingSpaceKeys.all, 'companies'] });
      toast.success("Company updated successfully!");
    },
    onError: (error: unknown) => {
      toast.error(readApiErrorMessage(error, "Failed to update company"));
    },
  });
};

export const useDeleteCompany = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (companyId: string) => coworkingSpaceService.deleteCompany(companyId),
    onSuccess: () => {
      // Invalidate all company queries
      queryClient.invalidateQueries({ queryKey: [...coworkingSpaceKeys.all, 'companies'] });
      toast.success("Company deleted successfully!");
    },
    onError: (error: unknown) => {
      toast.error(readApiErrorMessage(error, "Failed to delete company"));
    },
  });
};

export const useChangeCompanyStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, status }: { companyId: string; status: string }) =>
      coworkingSpaceService.changeCompanyStatus(companyId, status),
    onSuccess: () => {
      // Invalidate all company queries
      queryClient.invalidateQueries({ queryKey: [...coworkingSpaceKeys.all, 'companies'] });
      toast.success("Company status updated successfully!");
    },
    onError: (error: unknown) => {
      toast.error(readApiErrorMessage(error, "Failed to update company status"));
    },
  });
};
