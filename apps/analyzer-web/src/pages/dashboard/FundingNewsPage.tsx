import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BookmarkCheck, Loader2, Bookmark } from 'lucide-react';
import { FundingNewsService } from '@/services/fundingNewsService';
import type { FundingNews } from '@/services/fundingNewsService';
import FundingNewsTable from '@/components/funding-news/FundingNewsTable';
import { Pagination } from '@/components/pagination/Pagination';

type FundingNewsQueryParams = Parameters<typeof FundingNewsService.getAllFundingNews>[0];
type ApiErrorShape = {
  response?: {
    data?: {
      error?: string;
    };
  };
  message?: string;
};

export default function FundingNewsPage() {
  const [news, setNews] = useState<FundingNews[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [headerTotalItems, setHeaderTotalItems] = useState(0);
  const [bookmarkedTotal, setBookmarkedTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [showBookmarked, setShowBookmarked] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, showBookmarked]);

  const fetchNews = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: FundingNewsQueryParams = {
        page: currentPage,
        limit: 20
      };

      if (showBookmarked) {
        params.bookmarked = true;
      }

      if (debouncedSearchTerm.trim()) {
        params.search = debouncedSearchTerm.trim();
      }

      const response = await FundingNewsService.getAllFundingNews(params);
      setNews(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
      // Also fetch global stats for accurate totals
      const stats = await FundingNewsService.getStats();
      setHeaderTotalItems(stats.data.total);
      setBookmarkedTotal(stats.data.bookmarked);
    } catch (err: unknown) {
      const parsedError = err as ApiErrorShape;
      setError(parsedError.response?.data?.error || parsedError.message || 'Failed to fetch funding news');
      console.error('Error fetching news:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, showBookmarked, debouncedSearchTerm]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);



  const handleToggleBookmark = async (newsId: string) => {
    try {
      const response = await FundingNewsService.toggleBookmark(newsId);
      const nowBookmarked = response.data.is_bookmarked;

      setNews(prevNews => {
        if (showBookmarked && !nowBookmarked) {
          return prevNews.filter(item => item.id !== newsId);
        }
        return prevNews.map(item =>
          item.id === newsId ? { ...item, is_bookmarked: nowBookmarked } : item
        );
      });

      if (showBookmarked && !nowBookmarked) {
        setTotalItems(prev => Math.max(0, prev - 1));
        setBookmarkedTotal(prev => Math.max(0, prev - 1));
        setTimeout(() => {
          setCurrentPage(prev => (news.length === 1 && prev > 1 ? prev - 1 : prev));
        }, 0);
      } else if (!showBookmarked && nowBookmarked) {
        setBookmarkedTotal(prev => prev + 1);
      } else if (!showBookmarked && !nowBookmarked) {
        setBookmarkedTotal(prev => Math.max(0, prev - 1));
      }
      const stats = await FundingNewsService.getStats();
      setHeaderTotalItems(stats.data.total);
      setBookmarkedTotal(stats.data.bookmarked);
    } catch (err: unknown) {
      console.error('Error toggling bookmark:', err);
      setError('Failed to update bookmark');
    }
  };



  if (loading && news.length === 0) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-slate-600 dark:text-slate-400">Loading funding news...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Funding News
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Stay updated with the latest funding news and investment activities
          </p>
        </div>
        <div className="flex items-center gap-2 p-1 bg-white rounded-md border">
          <button
            onClick={() => setShowBookmarked(false)}
            className={`px-4 py-2 text-sm transition-colors font-medium rounded-md border gap-2 flex items-center ${
              !showBookmarked 
                ? "text-indigo-700 bg-indigo-50 border-indigo-300 shadow-sm" 
                : "text-muted-foreground hover:text-foreground hover:bg-indigo-50 border-transparent"
            }`}
          >
            <Bookmark className="w-4 h-4" />
            All Articles
          </button>
          <button
            onClick={() => setShowBookmarked(true)}
            className={`px-4 py-2 text-sm transition-colors font-medium rounded-md border gap-2 flex items-center ${
              showBookmarked 
                ? "text-indigo-700 bg-indigo-50 border-indigo-300 shadow-sm" 
                : "text-muted-foreground hover:text-foreground hover:bg-indigo-50 border-transparent"
            }`}
          >
            <BookmarkCheck className="w-4 h-4" />
            Bookmarked
          </button>
        </div>
      </div>



      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
          <CardContent className="pt-6">
            <p className="text-red-600 dark:text-red-400 text-center">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 text-sm text-slate-600 dark:text-slate-400">
        <span>Total Articles: <span className="font-semibold text-slate-900 dark:text-slate-100">{headerTotalItems}</span></span>
        <span>Bookmarked: <span className="font-semibold text-slate-900 dark:text-slate-100">{bookmarkedTotal}</span></span>
      </div>

      {/* News Display */}
      <FundingNewsTable
        news={news}
        onToggleBookmark={handleToggleBookmark}
        onUpdate={fetchNews}
        loading={loading}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={20}
        onPageChange={(page) => setCurrentPage(page)}
      />


    </div>
  );
} 
