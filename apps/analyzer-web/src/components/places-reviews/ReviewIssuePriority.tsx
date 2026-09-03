import { AlertTriangle, CheckCircle2, Clock3, MessageSquareWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ReviewIssuePriorityData {
  review_issue_score?: number | null;
  review_priority?: string | null;
  review_issue_categories?: string[] | null;
  review_issue_summary?: string | null;
  reviews_analyzed?: number | null;
  issue_review_count?: number | null;
  parking_review_count?: number | null;
  review_analyzed_at?: string | null;
}

const PRIORITY_STYLE: Record<string, { label: string; badge: string; panel: string }> = {
  P1_CRITICAL: { label: "P1 Critical", badge: "bg-red-600 text-white", panel: "border-red-200 bg-red-50/60" },
  P2_HIGH: { label: "P2 High", badge: "bg-orange-500 text-white", panel: "border-orange-200 bg-orange-50/60" },
  P3_MEDIUM: { label: "P3 Medium", badge: "bg-amber-400 text-amber-950", panel: "border-amber-200 bg-amber-50/60" },
  P4_LOW: { label: "P4 Low", badge: "bg-emerald-600 text-white", panel: "border-emerald-200 bg-emerald-50/50" },
};

const categoryLabel = (value: string) =>
  value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function ReviewIssuePriority({ data }: { data: ReviewIssuePriorityData }) {
  const priority = data.review_priority || "P4_LOW";
  const style = PRIORITY_STYLE[priority] || PRIORITY_STYLE.P4_LOW;
  const categories = data.review_issue_categories ?? [];
  const reviewed = data.reviews_analyzed ?? 0;
  const score = data.review_issue_score ?? 0;

  return (
    <Card className={`overflow-hidden shadow-sm ${style.panel}`}>
      <CardHeader className="border-b border-current/10 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageSquareWarning className="h-5 w-5" />
            <CardTitle className="text-base">Review Issue Priority</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={style.badge}>{style.label}</Badge>
            <span className="rounded-full bg-white/80 px-3 py-1 text-sm font-bold text-slate-800">{score}/100</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        {reviewed > 0 ? (
          <>
            <div className="flex items-start gap-2 text-sm text-slate-700">
              {score > 0 ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
              <p>{data.review_issue_summary || "No tracked issue was detected in the available review sample."}</p>
            </div>
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => <Badge key={category} variant="outline" className="bg-white/70">{categoryLabel(category)}</Badge>)}
              </div>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
              <span>{reviewed} Google review{reviewed === 1 ? "" : "s"} analyzed</span>
              <span>{data.issue_review_count ?? 0} with detected issues</span>
              <span>{data.parking_review_count ?? 0} parking-related</span>
              {data.review_analyzed_at && <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{new Date(data.review_analyzed_at).toLocaleString("en-IN")}</span>}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-600">Review priority has not been calculated yet. Run or refresh this venue’s scraper to analyze its available Google reviews.</p>
        )}
      </CardContent>
    </Card>
  );
}
