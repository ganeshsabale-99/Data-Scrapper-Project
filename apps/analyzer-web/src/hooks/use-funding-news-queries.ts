import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FundingNewsService } from "@/services/fundingNewsService";
import { toast } from "sonner";

type ApiErrorShape = {
  response?: {
    status?: number;
    data?: {
      message?: string;
      error?: string;
    };
  };
  message?: string;
};

// Query Keys
export const fundingNewsKeys = {
  all: ['fundingNews'] as const,
  list: (params?: { page?: number; limit?: number; source?: string; search?: string; bookmarked?: boolean }) =>
    [...fundingNewsKeys.all, 'list', params] as const,
  detail: (id: string) => [...fundingNewsKeys.all, 'detail', id] as const,
  bookmarked: (params?: { page?: number; limit?: number }) =>
    [...fundingNewsKeys.all, 'bookmarked', params] as const,
};

// Hooks for fetching data
export const useFundingNews = (params?: {
  page?: number;
  limit?: number;
  source?: string;
  search?: string;
  bookmarked?: boolean;
}) => {
  return useQuery({
    queryKey: fundingNewsKeys.list(params),
    queryFn: () => FundingNewsService.getAllFundingNews(params),
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useFundingNewsById = (id: string) => {
  return useQuery({
    queryKey: fundingNewsKeys.detail(id),
    queryFn: () => FundingNewsService.getFundingNewsById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useBookmarkedArticles = (params?: { page?: number; limit?: number }) => {
  return useQuery({
    queryKey: fundingNewsKeys.bookmarked(params),
    queryFn: () => FundingNewsService.getBookmarkedArticles(params),
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Mutation hooks for data modifications
export const useToggleBookmark = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: FundingNewsService.toggleBookmark,
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: fundingNewsKeys.all });

      // Snapshot previous values
      const previousQueries = new Map<readonly unknown[], unknown>();
      const queryCache = queryClient.getQueryCache();
      queryCache.getAll().forEach(query => {
        if (query.queryKey[0] === 'fundingNews') {
          previousQueries.set(query.queryKey, query.state.data);
        }
      });

      return { previousQueries };
    },
    onError: (error: unknown, _, context) => {
      // Rollback on error
      if (context?.previousQueries) {
        context.previousQueries.forEach((data, queryKey) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      const parsedError = error as ApiErrorShape;
      let apiError = parsedError.response?.data?.message || parsedError.response?.data?.error;
      if (!apiError && parsedError.response?.status === 413) {
        apiError = 'Payload Too Large: File or data exceeds maximum allowed size';
      }
      apiError = apiError || parsedError.message || 'Failed to update bookmark';
      console.error("Failed to update bookmark", error);
      toast.error(apiError);
    },
    onSuccess: (data) => {
      // Invalidate all funding news queries to refresh data
      queryClient.invalidateQueries({
        queryKey: fundingNewsKeys.all,
      });

      toast.success(data.message || "Bookmark status updated!");
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: fundingNewsKeys.all,
      });
    },
  });
};

// Utility hook to prefetch data
export const usePrefetchFundingNews = () => {
  const queryClient = useQueryClient();

  const prefetchFundingNews = (params?: {
    page?: number;
    limit?: number;
    source?: string;
    search?: string;
    bookmarked?: boolean;
  }) => {
    queryClient.prefetchQuery({
      queryKey: fundingNewsKeys.list(params),
      queryFn: () => FundingNewsService.getAllFundingNews(params),
      staleTime: 3 * 60 * 1000,
    });
  };

  const prefetchBookmarked = (params?: { page?: number; limit?: number }) => {
    queryClient.prefetchQuery({
      queryKey: fundingNewsKeys.bookmarked(params),
      queryFn: () => FundingNewsService.getBookmarkedArticles(params),
      staleTime: 3 * 60 * 1000,
    });
  };

  return {
    prefetchFundingNews,
    prefetchBookmarked,
  };
};
