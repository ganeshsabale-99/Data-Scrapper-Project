import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
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
    Building2,
} from 'lucide-react';
import { FundingNewsService, type CompanyDetails } from '@/services/fundingNewsService';

interface CompanyDetailsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    newsId: string;
    articleUrl: string;
    articleTitle: string;
}

type ApiErrorShape = {
    response?: {
        data?: {
            error?: string;
        };
    };
    message?: string;
};

export default function CompanyDetailsDialog({
    isOpen,
    onClose,
    newsId,
    articleUrl,
    articleTitle,
}: CompanyDetailsDialogProps) {
    const [details, setDetails] = useState<CompanyDetails | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDetails = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await FundingNewsService.getCompanyDetails(newsId);
            setDetails(response.data);
        } catch (err: unknown) {
            const parsedError = err as ApiErrorShape;
            setError(
                parsedError.response?.data?.error ||
                parsedError.message ||
                'Failed to fetch company details'
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && newsId) {
            fetchDetails();
        }
        // Reset state when dialog closes
        if (!isOpen) {
            setDetails(null);
            setError(null);
        }
    }, [isOpen, newsId]);

    const hasSocialLinks = details?.socialLinks &&
        Object.values(details.socialLinks).some(Boolean);

    const hasAnyData = details && (
        details.website ||
        hasSocialLinks ||
        details.otherLinks.length > 0 ||
        details.description
    );

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                {/* Header */}
                <div className="p-6 pb-4 border-b border-border">
                    <DialogHeader className="space-y-2">
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Building2 className="h-5 w-5 text-purple-600" />
                            {details?.companyName || 'Company Details'}
                        </DialogTitle>
                        <DialogDescription className="text-sm line-clamp-2">
                            {articleTitle}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Loading State */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                            <p className="text-sm text-muted-foreground">Fetching company details...</p>
                        </div>
                    )}

                    {/* Error State */}
                    {error && !loading && (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <div className="flex items-center gap-2 text-red-600">
                                <AlertCircle className="h-5 w-5" />
                                <p className="text-sm font-medium">{error}</p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={fetchDetails}
                                className="gap-2"
                            >
                                <RefreshCw className="h-4 w-4" />
                                Retry
                            </Button>
                        </div>
                    )}

                    {/* Content - Loaded */}
                    {!loading && !error && details && (
                        <div className="space-y-5">
                            {/* No Data Found */}
                            {!hasAnyData && (
                                <div className="flex flex-col items-center justify-center py-10 gap-3">
                                    <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center">
                                        <Building2 className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <div className="text-center space-y-1">
                                        <p className="text-sm font-medium text-foreground">
                                            No details found
                                        </p>
                                        <p className="text-xs text-muted-foreground max-w-[260px]">
                                            {details.companyName === 'Unknown'
                                                ? 'No specific company name could be identified from this headline.'
                                                : 'This company may be too new or information is not publicly available yet.'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Description */}
                            {details.description && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        About
                                    </h4>
                                    <p className="text-sm leading-relaxed text-foreground">
                                        {details.description}
                                    </p>
                                </div>
                            )}

                            {/* Website */}
                            {details.website && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Website
                                    </h4>
                                    <a
                                        href={details.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors group"
                                    >
                                        <Globe className="h-4 w-4 text-blue-600 shrink-0" />
                                        <span className="text-sm text-blue-600 group-hover:text-blue-700 truncate font-medium">
                                            {details.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                                        </span>
                                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
                                    </a>
                                </div>
                            )}

                            {/* Social Links */}
                            {hasSocialLinks && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Social Links
                                    </h4>
                                    <div className="grid grid-cols-1 gap-1.5">
                                        {details.socialLinks.linkedin && (
                                            <SocialLinkItem
                                                href={details.socialLinks.linkedin}
                                                icon={<Linkedin className="h-4 w-4" />}
                                                label="LinkedIn"
                                                color="text-[#0A66C2]"
                                            />
                                        )}
                                        {details.socialLinks.twitter && (
                                            <SocialLinkItem
                                                href={details.socialLinks.twitter}
                                                icon={<Twitter className="h-4 w-4" />}
                                                label="Twitter / X"
                                                color="text-[#1DA1F2]"
                                            />
                                        )}
                                        {details.socialLinks.facebook && (
                                            <SocialLinkItem
                                                href={details.socialLinks.facebook}
                                                icon={<Facebook className="h-4 w-4" />}
                                                label="Facebook"
                                                color="text-[#1877F2]"
                                            />
                                        )}
                                        {details.socialLinks.instagram && (
                                            <SocialLinkItem
                                                href={details.socialLinks.instagram}
                                                icon={<Instagram className="h-4 w-4" />}
                                                label="Instagram"
                                                color="text-[#E4405F]"
                                            />
                                        )}
                                        {details.socialLinks.crunchbase && (
                                            <SocialLinkItem
                                                href={details.socialLinks.crunchbase}
                                                icon={<Building2 className="h-4 w-4" />}
                                                label="Crunchbase"
                                                color="text-[#0288D1]"
                                            />
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Other Links */}
                            {details.otherLinks.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Related Links
                                    </h4>
                                    <div className="space-y-1.5">
                                        {details.otherLinks.map((link, i) => (
                                            <a
                                                key={i}
                                                href={link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors group"
                                            >
                                                <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                                <span className="text-sm text-muted-foreground group-hover:text-foreground truncate">
                                                    {link.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                                                </span>
                                                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border bg-background">
                    <Button
                        className="w-full sm:w-auto gap-2"
                        variant="outline"
                        onClick={() => window.open(articleUrl, '_blank')}
                    >
                        <ExternalLink className="w-4 h-4" />
                        Read Original Article
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Reusable social link row component
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
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors group"
        >
            <span className={`${color} shrink-0`}>{icon}</span>
            <span className="text-sm font-medium">{label}</span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>
    );
}
