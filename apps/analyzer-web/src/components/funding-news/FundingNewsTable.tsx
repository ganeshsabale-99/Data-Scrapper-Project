import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit,
  User,
  Phone,
  Mail,
  Eye
} from 'lucide-react';
import ContactEditDialog from './ContactEditDialog';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { FundingNews } from '@/services/fundingNewsService';

interface FundingNewsTableProps {
  news: FundingNews[];
  onToggleBookmark: (id: string) => void;
  onUpdate?: () => void;
  loading?: boolean;
}

type SortField = 'title' | 'source' | 'date_published' | 'created_at' | 'contact_status';
type SortDirection = 'asc' | 'desc';

const sourceColors = {
  ENTRACKR: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  YOURSTORY: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

const statusColors = {
  NOT_CONTACTED: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  CONTACTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  INTERESTED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  MEETING_SCHEDULED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  PROPOSAL_SENT: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  CLOSED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

const statusLabels = {
  NOT_CONTACTED: 'Not Contacted',
  CONTACTED: 'Contacted',
  INTERESTED: 'Interested',
  MEETING_SCHEDULED: 'Meeting Scheduled',
  PROPOSAL_SENT: 'Proposal Sent',
  CLOSED: 'Closed',
};

// Helper function to format date properly
const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A';

  try {
    // Clean the date string by removing extra whitespace and newlines
    const cleanDate = dateString.trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');

    // Try multiple date parsing approaches
    let date: Date;

    // First try: Direct parsing
    date = new Date(cleanDate);

    // If that fails, try parsing with different formats
    if (isNaN(date.getTime())) {
      // Try parsing "Sep 02, 2025" format specifically
      const match = cleanDate.match(/(\w{3})\s+(\d{1,2}),?\s+(\d{4})/);
      if (match) {
        const [, monthStr, dayStr, yearStr] = match;
        const monthMap: { [key: string]: number } = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Sept': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };

        const month = monthMap[monthStr];
        if (month !== undefined) {
          date = new Date(parseInt(yearStr), month, parseInt(dayStr));
        }
      }
    }

    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    // Format as "01-Sept-2025"
    const day = date.getDate().toString().padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
  } catch {
    return 'Invalid Date';
  }
};

export default function FundingNewsTable({ news, onToggleBookmark, onUpdate, loading }: FundingNewsTableProps) {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<SortField>('date_published');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [editingItem, setEditingItem] = useState<FundingNews | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Filter news based on search term
  const filteredNews = useMemo(() => {
    if (!searchTerm.trim()) return news;

    const term = searchTerm.toLowerCase();
    return news.filter((item) =>
      item.title.toLowerCase().includes(term) ||
      item.author?.toLowerCase().includes(term) ||
      item.industry?.toLowerCase().includes(term) ||
      item.contact_person?.toLowerCase().includes(term) ||
      item.contact_email?.toLowerCase().includes(term) ||
      item.contact_phone?.toLowerCase().includes(term)
    );
  }, [news, searchTerm]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedNews = [...filteredNews].sort((a, b) => {
    let aValue = a[sortField] ?? '';
    let bValue = b[sortField] ?? '';

    // Handle date sorting
    if (sortField === 'created_at' || sortField === 'date_published') {
      const aDate = new Date(aValue);
      const bDate = new Date(bValue);

      // Handle null/undefined values for dates
      if (isNaN(aDate.getTime()) && isNaN(bDate.getTime())) return 0;
      if (isNaN(aDate.getTime())) return 1;
      if (isNaN(bDate.getTime())) return -1;

      if (sortDirection === 'asc') {
        return aDate.getTime() - bDate.getTime();
      } else {
        return bDate.getTime() - aDate.getTime();
      }
    }

    // Handle string sorting
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    // Handle null/undefined values
    if (!aValue && !bValue) return 0;
    if (!aValue) return 1;
    if (!bValue) return -1;

    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-slate-400" />;
    }
    return sortDirection === 'asc' ?
      <ArrowUp className="w-4 h-4 text-blue-600" /> :
      <ArrowDown className="w-4 h-4 text-blue-600" />;
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

  if (news.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
            No funding news found
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Try adjusting your search criteria or filters
          </p>
        </CardContent>
      </Card>
    );
  }

  if (filteredNews.length === 0 && searchTerm) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
            No funding news found
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            No results found for "{searchTerm}". Try a different search term.
          </p>
          <Button
            variant="outline"
            onClick={() => setSearchTerm("")}
          >
            Clear search
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Search Input */}
        <div className="flex justify-between items-center gap-4">
          <SearchInput
            placeholder="Search funding news..."
            value={searchTerm}
            onChange={setSearchTerm}
            className="max-w-md"
          />
          {searchTerm && (
            <div className="text-sm text-muted-foreground">
              {filteredNews.length} of {news.length} results
            </div>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right p-4 font-medium w-12">#</th>
                      <th
                        className="text-left p-4 font-medium cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('title')}
                      >
                        <div className="flex items-center gap-2">
                          Title
                          {getSortIcon('title')}
                        </div>
                      </th>

                      <th
                        className="text-left p-4 font-medium cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('source')}
                      >
                        <div className="flex items-center gap-2">
                          Source
                          {getSortIcon('source')}
                        </div>
                      </th>
                      <th
                        className="text-left p-4 font-medium cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('date_published')}
                      >
                        <div className="flex items-center gap-2">
                          Published Date
                          {getSortIcon('date_published')}
                        </div>
                      </th>
                      <th
                        className="text-left p-4 font-medium cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('contact_status')}
                      >
                        <div className="flex items-center gap-2">
                          Status
                          {getSortIcon('contact_status')}
                        </div>
                      </th>
                      <th className="text-left p-4 font-medium">Contact</th>
                      <th className="text-left p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedNews.map((item, index) => (
                      <motion.tr
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b hover:bg-muted/50 cursor-pointer group"
                        onClick={() => window.open(item.article_url, '_blank')}
                      >
                        <td className="p-4 text-right text-muted-foreground">{item.serialNumber || index + 1}</td>
                        {/* Title & Author */}
                        <td className="p-4">
                          <div>
                            <div className="font-medium">{item.title}</div>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                              {item.author && <span>By {item.author}</span>}
                              {item.date_published && (
                                <>
                                  {item.author && <span>•</span>}
                                  <span>{formatDate(item.date_published)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </td>



                        {/* Source */}
                        <td className="p-4">
                          <Badge variant="secondary" className={sourceColors[item.source]}>
                            {item.source}
                          </Badge>
                        </td>

                        {/* Published Date */}
                        <td className="p-4">
                          <div className="text-sm text-slate-900 dark:text-slate-100">
                            {item.date_published ? formatDate(item.date_published) :
                              <span className="text-muted-foreground italic">N/A</span>}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="p-4">
                          <Badge
                            variant="secondary"
                            className={statusColors[item.contact_status || 'NOT_CONTACTED']}
                          >
                            {statusLabels[item.contact_status || 'NOT_CONTACTED']}
                          </Badge>
                        </td>

                        {/* Contact */}
                        <td className="p-4">
                          <div className="space-y-1">
                            {item.contact_person ? (
                              <div className="flex items-center gap-1 text-sm">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span className="truncate max-w-[120px]" title={item.contact_person}>
                                  {item.contact_person}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">No contact</span>
                            )}
                            {item.contact_email && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                <span className="truncate max-w-[120px]" title={item.contact_email}>
                                  {item.contact_email}
                                </span>
                              </div>
                            )}
                            {item.contact_phone && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span className="truncate max-w-[120px]" title={item.contact_phone}>
                                  {item.contact_phone}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="p-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-purple-600 hover:bg-purple-50"
                                  onClick={() => navigate(`/dashboard/funding-news/${item.id}/details`)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <span>View company details</span>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
                                  onClick={() => window.open(item.article_url, '_blank')}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <span>Read full article</span>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-green-600 hover:bg-green-50"
                                  onClick={() => setEditingItem(item)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <span>Edit contact details</span>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={`h-7 w-7 p-0 ${item.is_bookmarked ? 'text-blue-600 hover:bg-blue-50' : 'text-muted-foreground hover:text-blue-600 hover:bg-blue-50'}`}
                                  onClick={() => onToggleBookmark(item.id)}
                                >
                                  {item.is_bookmarked ? (
                                    <BookmarkCheck className="h-4 w-4" />
                                  ) : (
                                    <Bookmark className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <span>{item.is_bookmarked ? 'Remove bookmark' : 'Add bookmark'}</span>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-4">
          {sortedNews.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => window.open(item.article_url, '_blank')}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.title}</h3>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        {item.author && <span>By {item.author}</span>}
                        {item.date_published && (
                          <>
                            {item.author && <span>•</span>}
                            <span>{formatDate(item.date_published)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-purple-600 hover:bg-purple-50"
                            onClick={() => navigate(`/dashboard/funding-news/${item.id}/details`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <span>View company details</span>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => window.open(item.article_url, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <span>Read full article</span>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-green-600 hover:bg-green-50"
                            onClick={() => setEditingItem(item)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <span>Edit contact details</span>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-7 w-7 p-0 ${item.is_bookmarked ? 'text-blue-600 hover:bg-blue-50' : 'text-muted-foreground hover:text-blue-600 hover:bg-blue-50'}`}
                            onClick={() => onToggleBookmark(item.id)}
                          >
                            {item.is_bookmarked ? (
                              <BookmarkCheck className="h-4 w-4" />
                            ) : (
                              <Bookmark className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <span>{item.is_bookmarked ? 'Remove bookmark' : 'Add bookmark'}</span>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="space-y-2">

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Source:</span>
                      <Badge variant="secondary" className={sourceColors[item.source]}>
                        {item.source}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <Badge
                        variant="secondary"
                        className={statusColors[item.contact_status || 'NOT_CONTACTED']}
                      >
                        {statusLabels[item.contact_status || 'NOT_CONTACTED']}
                      </Badge>
                    </div>
                    {(item.contact_person || item.contact_email || item.contact_phone) && (
                      <div className="space-y-1 pt-2 border-t">
                        <div className="text-sm font-medium text-muted-foreground">Contact Details:</div>
                        {item.contact_person && (
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span>{item.contact_person}</span>
                          </div>
                        )}
                        {item.contact_email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate">{item.contact_email}</span>
                          </div>
                        )}
                        {item.contact_phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span>{item.contact_phone}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Contact Edit Dialog */}
      {editingItem && (
        <ContactEditDialog
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          newsItem={editingItem}
          onUpdate={() => {
            onUpdate?.();
            setEditingItem(null);
          }}
        />
      )}

    </TooltipProvider>
  );
}
