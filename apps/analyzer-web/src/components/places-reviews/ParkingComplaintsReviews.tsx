import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, Car, ExternalLink, AlertTriangle } from "lucide-react";

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
          className={s <= Math.round(rating) ? "fill-red-400 text-red-400" : "fill-slate-200 text-slate-200"}
          style={{ width: 13, height: 13 }}
        />
      ))}
    </div>
  );
}

const PARKING_TIPS = [
  "Check if the complex has dedicated visitor parking slots",
  "Two-wheeler parking may be limited during peak hours",
  "Basement parking may fill up by 9:30 AM on weekdays",
  "Consider carpooling to reduce parking pressure",
  "Valet services may be available — call reception ahead",
];

export function ParkingComplaintsReviews({
  name,
  location,
  mapUrl,
  rating,
  totalRatings,
}: ParkingComplaintsReviewsProps) {
  const numRating = rating != null ? parseFloat(String(rating)) : null;
  const numTotal = totalRatings != null ? parseInt(String(totalRatings), 10) : 0;

  const searchQuery = encodeURIComponent(`${name} ${location} parking reviews`);
  const googleReviewsUrl = mapUrl
    ? mapUrl
    : `https://www.google.com/maps/search/?api=1&query=${searchQuery}`;

  // Build a parking-specific search URL
  const parkingSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${location} parking`)}`;
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${name} ${location} parking reviews site:google.com/maps`)}`;

  // Simple indicator: if rating < 3.5, parking might be a concern
  const lowRating = numRating !== null && !isNaN(numRating) && numRating < 3.5;

  return (
    <Card className="overflow-hidden border-red-200/60 shadow-sm">
      <CardHeader className="bg-gradient-to-r from-red-50 via-white to-rose-50/40 border-b border-red-100 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100">
              <Car className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <CardTitle className="text-base text-red-800">Parking Insights</CardTitle>
              <p className="text-xs text-red-500 mt-0.5">
                Parking-related review analysis
              </p>
            </div>
          </div>
          {lowRating && numRating !== null && (
            <div className="flex items-center gap-1.5 bg-red-100 text-red-700 rounded-full px-3 py-1 text-xs font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              Low overall rating ({numRating.toFixed(1)}★) — verify parking before visiting
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        {/* Overall signal */}
        {numRating !== null && !isNaN(numRating) && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-2xl font-bold text-slate-700">{numRating.toFixed(1)}</div>
            <div>
              <StarRating rating={numRating} />
              <p className="text-xs text-slate-500 mt-0.5">
                Overall place rating · {numTotal > 0 ? `${numTotal.toLocaleString()} reviews` : "review count unavailable"}
              </p>
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-700">Common Parking Considerations</h4>
          <ul className="space-y-1.5">
            {PARKING_TIPS.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                <span className="mt-0.5 text-amber-400">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        {/* Action links */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          <a
            href={parkingSearchUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors shadow-sm"
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
