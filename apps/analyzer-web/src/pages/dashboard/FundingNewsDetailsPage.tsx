import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { 
    ChevronLeft, 
    Globe, 
    ExternalLink, 
    Loader2, 
    AlertCircle, 
    RefreshCw, 
    Linkedin, 
    Twitter, 
    Facebook, 
    Instagram, 
    Link2, 
    Eye,
    Building2,
    FileText,
    Sparkles,
    MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FundingNewsService, type CompanyDetails, type FundingNews } from '@/services/fundingNewsService';
import { toast } from 'sonner';

export default function FundingNewsDetailsPage() {
    const { newsId } = useParams<{ newsId: string }>();
    const navigate = useNavigate();
    
    const [news, setNews] = useState<FundingNews | null>(null);
    const [details, setDetails] = useState<CompanyDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summary, setSummary] = useState<string | null>(null);
    const [presence, setPresence] = useState<{
        location: string | null;
        type: string | null;
        branches: string | null;
    }>({ location: null, type: null, branches: null });
    const [presenceLoading, setPresenceLoading] = useState(false);

    const extractLocation = (text: string | undefined): string | null => {
        if (!text) return null;
        
        const keywords = [
            'based in', 
            'based out of', 
            'headquartered in', 
            'located in', 
            'operates from', 
            'founded in', 
            'startup in'
        ];

        // List of common non-location words that might be capitalized
        const blacklist = [
            'Fintech', 'SaaS', 'Edtech', 'Healthtech', 'Insurtech', 'Logitech',
            'Technology', 'Software', 'Services', 'Solutions', 'Platforms',
            'AI', 'Artificial Intelligence', 'Machine Learning', 'Blockchain',
            'B2B', 'B2C', 'Direct', 'Series', 'Funding', 'Seed'
        ];

        // Regex to capture capitalized place names (e.g., "San Francisco", "India", "New York, USA")
        // It looks for one or more capitalized words, potentially separated by commas or spaces.
        const locationPattern = /^\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:,\s+[A-Z][a-z]+)*)/;
        const lowerText = text.toLowerCase();

        for (const kw of keywords) {
            // Find the keyword case-insensitively (e.g. "Headquartered in" at a sentence
            // start), but keep the location capture itself case-sensitive so it only
            // matches actual capitalized place names, not arbitrary lowercase words.
            let searchFrom = 0;
            let idx = lowerText.indexOf(kw, searchFrom);
            while (idx !== -1) {
                const match = text.slice(idx + kw.length).match(locationPattern);
                if (match && match[1]) {
                    const loc = match[1].trim();

                    // Validation:
                    // 1. More than 2 chars
                    // 2. Not in blacklist
                    // 3. Not a generic stop word
                    const isBlacklisted = blacklist.some(b => loc.toLowerCase().includes(b.toLowerCase()));
                    const isStopWord = ['a', 'the', 'some', 'many'].includes(loc.toLowerCase());

                    if (loc.length > 2 && !isBlacklisted && !isStopWord) {
                        return loc;
                    }
                }
                searchFrom = idx + kw.length;
                idx = lowerText.indexOf(kw, searchFrom);
            }
        }
        return null;
    };

    const fetchData = useCallback(async () => {
        if (!newsId) return;
        
        setLoading(true);
        setError(null);
        try {
            const [newsResponse, detailsResponse] = await Promise.all([
                FundingNewsService.getFundingNewsById(newsId),
                FundingNewsService.getCompanyDetails(newsId)
            ]);
            
            const newsData = newsResponse.data;
            const detailsData = detailsResponse.data;
            
            setNews(newsData);
            setDetails(detailsData);

            // Presence Extraction
            setPresenceLoading(true);
            const contentToSearch = [
                newsData.content_summary,
                detailsData.description
            ].filter(Boolean).join(' ');

            // Prefer the AI-extracted location already stored on the article; only
            // fall back to regex-guessing from the article text if that's empty.
            const loc = newsData.location || extractLocation(contentToSearch);
            
            // Detect Presence Type
            let type = null;
            if (contentToSearch.toLowerCase().includes('coworking')) type = 'Coworking Space';
            else if (contentToSearch.toLowerCase().includes('tech park')) type = 'Tech Park';
            else if (contentToSearch.toLowerCase().includes('workspace')) type = 'Shared Workspace';
            
            setPresence({ 
                location: loc, 
                type: type,
                branches: null
            });
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to fetch details');
        } finally {
            setLoading(false);
            setPresenceLoading(false);
        }
    }, [newsId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSummarize = () => {
        setIsSummarizing(true);
        // Simulate summarization
        setTimeout(() => {
            setIsSummarizing(false);
            setSummary(
                news?.content_summary || 
                "This article discusses the recent funding round for " + (details?.companyName || "the company") + ". The investment will be used to scale operations, expand the team, and accelerate product development in the " + (news?.industry || "tech") + " sector."
            );
            toast.success('Summary generated successfully!');
        }, 1500);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Loading company details...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 max-w-md mx-auto text-center">
                <div className="h-16 w-16 rounded-full bg-red-50 flex items-center justify-center">
                    <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-xl font-semibold">Something went wrong</h2>
                    <p className="text-muted-foreground">{error}</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={() => navigate(-1)}>
                        Go Back
                    </Button>
                    <Button onClick={fetchData} className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Try Again
                    </Button>
                </div>
            </div>
        );
    }

    const hasSocialLinks = details?.socialLinks && 
        Object.values(details.socialLinks).some(Boolean);

    return (
        <div className="max-w-[1400px] mx-auto space-y-8 pb-20 px-4 md:px-8">
            {/* Header / Navigation */}
            <div className="flex items-center justify-between pt-2">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => navigate(-1)} 
                    className="gap-2 -ml-2 text-muted-foreground hover:text-foreground"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Back to Funding News
                </Button>
                {news?.article_url && (
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => window.open(news.article_url, '_blank')}
                        className="gap-2 py-2.5 h-auto"
                    >
                        <ExternalLink className="h-4 w-4" />
                        Original Article
                    </Button>
                )}
            </div>

            {/* Title Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/10">
                        <Eye className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            {details?.companyName || news?.company_name || 'Company Details'}
                        </h1>
                        <p className="text-muted-foreground mt-1 text-lg">
                            {news?.title}
                        </p>
                    </div>
                </div>
                
                <div className="flex flex-wrap gap-2 pt-2">
                    {news?.source && (
                        <Badge variant="secondary" className="px-3 py-1">
                            {news.source}
                        </Badge>
                    )}
                    {news?.industry && (
                        <Badge variant="outline" className="px-3 py-1">
                            {news.industry}
                        </Badge>
                    )}
                    {news?.date_published && (
                        <span className="text-sm text-muted-foreground flex items-center gap-1.5 ml-1">
                            Published on {new Date(news.date_published).toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric'
                            })}
                        </span>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 pt-4">
                {/* Main Content */}
                <div className="lg:col-span-3 space-y-8">
                    {/* About Section */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            <FileText className="h-4 w-4" />
                            About Company
                        </div>
                        <div className="text-base leading-relaxed text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                            {details?.description || news?.content_summary || 'No detailed description available for this company yet.'}
                        </div>
                    </section>

                    {/* Summary Section (Dynamic) */}
                    {(summary || isSummarizing) && (
                        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
                                <Sparkles className="h-4 w-4" />
                                AI Content Summary
                            </div>
                            <div className="text-base leading-relaxed p-6 rounded-2xl border border-primary/20 bg-primary/5 relative overflow-hidden">
                                {isSummarizing ? (
                                    <div className="flex items-center gap-3 py-4">
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        <span className="text-primary/70 font-medium italic">Analyzing article content and generating summary</span>
                                    </div>
                                ) : (
                                    <p className="text-slate-800 dark:text-slate-200">
                                        {summary}
                                    </p>
                                )}
                            </div>
                        </section>
                    )}

                    {/* Related Links */}
                    {details?.otherLinks && details.otherLinks.length > 0 && (
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                <Link2 className="h-4 w-4" />
                                Related Intelligence
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                {details.otherLinks.map((link, i) => (
                                    <a
                                        key={i}
                                        href={link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-muted/50 transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center group-hover:bg-background transition-colors">
                                                <Link2 className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <span className="text-sm font-medium truncate max-w-[200px] sm:max-w-md">
                                                {link.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                                            </span>
                                        </div>
                                        <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </a>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-8">
                    {/* Website Card */}
                    {details?.website && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <Globe className="h-4 w-4" />
                                Website
                            </h3>
                            <a
                                href={details.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-4 rounded-2xl border border-border bg-background hover:shadow-md transition-all group"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-primary font-semibold truncate mr-2">
                                        {details.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                                    </span>
                                    <ExternalLink className="h-4 w-4 text-primary shrink-0" />
                                </div>
                            </a>
                        </div>
                    )}

                    {/* Social Links Card */}
                    {hasSocialLinks && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <Link2 className="h-4 w-4" />
                                Social Presence
                            </h3>
                            <div className="space-y-2">
                                {details?.socialLinks.linkedin && (
                                    <SocialLinkItem
                                        href={details.socialLinks.linkedin}
                                        icon={<Linkedin className="h-5 w-5" />}
                                        label="LinkedIn"
                                        color="text-[#0A66C2]"
                                    />
                                )}
                                {details?.socialLinks.twitter && (
                                    <SocialLinkItem
                                        href={details.socialLinks.twitter}
                                        icon={<Twitter className="h-5 w-5" />}
                                        label="Twitter / X"
                                        color="text-[#1DA1F2]"
                                    />
                                )}
                                {details?.socialLinks.facebook && (
                                    <SocialLinkItem
                                        href={details.socialLinks.facebook}
                                        icon={<Facebook className="h-5 w-5" />}
                                        label="Facebook"
                                        color="text-[#1877F2]"
                                    />
                                )}
                                {details?.socialLinks.instagram && (
                                    <SocialLinkItem
                                        href={details.socialLinks.instagram}
                                        icon={<Instagram className="h-5 w-5" />}
                                        label="Instagram"
                                        color="text-[#E4405F]"
                                    />
                                )}
                                {details?.socialLinks.crunchbase && (
                                    <SocialLinkItem
                                        href={details.socialLinks.crunchbase}
                                        icon={<Building2 className="h-5 w-5" />}
                                        label="Crunchbase"
                                        color="text-[#0288D1]"
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Company Presence Card */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Company Presence
                        </h3>
                        <div className="p-5 rounded-2xl border border-border bg-background shadow-sm space-y-4">
                            {presenceLoading ? (
                                <div className="flex items-center gap-3 py-2">
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                    <span className="text-sm text-muted-foreground italic">Checking location...</span>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Headquarters</span>
                                            <p className={`text-sm font-semibold ${presence.location ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                                                {presence.location || 'Not mentioned in source'}
                                            </p>
                                        </div>
                                        
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Presence Type</span>
                                            <p className={`text-sm font-medium ${presence.type ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                                                {presence.type || 'Standalone / Not specified'}
                                            </p>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Branches</span>
                                            <p className="text-sm font-medium text-muted-foreground italic">
                                                Not available
                                            </p>
                                        </div>
                                    </div>

                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="w-full gap-2 text-xs font-medium h-9 border-slate-200 hover:bg-slate-50 transition-colors mt-2"
                                        onClick={() => {
                                            const query = presence.location || details?.companyName || news?.company_name || 'Company';
                                            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank');
                                        }}
                                    >
                                        <Globe className="h-3.5 w-3.5" />
                                        View on Map
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t z-10 flex justify-center">
                <div className="max-w-[1400px] w-full flex justify-between items-center px-4 md:px-8">
                    <p className="text-sm text-muted-foreground hidden sm:block">
                        Want a quick overview? Generate an AI summary.
                    </p>
                    <Button 
                        size="lg" 
                        onClick={handleSummarize} 
                        disabled={isSummarizing || !!summary}
                        className="gap-2 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                    >
                        {isSummarizing ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Summarizing...
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-4 w-4" />
                                {summary ? 'Summarized' : 'Summarize Content'}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function SocialLinkItem({
    href,
    icon,
    label,
    color,
}: {
    href: string;
    icon: React.ReactNode;
    label: string;
    color: string;
}) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background hover:bg-muted/30 transition-colors group"
        >
            <span className={`${color} shrink-0`}>{icon}</span>
            <span className="text-sm font-medium">{label}</span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>
    );
}
