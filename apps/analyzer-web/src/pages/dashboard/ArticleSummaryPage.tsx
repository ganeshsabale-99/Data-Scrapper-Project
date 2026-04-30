import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Clock,
  AlertCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArticleSummaryService,
  type ArticleSummaryData,
} from "@/services/articleSummaryService";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LocationState {
  title?: string;
  articleUrl?: string;
  source?: string;
  author?: string;
  datePublished?: string;
}

type ApiErrorShape = {
  response?: {
    data?: {
      error?: string;
      step?: string;
      scrapedData?: {
        title?: string;
        imageUrl?: string | null;
        publishedDate?: string | null;
        source?: string | null;
      };
    };
  };
  message?: string;
};

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Image skeleton */}
      <div className="w-full h-64 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 rounded-2xl" />
      {/* Title skeleton */}
      <div className="space-y-3">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-lg w-3/4" />
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
      </div>
      {/* Summary skeleton */}
      <div className="space-y-4 p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded-full shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Summary Bullet Points Parser ────────────────────────────────────────────

function parseSummaryBullets(summary: string): string[] {
  // Split by common bullet patterns
  const lines = summary
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const bullets: string[] = [];
  for (const line of lines) {
    // Remove bullet prefixes (-, *, •, 1., 2., etc.)
    const cleaned = line
      .replace(/^[-*•]\s*/, "")
      .replace(/^\d+[.)]\s*/, "")
      .replace(/^\*\*/, "")
      .replace(/\*\*$/, "")
      .trim();
    if (cleaned.length > 10) {
      bullets.push(cleaned);
    }
  }

  // If no bullets found, treat the entire summary as one block
  if (bullets.length === 0 && summary.trim().length > 10) {
    return [summary.trim()];
  }

  return bullets;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ArticleSummaryPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;

  const [summaryData, setSummaryData] = useState<ArticleSummaryData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorStep, setErrorStep] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const articleUrl = state?.articleUrl;
  const articleTitle = state?.title || "Article";

  // ── Fetch summary on mount ─────────────────────────────────────────────

  const fetchSummary = async () => {
    if (!articleUrl) {
      setError("No article URL provided. Please navigate from the Funding News page.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setErrorStep(null);

    try {
      const response = await ArticleSummaryService.summarizeUrl(articleUrl);
      setSummaryData(response.data);
    } catch (err: unknown) {
      const parsedError = err as ApiErrorShape;
      const errorMessage =
        parsedError.response?.data?.error ||
        parsedError.message ||
        "Failed to generate article summary.";
      const step = parsedError.response?.data?.step || null;

      setError(errorMessage);
      setErrorStep(step);

      // If scraping succeeded but LLM failed, we might have partial data
      const scrapedData = parsedError.response?.data?.scrapedData;
      if (scrapedData) {
        setSummaryData({
          title: scrapedData.title || articleTitle,
          summary: "",
          imageUrl: scrapedData.imageUrl || null,
          publishedDate: scrapedData.publishedDate || null,
          source: scrapedData.source || state?.source || null,
          articleUrl: articleUrl,
          model: "",
          generatedAt: "",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleUrl]);

  // ── Copy to clipboard ──────────────────────────────────────────────────

  const handleCopy = async () => {
    if (!summaryData?.summary) return;
    try {
      const textToCopy = `${summaryData.title}\n\n${summaryData.summary}\n\nSource: ${summaryData.articleUrl}`;
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success("Summary copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  // ── Back navigation ────────────────────────────────────────────────────

  const handleBack = () => {
    navigate("/dashboard/funding-news");
  };

  // ── Render ─────────────────────────────────────────────────────────────

  const displayTitle = summaryData?.title || articleTitle;
  const displaySource =
    summaryData?.source || state?.source || null;
  const displayImage = summaryData?.imageUrl || null;
  const bullets = summaryData?.summary
    ? parseSummaryBullets(summaryData.summary)
    : [];

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Back button */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Button
          variant="ghost"
          onClick={handleBack}
          className="mb-6 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Funding News
        </Button>
      </motion.div>

      {/* Loading state */}
      {loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="overflow-hidden border-0 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
            <CardContent className="p-8">
              {/* Loading header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-white animate-pulse" />
                  </div>
                  <Loader2 className="h-5 w-5 text-amber-500 absolute -top-1 -right-1 animate-spin" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Generating AI Summary
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    This may take 15-30 seconds...
                  </p>
                </div>
              </div>

              {/* Progress steps */}
              <div className="mb-8 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                  <span className="text-slate-600 dark:text-slate-400">
                    Scraping article content & extracting image...
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm opacity-50">
                  <div className="h-4 w-4 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                  <span className="text-slate-400 dark:text-slate-500">
                    Analyzing with AI (tinyllama)...
                  </span>
                </div>
              </div>

              <LoadingSkeleton />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Error state */}
      {!loading && error && !summaryData?.summary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="overflow-hidden border-0 shadow-xl border-red-200 dark:border-red-800">
            <CardContent className="p-8">
              <div className="flex flex-col items-center text-center py-8">
                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  {errorStep === "scraping"
                    ? "Failed to Scrape Article"
                    : errorStep === "summarization"
                      ? "AI Summarization Failed"
                      : "Something Went Wrong"}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 max-w-md mb-6">
                  {error}
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={fetchSummary}
                    className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try Again
                  </Button>
                  <Button variant="outline" onClick={handleBack} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Go Back
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Success state */}
      {!loading && summaryData?.summary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {/* Article Image (only if available) */}
          {displayImage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative overflow-hidden rounded-2xl shadow-lg"
            >
              <img
                src={displayImage}
                alt={displayTitle}
                className="w-full h-64 sm:h-80 object-cover"
                onError={(e) => {
                  // Hide the image container if it fails to load
                  (e.target as HTMLImageElement).parentElement!.style.display =
                    "none";
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              {displaySource && (
                <div className="absolute bottom-4 left-4">
                  <Badge className="bg-white/20 text-white backdrop-blur-sm border-white/30 text-xs">
                    {displaySource}
                  </Badge>
                </div>
              )}
            </motion.div>
          )}

          {/* Title & Meta */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
              {displayTitle}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-slate-500 dark:text-slate-400">
              {displaySource && !displayImage && (
                <Badge
                  variant="secondary"
                  className="bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                >
                  {displaySource}
                </Badge>
              )}
              {summaryData.publishedDate && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(summaryData.publishedDate).toLocaleDateString(
                    "en-US",
                    {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }
                  )}
                </span>
              )}
              {state?.author && (
                <span>By {state.author}</span>
              )}
            </div>
          </motion.div>

          {/* AI Summary Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/80 backdrop-blur-xl">
              <CardContent className="p-6 sm:p-8">
                {/* Summary header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                      <Sparkles className="h-4.5 w-4.5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        AI Summary
                      </h2>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        Generated by {summaryData.model} •{" "}
                        {new Date(summaryData.generatedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="gap-2 text-xs"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-green-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>

                {/* Bullet points */}
                <div className="space-y-4">
                  {bullets.map((bullet, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.4 + index * 0.08 }}
                      className="flex gap-3"
                    >
                      <div className="mt-1.5 shrink-0">
                        <div className="w-2 h-2 rounded-full bg-gradient-to-br from-amber-400 to-orange-500" />
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[15px]">
                        {bullet}
                      </p>
                    </motion.div>
                  ))}
                </div>

                {/* If we couldn't parse bullets, show raw text */}
                {bullets.length === 0 && summaryData.summary && (
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {summaryData.summary}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="flex flex-wrap gap-3"
          >
            <Button
              onClick={() => window.open(summaryData.articleUrl, "_blank")}
              className="gap-2 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white shadow-lg shadow-indigo-500/20"
            >
              <ExternalLink className="h-4 w-4" />
              Read Full Article
            </Button>
            <Button
              variant="outline"
              onClick={fetchSummary}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate Summary
            </Button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
