import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bookmark, Search, TrendingUp, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ContactPerson {
  id: string;
  name: string;
  status: 'NOT_CONTACTED' | 'CONTACTED' | 'IN_PROGRESS' | 'RESPONDED' | 'NOT_INTERESTED';
}

interface FundingNews {
  id: string;
  title: string;
  company: string;
  amount: string;
  currency: string;
  category: string;
  date: string;
  description: string;
  source: string;
  status: 'announced' | 'closed' | 'pending';
  city: string;
  contacts: ContactPerson[];
  isBookmarked: boolean;
}

const statusColors = {
  announced: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  closed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
};

const categoryColors = {
  'Series A': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'Series B': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  'Seed': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'Government Grant': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  'Venture Fund': 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300'
};

const contactStatusColors = {
  NOT_CONTACTED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  CONTACTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  RESPONDED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  NOT_INTERESTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
};

export default function BookmarkedNewsPage() {
  const [bookmarkedNews, setBookmarkedNews] = useState<FundingNews[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  useEffect(() => {
    const saved = localStorage.getItem('bookmarkedFundingNews');
    if (saved) {
      setBookmarkedNews(JSON.parse(saved));
    }
  }, []);

  const filteredNews = bookmarkedNews.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || item.status === selectedStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const categories = ['all', ...Array.from(new Set(bookmarkedNews.map(item => item.category)))];
  const statuses = ['all', ...Array.from(new Set(bookmarkedNews.map(item => item.status)))];

  const removeBookmark = (newsId: string) => {
    const updatedNews = bookmarkedNews.filter(item => item.id !== newsId);
    setBookmarkedNews(updatedNews);
    localStorage.setItem('bookmarkedFundingNews', JSON.stringify(updatedNews));
  };

  const updateContactStatus = (newsId: string, contactId: string, newStatus: ContactPerson['status']) => {
    const updatedNews = bookmarkedNews.map(item => {
      if (item.id === newsId) {
        return {
          ...item,
          contacts: item.contacts.map(contact =>
            contact.id === contactId ? { ...contact, status: newStatus } : contact
          )
        };
      }
      return item;
    });
    setBookmarkedNews(updatedNews);
    localStorage.setItem('bookmarkedFundingNews', JSON.stringify(updatedNews));
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Bookmarked News</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Your saved funding news and contact tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Export Report
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search bookmarked news..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map(status => (
                  <SelectItem key={status} value={status}>
                    {status === 'all' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredNews.map((item) => (
          <Card key={item.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-lg hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors">
                    {item.title}
                  </CardTitle>
                  <CardDescription className="mt-2 text-base">
                    {item.description}
                  </CardDescription>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      ₹{item.amount}{item.currency}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {item.category}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className={categoryColors[item.category as keyof typeof categoryColors]}>
                      {item.category}
                    </Badge>
                    <Badge variant="secondary" className={statusColors[item.status]}>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {item.company}
                    </Badge>
                    <Badge variant="outline" className="text-xs gap-1">
                      <MapPin className="w-3 h-3" />
                      {item.city}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                    <span>{new Date(item.date).toLocaleDateString()}</span>
                    <span>Source: {item.source}</span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-3">Contact Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {item.contacts.map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                            {contact.name}
                          </p>
                          <Badge
                            variant="secondary"
                            className={`text-xs ${contactStatusColors[contact.status]}`}
                          >
                            {contact.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <Select
                          value={contact.status}
                          onValueChange={(value: ContactPerson['status']) =>
                            updateContactStatus(item.id, contact.id, value)
                          }
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NOT_CONTACTED">Not Contacted</SelectItem>
                            <SelectItem value="CONTACTED">Contacted</SelectItem>
                            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                            <SelectItem value="RESPONDED">Responded</SelectItem>
                            <SelectItem value="NOT_INTERESTED">Not Interested</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeBookmark(item.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Remove Bookmark
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredNews.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bookmark className="w-12 h-12 text-slate-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No bookmarked news found</h3>
            <p className="text-slate-600 dark:text-slate-400 text-center">
              {bookmarkedNews.length === 0
                ? "You haven't bookmarked any funding news yet. Go to Funding News to save interesting deals!"
                : "Try adjusting your search criteria or filters"
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 