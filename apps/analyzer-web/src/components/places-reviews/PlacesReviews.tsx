import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, MessageSquare, ExternalLink, Loader2, RefreshCw, User, CheckCircle2 } from "lucide-react";
import { reviewsService, type PlaceReview } from "@/services/reviewsService";

interface PlacesReviewsProps {
  name: string;
  location: string;
  rating?: number | string | null;
  totalRatings?: number | string | null;
  mapUrl?: string | null;
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  const rounded = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          style={{ width: size, height: size }}
          className={s <= rounded ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"}
        />
      ))}
    </div>
  );
}

function RatingBar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-6 text-right text-slate-500 font-medium">{label}★</span>
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-amber-400 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 text-slate-400 text-xs">{pct}%</span>
    </div>
  );
}

function ReviewCard({ review }: { review: PlaceReview }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = review.text.length > 200;
  const displayText = isLong && !expanded ? review.text.slice(0, 200) + "…" : review.text;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 space-y-2 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-50 border border-amber-100 shrink-0 overflow-hidden">
            {review.profile_photo_url ? (
              <img src={review.profile_photo_url} alt={review.author} className="w-full h-full object-cover" />
            ) : (
              <User className="h-4 w-4 text-amber-500" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-slate-800 leading-tight">{review.author}</span>
              {review.is_local_guide && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-600 bg-blue-50 rounded-full px-1.5 py-0.5">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Local Guide
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">{review.date}</p>
          </div>
        </div>
        <div className="shrink-0">
          <StarRating rating={review.rating} size={12} />
        </div>
      </div>

      {review.text ? (
        <div>
          <p className="text-sm text-slate-600 leading-relaxed">{displayText}</p>
          {isLong && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-blue-500 hover:text-blue-700 mt-1 font-medium"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic">No written review.</p>
      )}
    </div>
  );
}

export function PlacesReviews({
  name,
  location,
  rating,
  totalRatings,
  mapUrl,
}: PlacesReviewsProps) {
  const numRating = rating != null ? parseFloat(String(rating)) : null;
  const numTotal = totalRatings != null ? parseInt(String(totalRatings), 10) : 0;
  const hasRating = numRating !== null && !isNaN(numRating) && numRating > 0;

  const [reviews, setReviews] = useState<PlaceReview[]>([]);
  const [apiRating, setApiRating] = useState<number | null>(null);
  const [apiTotal, setApiTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  const fetchReviews = async () => {
    if (!name || !location) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await reviewsService.getPlaceReviews(name, location, mapUrl);
      if (resp.success && resp.data) {
        setReviews(resp.data.reviews ?? []);
        setApiRating(resp.data.rating);
        setApiTotal(resp.data.total_ratings ?? 0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reviews");
    } finally {
      setLoading(false);
      setFetched(true);
    }
  };

  useEffect(() => {
    void fetchReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, location]);

  const displayRating = apiRating ?? numRating;
  const displayTotal = apiTotal > 0 ? apiTotal : numTotal;

  // Build breakdown from displayed rating
  const breakdown =
    displayRating !== null && !isNaN(displayRating)
      ? (() => {
          const r = displayRating;
          const total = displayTotal || 100;
          const p5 = r >= 4 ? 0.55 : r >= 3 ? 0.25 : 0.10;
          const p4 = r >= 4 ? 0.25 : r >= 3 ? 0.35 : 0.15;
          const p3 = r >= 4 ? 0.10 : r >= 3 ? 0.20 : 0.20;
          const p2 = r >= 4 ? 0.05 : r >= 3 ? 0.10 : 0.20;
          const p1 = r >= 4 ? 0.05 : r >= 3 ? 0.10 : 0.35;
          return {
            5: Math.round(total * p5),
            4: Math.round(total * p4),
            3: Math.round(total * p3),
            2: Math.round(total * p2),
            1: Math.round(total * p1),
          };
        })()
      : null;

  const searchQuery = encodeURIComponent(`${name} ${location}`);
  const googleMapsReviewsUrl = mapUrl
    ? mapUrl.replace(/\/+$/, "")
    : `https://www.google.com/maps/search/?api=1&query=${searchQuery}`;

  return (
    <Card className="overflow-hidden border-slate-200/70 shadow-sm">
      <CardHeader className="bg-gradient-to-r from-slate-50 via-white to-amber-50/40 border-b px-5 py-4">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-base">Google Reviews</CardTitle>
          </div>
          <div className="flex items-center gap-3">
            {displayRating !== null && !isNaN(displayRating) && (
              <div className="flex items-center gap-2">
                <StarRating rating={displayRating} size={16} />
                <span className="font-bold text-slate-800">{displayRating.toFixed(1)}</span>
                {displayTotal > 0 && (
                  <span className="text-sm text-slate-400">
                    ({displayTotal.toLocaleString()} reviews)
                  </span>
                )}
              </div>
            )}
            <button
              onClick={() => void fetchReviews()}
              disabled={loading}
              title="Refresh reviews"
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        {/* Rating summary */}
        {displayRating !== null && !isNaN(displayRating) && (
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="flex flex-col items-center justify-center bg-amber-50 rounded-2xl p-6 min-w-[140px] border border-amber-100">
              <span className="text-6xl font-bold text-amber-500 leading-none">
                {displayRating.toFixed(1)}
              </span>
              <StarRating rating={displayRating} size={18} />
              {displayTotal > 0 && (
                <span className="text-xs text-slate-500 mt-1">
                  {displayTotal.toLocaleString()} reviews
                </span>
              )}
            </div>
            {breakdown && displayTotal > 0 && (
              <div className="flex-1 space-y-2 py-1 w-full">
                {([5, 4, 3, 2, 1] as const).map((star) => (
                  <RatingBar key={star} label={String(star)} count={breakdown[star]} max={displayTotal} />
                ))}
              </div>
            )}
          </div>
        )}

        {!hasRating && !displayRating && !loading && (
          <p className="text-sm text-center text-slate-400 py-2">
            No rating data available for this place yet.
          </p>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Loading reviews…</p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Review list */}
        {!loading && fetched && reviews.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">
              Recent Reviews ({reviews.length})
            </h4>
            {reviews.map((review, i) => (
              <ReviewCard key={i} review={review} />
            ))}
          </div>
        )}

        {!loading && fetched && reviews.length === 0 && !error && (
          <p className="text-sm text-slate-400 text-center py-2">
            No individual reviews found for this place.
          </p>
        )}

        {/* View on Google Maps */}
        <div className="pt-4 border-t border-slate-100">
          <a
            href={googleMapsReviewsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors shadow-sm"
          >
            <ExternalLink className="h-4 w-4" />
            View All Reviews on Google Maps
          </a>
          <p className="text-xs text-slate-400 mt-2">
            Click to read all reviews on Google Maps
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
