import { prismaInstance } from "@repo/db";
import { INDIA_STATES_AND_UTS } from "./indiaStates";
import { logOperationalEvent } from "../libs/serviceHealthLogger";

// ─── Test / placeholder record detection ─────────────────────────────────────
// A handful of scrape runs (and manual testing against the scraper) have left
// behind placeholder rows like a `test_park_...` Place ID with no location
// data at all. These are not real leads and must never reach an export.
const TEST_PLACE_ID_PATTERN = /^(test|placeholder|dummy|sample|fixture)[_-]/i;

export function isTestPlaceId(placeId: string | null | undefined): boolean {
  if (!placeId) return false;
  return TEST_PLACE_ID_PATTERN.test(placeId.trim());
}

export interface PlaceholderCheckInput {
  placeId: string | null | undefined;
  lat: number | null | undefined;
  lng: number | null | undefined;
  address: string | null | undefined;
}

/**
 * True when a record is either flagged by its Place ID as test/placeholder
 * data, or is missing Latitude, Longitude, AND Address together — a
 * combination that only ever occurs for junk/placeholder rows, never a real
 * Google Places result.
 */
export function isPlaceholderVenue(input: PlaceholderCheckInput): boolean {
  if (isTestPlaceId(input.placeId)) return true;
  const hasLat = input.lat !== null && input.lat !== undefined;
  const hasLng = input.lng !== null && input.lng !== undefined;
  const hasAddress = Boolean(input.address && input.address.trim());
  return !hasLat && !hasLng && !hasAddress;
}

// ─── City-from-address fallback ──────────────────────────────────────────────
const STATE_NAMES_LOWER = new Set(INDIA_STATES_AND_UTS.map((s) => s.toLowerCase()));

/**
 * Parses City out of a formatted address string as a fallback for when the
 * source API/scrape doesn't return City directly. City is taken as the text
 * segment immediately before the (optional) State name + 6-digit pincode,
 * e.g. "...Rajbagh, Srinagar, 190008" -> "Srinagar", or
 * "...Gachibowli, Hyderabad, Telangana 500032" -> "Hyderabad".
 */
export function extractCityFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  // Google's formatted_address commonly appends ", India" (or just "India")
  // after the pincode — strip it so the pincode still anchors to the end.
  const withoutCountrySuffix = address.replace(/[,\s]*india\.?\s*$/i, "").trim();
  const pincodeMatch = withoutCountrySuffix.match(/(\d{6})\s*$/);
  if (!pincodeMatch || pincodeMatch.index === undefined) return null;

  const beforePincode = withoutCountrySuffix
    .slice(0, pincodeMatch.index)
    .trim()
    .replace(/[,\-]+$/, "")
    .trim();
  if (!beforePincode) return null;

  const segments = beforePincode
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return null;

  const last = segments[segments.length - 1]!;
  const isLastSegmentAState = STATE_NAMES_LOWER.has(last.toLowerCase());

  const city = isLastSegmentAState && segments.length >= 2 ? segments[segments.length - 2] : last;
  return city || null;
}

export interface CityResolutionResult {
  city: string | null;
  source: "api" | "address_fallback" | "unresolved";
}

/**
 * Resolves City with a fallback chain: value already returned by the
 * source API/scrape -> parsed out of the formatted address -> unresolved.
 * Callers must never write a record when the result is "unresolved" — log it
 * to the review queue instead.
 */
export function resolveVenueCity(
  apiCity: string | null | undefined,
  address: string | null | undefined,
): CityResolutionResult {
  const trimmedApiCity = apiCity?.trim();
  if (trimmedApiCity) return { city: trimmedApiCity, source: "api" };

  const fallback = extractCityFromAddress(address);
  if (fallback) return { city: fallback, source: "address_fallback" };

  return { city: null, source: "unresolved" };
}

// ─── Parking-problem priority ─────────────────────────────────────────────────
// A plain HIGH/MEDIUM/LOW string sorts alphabetically (HIGH, LOW, MEDIUM) —
// not by severity — so a numeric rank is stored alongside it for the sales
// team to sort/filter venues by how bad their parking problem is.
const PARKING_SCORE_RANK: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

export function parkingScoreToPriority(parkingScore: string | null | undefined): number {
  if (!parkingScore) return 0;
  return PARKING_SCORE_RANK[parkingScore.trim().toUpperCase()] ?? 0;
}

// ─── Closed / inactive listings ───────────────────────────────────────────────
export const CLOSED_BUSINESS_STATUSES = new Set(["CLOSED_PERMANENTLY", "CLOSED_TEMPORARILY"]);

export function isClosedBusinessStatus(businessStatus: string | null | undefined): boolean {
  if (!businessStatus) return false;
  return CLOSED_BUSINESS_STATUSES.has(businessStatus.trim().toUpperCase());
}

// ─── Duplicate detection ──────────────────────────────────────────────────────
/**
 * Normalized Name + City key used for de-dupe: lowercase, trimmed,
 * punctuation-stripped, whitespace-collapsed. Records sharing this key within
 * the same venue-type table are possible duplicates (e.g. multiple
 * "BDA Shopping Complex" entries).
 */
export function buildDedupeKey(name: string | null | undefined, city: string | null | undefined): string | null {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .replace(/\s+/g, " ")
      .trim();

  const normalizedName = name ? normalize(name) : "";
  if (!normalizedName) return null;
  const normalizedCity = city ? normalize(city) : "";
  return `${normalizedName}|${normalizedCity}`;
}

interface DedupeCapableModel {
  count: (args: any) => Promise<number>;
  updateMany: (args: any) => Promise<{ count: number }>;
}

/**
 * After an upsert, checks whether any other row in the same table shares this
 * record's dedupe key and, if so, flags every row sharing that key as a
 * possible duplicate. Returns whether a duplicate was found.
 */
export async function flagPossibleDuplicatesByKey(
  model: DedupeCapableModel,
  dedupeKey: string | null,
): Promise<boolean> {
  if (!dedupeKey) return false;
  const matchCount = await model.count({ where: { dedupe_key: dedupeKey } });
  if (matchCount > 1) {
    await model.updateMany({
      where: { dedupe_key: dedupeKey },
      data: { is_possible_duplicate: true },
    });
    return true;
  }
  return false;
}

// ─── Review queue ─────────────────────────────────────────────────────────────
/**
 * Records a venue the scraper could not safely write (most commonly: City
 * could not be resolved even after the Address fallback) so a human can fix
 * it instead of an incomplete row silently landing in an export.
 */
export async function logToReviewQueue(
  venueType: string,
  placeId: string | null | undefined,
  name: string | null | undefined,
  reason: string,
  rawData?: unknown,
): Promise<void> {
  try {
    await prismaInstance.scrapeReviewQueue.create({
      data: {
        venueType,
        placeId: placeId ?? null,
        name: name ?? null,
        reason,
        rawData: rawData === undefined ? undefined : (rawData as any),
      },
    });
  } catch (error) {
    logOperationalEvent(
      "scraper.reviewQueue.write_failed",
      { venueType, placeId, reason, error: error instanceof Error ? error.message : String(error) },
      "warn",
    );
  }
}

// ─── Contact-Status-gated outreach fields ────────────────────────────────────
// SPOC Name/Phone/Email/Challenges are outreach-sourced (from real sales
// calls), never scrape-sourced, so they should not be set while a record is
// still NOT_CONTACTED — that would make manually-entered data indistinguishable
// from a real, contacted lead.
export const OUTREACH_ONLY_FIELDS = ["spoc_name", "spoc_phone", "spoc_email", "challenges"] as const;

export function findOutreachFieldsBlockedByContactStatus(
  updateData: Record<string, unknown>,
  effectiveStatus: string | null | undefined,
): string[] {
  if (effectiveStatus && effectiveStatus !== "NOT_CONTACTED") return [];
  return OUTREACH_ONLY_FIELDS.filter((field) => {
    if (!Object.prototype.hasOwnProperty.call(updateData, field)) return false;
    const value = updateData[field];
    return value !== null && value !== undefined && value !== "";
  });
}
