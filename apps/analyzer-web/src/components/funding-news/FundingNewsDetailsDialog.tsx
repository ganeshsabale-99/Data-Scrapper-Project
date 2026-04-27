import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Calendar, Coins, MapPin, User } from "lucide-react";
import type { FundingNews } from "@/services/fundingNewsService";

interface FundingNewsDetailsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    newsItem: FundingNews | null;
}

const sourceColors: Record<string, string> = {
    ENTRACKR: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    YOURSTORY: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

const getSourceColor = (source: string) => {
    return sourceColors[source] || 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300';
};

export default function FundingNewsDetailsDialog({ isOpen, onClose, newsItem }: FundingNewsDetailsDialogProps) {
    if (!newsItem) return null;

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch {
            return 'N/A';
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto">
                    <div className="flex flex-col">
                        {/* Hero Image */}
                        {newsItem.image_url && (
                            <div className="w-full h-48 sm:h-64 relative bg-slate-100 dark:bg-slate-800">
                                <img
                                    src={newsItem.image_url}
                                    alt={newsItem.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            </div>
                        )}

                        <div className="p-6 space-y-6">
                            {/* Header Section */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="secondary" className={getSourceColor(newsItem.source)}>
                                        {newsItem.source}
                                    </Badge>
                                    {newsItem.industry && (
                                        <Badge variant="outline">
                                            {newsItem.industry}
                                        </Badge>
                                    )}
                                    <span className="text-sm text-slate-500 flex items-center gap-1 ml-auto">
                                        <Calendar className="w-4 h-4" />
                                        {formatDate(newsItem.date_published)}
                                    </span>
                                </div>

                                <DialogHeader className="space-y-2">
                                    <DialogTitle className="text-2xl font-bold leading-tight">
                                        {newsItem.title}
                                    </DialogTitle>
                                    {newsItem.author && (
                                        <DialogDescription className="text-base">
                                            By <span className="font-medium text-foreground">{newsItem.author}</span>
                                        </DialogDescription>
                                    )}
                                </DialogHeader>
                            </div>

                            {/* Key Stats Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-border">
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground uppercase font-medium flex items-center gap-1">
                                        <Coins className="w-3 h-3" /> Amount
                                    </span>
                                    <div className="font-semibold text-green-600 dark:text-green-400 truncate">
                                        {newsItem.funding_amount || "Undisclosed"}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground uppercase font-medium">Round</span>
                                    <div className="font-medium truncate">
                                        {newsItem.round || "N/A"}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground uppercase font-medium flex items-center gap-1">
                                        <MapPin className="w-3 h-3" /> Location
                                    </span>
                                    <div className="font-medium truncate">
                                        {newsItem.location || "N/A"}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground uppercase font-medium flex items-center gap-1">
                                        <User className="w-3 h-3" /> Investors
                                    </span>
                                    <div className="font-medium truncate" title={newsItem.investors?.join(", ")}>
                                        {newsItem.investors?.length ? `${newsItem.investors.length} Investors` : "N/A"}
                                    </div>
                                </div>
                            </div>

                            {/* Content Section */}
                            <div className="space-y-4">
                                <div className="prose dark:prose-invert max-w-none">
                                    <p className="whitespace-pre-wrap leading-relaxed">
                                        {newsItem.full_content || newsItem.content_summary || "No content summary available."}
                                    </p>
                                </div>

                                {/* Detailed Lists */}
                                {newsItem.investors && newsItem.investors.length > 0 && (
                                    <div className="space-y-2 pt-2">
                                        <h4 className="font-semibold text-sm">Investors</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {newsItem.investors.map((inv, i) => (
                                                <Badge key={i} variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                    {inv}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {newsItem.founders && newsItem.founders.length > 0 && (
                                    <div className="space-y-2 pt-2">
                                        <h4 className="font-semibold text-sm">Founders</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {newsItem.founders.map((founder, i) => (
                                                <Badge key={i} variant="outline">
                                                    {founder}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="p-4 border-t border-border bg-background z-10">
                    <Button
                        className="w-full sm:w-auto gap-2"
                        onClick={() => window.open(newsItem.article_url, '_blank')}
                    >
                        <ExternalLink className="w-4 h-4" />
                        Read Original Article
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
