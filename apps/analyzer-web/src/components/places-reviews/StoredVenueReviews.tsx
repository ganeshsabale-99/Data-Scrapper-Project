import { useEffect, useState } from "react";
import { AlertCircle, Car, MessageSquareText, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { reviewsService, type StoredReviewFilter, type StoredVenueReviewsResponse } from "@/services/reviewsService";

const FILTERS: { value: StoredReviewFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "issues", label: "Issues" },
  { value: "parking", label: "Parking" },
];

const categoryLabel = (value: string) =>
  value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function StoredVenueReviews({ venueType, venueId }: { venueType: string; venueId: string }) {
  const [filter, setFilter] = useState<StoredReviewFilter>("all");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<StoredVenueReviewsResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    reviewsService.getStoredVenueReviews(venueType, venueId, filter, page)
      .then((response) => { if (active) setResult(response.data); })
      .catch(() => { if (active) setError("Could not load collected reviews."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [venueType, venueId, filter, page]);

  const selectFilter = (value: StoredReviewFilter) => {
    setFilter(value);
    setPage(1);
  };

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="border-b px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><MessageSquareText className="h-5 w-5 text-blue-600" />Collected Reviews</CardTitle>
            <p className="mt-1 text-xs text-slate-500">Saved by the full review scraper. Opening this page does not use external API credits.</p>
          </div>
          <Badge variant="outline" className="text-sm">{result?.counts.all ?? 0} found</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(({ value, label }) => (
            <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} onClick={() => selectFilter(value)}>
              {label} ({result?.counts[value] ?? 0})
            </Button>
          ))}
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-slate-500">Loading collected reviews...</p>
        ) : error ? (
          <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-4 w-4" />{error}</div>
        ) : !result?.items.length ? (
          <p className="rounded-md bg-slate-50 p-5 text-center text-sm text-slate-600">
            {result?.counts.all ? `No ${filter} reviews found.` : "No stored reviews yet. Run the full review scraper for this venue."}
          </p>
        ) : (
          <div className="divide-y rounded-lg border">
            {result.items.map((review) => (
              <article key={review.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {review.authorImageUrl ? <img src={review.authorImageUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold">{(review.authorName || "A")[0]}</div>}
                    <div><p className="text-sm font-semibold">{review.authorName || "Anonymous"}</p><p className="text-xs text-slate-500">{review.relativeTime || (review.publishedAt ? new Date(review.publishedAt).toLocaleDateString("en-IN") : "")}</p></div>
                  </div>
                  <div className="flex items-center gap-1 font-semibold"><Star className="h-4 w-4 fill-amber-400 text-amber-400" />{review.rating ?? "N/A"}</div>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{review.text || "No written comment."}</p>
                <div className="flex flex-wrap gap-2">
                  {review.isParkingRelated && <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100"><Car className="mr-1 h-3 w-3" />Parking related</Badge>}
                  {review.issueScore > 0 && <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Issue score {review.issueScore}</Badge>}
                  {review.issueCategories.map((category) => <Badge key={category} variant="outline">{categoryLabel(category)}</Badge>)}
                </div>
              </article>
            ))}
          </div>
        )}

        {result && result.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span>Page {result.page} of {result.totalPages} · {result.totalItems} matching</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page >= result.totalPages || loading} onClick={() => setPage((current) => current + 1)}>Next</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
