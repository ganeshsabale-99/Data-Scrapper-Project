import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Calendar,
  Eye
} from 'lucide-react';
import type { FundingNews } from '@/services/fundingNewsService';

interface FundingNewsCardsProps {
  news: FundingNews[];
  onToggleBookmark: (id: string) => void;
  loading?: boolean;
}

const sourceColors: Record<string, string> = {
  ENTRACKR: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  YOURSTORY: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

const getSourceColor = (source: string) => {
  return sourceColors[source] || 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300';
};

export default function FundingNewsCards({ news, onToggleBookmark, loading }: FundingNewsCardsProps) {
  const navigate = useNavigate();
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };



  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600 dark:text-slate-400">Loading funding news...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {news.map((item) => (
        <Card key={item.id} className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1">
                <CardTitle className="text-lg hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors">
                  {item.title}
                </CardTitle>
                {item.content_summary && (
                  <CardDescription className="mt-2 text-base">
                    {item.content_summary}
                  </CardDescription>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Article Info */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className={getSourceColor(item.source)}>
                    {item.source}
                  </Badge>
                  {item.industry && (
                    <Badge variant="outline" className="text-xs">
                      {item.industry}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(item.date_published)}
                  </span>
                  {item.author && (
                    <span>By {item.author}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(item.article_url, '_blank')}
                  className="gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Read Article
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/dashboard/funding-news/${item.id}/details`)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-purple-600 hover:bg-purple-50"
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  variant={item.is_bookmarked ? "default" : "outline"}
                  size="sm"
                  onClick={() => onToggleBookmark(item.id)}
                  className={`gap-2 ${item.is_bookmarked ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                >
                  {item.is_bookmarked ? (
                    <>
                      <BookmarkCheck className="w-4 h-4" />
                      Bookmarked
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-4 h-4" />
                      Bookmark
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {news.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Eye className="w-12 h-12 text-slate-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              No funding news found
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-center">
              Try adjusting your search criteria or filters
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}