import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, Car, ExternalLink, AlertTriangle, Loader2, RefreshCw, User, CheckCircle2 } from "lucide-react";
import { reviewsService, type PlaceReview } from "@/services/reviewsService";

interface ParkingComplaintsReviewsProps {
  name: string;
  location: string;
  mapUrl?: string | null;
  rating?: number | string | null;
  totalRatings?: number | string | null;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={s <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"}
          style={{ width: 13, height: 13 }}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: PlaceReview }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = review.text.length > 200;
  const displayText = isLong && !expanded ? review.text.slice(0, 200) + "…" : review.text;

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 space-y-2 hover:shadow-md hover:border-indigo-100 transition-all duration-200">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 border border-slate-100 shrink-0">
            <User className="h-4 w-4 text-slate-400" />
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
          <StarRating rating={review.rating} />
        </div>
      </div>

      {review.text ? (
        <div>
          <p className="text-sm text-slate-600 leading-relaxed">{displayText}</p>
          {isLong && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-indigo-600 hover:text-indigo-800 mt-1 font-medium underline-offset-2 hover:underline"
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

export function ParkingComplaintsReviews({
  name,
  location,
  mapUrl,
  rating,
  totalRatings,
}: ParkingComplaintsReviewsProps) {
  const numRating = rating != null ? parseFloat(String(rating)) : null;
  const numTotal = totalRatings != null ? parseInt(String(totalRatings), 10) : 0;

  const [complaints, setComplaints] = useState<PlaceReview[]>([]);
  const [totalScanned, setTotalScanned] = useState(0);
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  const fetchComplaints = async () => {
    if (!name || !location) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await reviewsService.getParkingComplaints(name, location, mapUrl);
      if (resp.success && resp.data) {
        setComplaints(resp.data.complaints ?? []);
        setTotalScanned(resp.data.total_reviews_scanned ?? 0);
        setOverallRating(resp.data.overall_rating ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load parking complaints");
    } finally {
      setLoading(false);
      setFetched(true);
    }
  };

  useEffect(() => {
    void fetchComplaints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, location]);

  const displayRating = overallRating ?? numRating;
  const displayTotal = numTotal;

  const searchQuery = encodeURIComponent(`${name} ${location} parking reviews`);
  const googleReviewsUrl = mapUrl ?? `https://www.google.com/maps/search/?api=1&query=${searchQuery}`;
  const parkingSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${location} parking`)}`;
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${name} ${location} parking reviews site:google.com/maps`)}`;

  const lowRating = displayRating !== null && !isNaN(displayRating) && displayRating < 3.5;

  return (
    <Card className="overflow-hidden border-slate-200/60 shadow-sm">
      <CardHeader className="bg-gradient-to-r from-slate-50 via-white to-indigo-50/30 border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100">
              <Car className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <CardTitle className="text-base text-slate-800">Parking Insights</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Parking-related review analysis
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lowRating && displayRating !== null && (
              <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-full px-3 py-1 text-xs font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                Low overall rating ({displayRating.toFixed(1)}★) — verify parking before visiting
              </div>
            )}
            <button
              onClick={() => void fetchComplaints()}
              disabled={loading}
              title="Refresh parking insights"
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        {/* Overall rating signal */}
        {displayRating !== null && !isNaN(displayRating) && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-2xl font-bold text-slate-700">{displayRating.toFixed(1)}</div>
            <div>
              <StarRating rating={displayRating} />
              <p className="text-xs text-slate-500 mt-0.5">
                Overall place rating ·{" "}
                {displayTotal > 0 ? `${displayTotal.toLocaleString()} reviews` : "review count unavailable"}
              </p>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <p className="text-sm">Scanning reviews for parking mentions…</p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Parking complaints */}
        {!loading && fetched && complaints.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Parking-Related Complaints ({complaints.length})
              </h4>
              {totalScanned > 0 && (
                <span className="text-xs text-slate-400">
                  from {totalScanned} reviews scanned
                </span>
              )}
            </div>
            {complaints.map((c, i) => (
              <ReviewCard key={i} review={c} />
            ))}
          </div>
        )}

        {!loading && fetched && complaints.length === 0 && !error && (
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            ✅ No parking-related complaints found
            {totalScanned > 0 && ` in the ${totalScanned} reviews scanned`}.
          </div>
        )}

        {/* Action links */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          <a
            href={parkingSearchUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-100 active:scale-95"
          >
            <Car className="h-3.5 w-3.5" />
            Find Parking on Google Maps
          </a>
          <a
            href={googleReviewsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View Reviews on Google Maps
          </a>
          <a
            href={googleSearchUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Search Parking Reviews
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
