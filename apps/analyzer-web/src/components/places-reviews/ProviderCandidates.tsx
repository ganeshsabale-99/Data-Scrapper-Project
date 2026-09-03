import { useEffect, useState } from "react";
import { ExternalLink, SearchCheck, ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { reviewsService, type VenueProviderCandidatesResponse } from "@/services/reviewsService";

const label = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function ProviderCandidates({ venueType, venueId }: { venueType: string; venueId: string }) {
  const [category, setCategory] = useState("ALL");
  const [highOnly, setHighOnly] = useState(false);
  const [data, setData] = useState<VenueProviderCandidatesResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    reviewsService.getVenueProviderCandidates(venueType, venueId, category, highOnly)
      .then((response) => { if (active) setData(response.data); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [venueType, venueId, category, highOnly]);

  const categories = ["ALL", ...Object.keys(data?.counts.categories ?? {})];
  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="border-b px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><CardTitle className="flex items-center gap-2 text-base"><ShieldQuestion className="h-5 w-5 text-violet-600" />Service Provider Candidates</CardTitle><p className="mt-1 text-xs text-slate-500">Public-source leads for sales review. These are not confirmed contracts.</p></div>
          <div className="flex gap-2"><Badge variant="outline">{data?.counts.all ?? 0} found</Badge><Badge className="bg-violet-100 text-violet-800 hover:bg-violet-100">{data?.counts.high ?? 0} high relevance</Badge></div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          {categories.map((item) => <Button key={item} size="sm" variant={category === item ? "default" : "outline"} onClick={() => setCategory(item)}>{label(item)} {item === "ALL" ? `(${data?.counts.all ?? 0})` : `(${data?.counts.categories[item] ?? 0})`}</Button>)}
          <Button size="sm" variant={highOnly ? "default" : "outline"} onClick={() => setHighOnly((value) => !value)}><SearchCheck className="mr-1 h-4 w-4" />High relevance only</Button>
        </div>
        {loading ? <p className="py-5 text-center text-sm text-slate-500">Loading candidates...</p> : !data?.items.length ? <p className="rounded-md bg-slate-50 p-5 text-center text-sm text-slate-600">No provider candidates collected for this venue yet.</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.items.map((item) => <article key={item.id} className="space-y-2 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{item.candidateName || item.title}</p><p className="text-xs text-slate-500">{item.sourceDomain}</p></div><Badge variant="outline">Score {item.relevanceScore}</Badge></div>
              <div className="flex flex-wrap gap-2"><Badge>{label(item.category)}</Badge><Badge variant="outline">{label(item.status)}</Badge></div>
              <p className="text-sm leading-5 text-slate-600">{item.snippet || "No evidence snippet returned."}</p>
              {(item.phone || item.email) && <p className="text-xs text-slate-700">{item.phone || ""} {item.email || ""}</p>}
              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">Open evidence <ExternalLink className="h-3 w-3" /></a>
            </article>)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
