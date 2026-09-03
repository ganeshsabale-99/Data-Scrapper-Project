export type ReviewPriority = "P1_CRITICAL" | "P2_HIGH" | "P3_MEDIUM" | "P4_LOW";

export interface GoogleReviewInput {
  text?: string;
  rating?: number;
  time?: number;
  relative_time_description?: string;
}

export interface ReviewIssueEvidence {
  [key: string]: string | number | null;
  category: string;
  severity: number;
  rating: number | null;
  excerpt: string;
}

export interface ReviewIssueResult {
  score: number;
  priority: ReviewPriority;
  categories: string[];
  summary: string | null;
  evidence: ReviewIssueEvidence[];
  reviewsAnalyzed: number;
  issueReviewCount: number;
  parkingReviewCount: number;
}

const CATEGORY_PATTERNS: Record<string, Array<[RegExp, number]>> = {
  PARKING: [[/no parking|parking (?:problem|issue|full|unavailable)|nowhere to park|towing/i, 4], [/paid parking|limited parking|parking space/i, 2]],
  ACCESS_TRAFFIC: [[/traffic jam|severe traffic|blocked entrance|inaccessible/i, 4], [/congestion|difficult to reach|entry (?:problem|issue)|exit (?:problem|issue)/i, 2]],
  SAFETY_SECURITY: [[/unsafe|theft|stolen|harassment|security (?:problem|issue)|fire hazard/i, 5], [/poor security|no security|security staff rude/i, 3]],
  CLEANLINESS: [[/filthy|very dirty|unhygienic|foul smell|bad smell/i, 4], [/dirty|unclean|washroom (?:problem|issue)|toilet (?:problem|issue)/i, 2]],
  MAINTENANCE: [[/lift not working|elevator not working|power cut|water leakage|broken escalator/i, 4], [/poor maintenance|not maintained|maintenance (?:problem|issue)|broken/i, 2]],
  CROWDING: [[/overcrowded|dangerously crowded|stampede/i, 5], [/too crowded|long queue|huge queue|waiting time/i, 2]],
  STAFF_SERVICE: [[/fraud|scam|threatened|abusive staff/i, 5], [/rude staff|bad service|poor service|unhelpful staff|mismanagement/i, 2]],
  HYGIENE_HEALTH: [[/infection|contaminated|medical negligence/i, 5], [/mosquito|pest|cockroach|sanitation (?:problem|issue)/i, 3]],
};

const NEGATION = /\b(?:no|not|never|without|isn't|wasn't|don't|didn't)\b[^.!?]{0,24}$/i;

function hasNonNegatedMatch(text: string, pattern: RegExp): boolean {
  const match = pattern.exec(text);
  if (!match || match.index === undefined) return false;
  return !NEGATION.test(text.slice(Math.max(0, match.index - 30), match.index));
}

function recencyWeight(unixSeconds: number | undefined, nowMs: number): number {
  if (!unixSeconds) return 1;
  const ageDays = Math.max(0, (nowMs - unixSeconds * 1000) / 86_400_000);
  if (ageDays <= 90) return 1.25;
  if (ageDays <= 365) return 1.1;
  if (ageDays <= 730) return 0.9;
  return 0.7;
}

function ratingWeight(rating: number | undefined): number {
  if (!rating) return 1;
  return ({ 1: 1.5, 2: 1.3, 3: 1.05, 4: 0.65, 5: 0.35 } as Record<number, number>)[Math.round(rating)] ?? 1;
}

export function scoreReviewIssues(reviews: GoogleReviewInput[], nowMs = Date.now()): ReviewIssueResult {
  const usable = (reviews ?? []).filter((review) => Boolean(review.text?.trim()));
  const categoryScores = new Map<string, number>();
  const evidence: ReviewIssueEvidence[] = [];
  let issueReviewCount = 0;
  let parkingReviewCount = 0;

  for (const review of usable) {
    const text = review.text!.trim();
    let reviewHasIssue = false;
    let reviewHasParkingIssue = false;
    for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
      if (category === "PARKING" && /\b(?:no|not any) parking (?:problem|issue)s?\b/i.test(text)) continue;
      let severity = 0;
      for (const [pattern, weight] of patterns) {
        if (hasNonNegatedMatch(text, pattern)) severity = Math.max(severity, weight);
      }
      if (!severity) continue;
      reviewHasIssue = true;
      if (category === "PARKING") reviewHasParkingIssue = true;
      const weighted = severity * ratingWeight(review.rating) * recencyWeight(review.time, nowMs);
      categoryScores.set(category, (categoryScores.get(category) ?? 0) + weighted);
      evidence.push({ category, severity, rating: review.rating ?? null, excerpt: text.slice(0, 240) });
    }
    if (reviewHasIssue) issueReviewCount++;
    if (reviewHasParkingIssue) parkingReviewCount++;
  }

  const ranked = [...categoryScores.entries()].sort((a, b) => b[1] - a[1]);
  const recurrenceBonus = Math.max(0, issueReviewCount - 1) * 7;
  const breadthBonus = Math.max(0, ranked.length - 1) * 4;
  const score = Math.min(100, Math.round(ranked.reduce((sum, [, value]) => sum + value * 5, 0) + recurrenceBonus + breadthBonus));
  const priority: ReviewPriority = score >= 70 && issueReviewCount >= 2
    ? "P1_CRITICAL"
    : score >= 45
      ? "P2_HIGH"
      : score >= 20
        ? "P3_MEDIUM"
        : "P4_LOW";
  const categories = ranked.map(([category]) => category);
  const summary = categories.length
    ? `${priority}: ${issueReviewCount}/${usable.length} review(s) mention ${categories.slice(0, 3).join(", ").toLowerCase().replace(/_/g, " ")}`
    : null;

  return { score, priority, categories, summary, evidence: evidence.sort((a, b) => b.severity - a.severity).slice(0, 5), reviewsAnalyzed: usable.length, issueReviewCount, parkingReviewCount };
}
