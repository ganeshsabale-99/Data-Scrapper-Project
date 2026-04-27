import { useQueryClient } from "@tanstack/react-query";
import { techParkKeys } from "./use-tech-park-queries";
import { fundingNewsKeys } from "./use-funding-news-queries";

/**
 * Professional cache refresh utility hook
 * Provides methods to manually refresh cached data when needed
 */
export const useCacheRefresh = () => {
  const queryClient = useQueryClient();

  const refreshAllTechParkData = () => {
    queryClient.invalidateQueries({
      queryKey: techParkKeys.all,
    });
  };

  const refreshOverviewData = () => {
    queryClient.invalidateQueries({
      queryKey: techParkKeys.overview(),
    });
  };

  const refreshStateWiseData = (state: string) => {
    queryClient.invalidateQueries({
      queryKey: techParkKeys.stateWise(state),
    });
  };

  const refreshCityWiseData = (state: string, city: string) => {
    queryClient.invalidateQueries({
      queryKey: techParkKeys.cityWise(state, city, 1, 10),
    });
  };

  const refreshAllFundingNewsData = () => {
    queryClient.invalidateQueries({
      queryKey: fundingNewsKeys.all,
    });
  };

  const refreshFundingNewsList = (params?: {
    page?: number;
    limit?: number;
    source?: string;
    search?: string;
    bookmarked?: boolean;
  }) => {
    queryClient.invalidateQueries({
      queryKey: fundingNewsKeys.list(params),
    });
  };

  const refreshBookmarkedArticles = (params?: {
    page?: number;
    limit?: number;
  }) => {
    queryClient.invalidateQueries({
      queryKey: fundingNewsKeys.bookmarked(params),
    });
  };

  const forceRefreshAllData = () => {
    // Force refresh all cached data
    queryClient.invalidateQueries();
  };

  const clearAllCache = () => {
    // Clear all cached data (use with caution)
    queryClient.clear();
  };

  const getCacheStatus = () => {
    const queryCache = queryClient.getQueryCache();
    const allQueries = queryCache.getAll();

    return {
      totalQueries: allQueries.length,
      techParkQueries: allQueries.filter(q => q.queryKey[0] === 'techParks').length,
      fundingNewsQueries: allQueries.filter(q => q.queryKey[0] === 'fundingNews').length,
      staleQueries: allQueries.filter(q => q.isStale()).length,
      fetchingQueries: allQueries.filter(q => q.state.status === 'pending').length,
    };
  };

  return {
    // Tech Park refresh methods
    refreshAllTechParkData,
    refreshOverviewData,
    refreshStateWiseData,
    refreshCityWiseData,

    // Funding News refresh methods
    refreshAllFundingNewsData,
    refreshFundingNewsList,
    refreshBookmarkedArticles,

    // Global refresh methods
    forceRefreshAllData,
    clearAllCache,

    // Utility methods
    getCacheStatus,
  };
};