import { prismaInstance } from "@repo/db";

// ─── In-memory cache ──────────────────────────────────────────────────────────
// alias (lowercase) → canonicalCity
let cache: Map<string, string> | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getCityAliasMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (cache && now < cacheExpiresAt) return cache;

  const rows = await prismaInstance.cityAlias.findMany({
    where: { isActive: true },
    select: { alias: true, canonicalCity: true },
  });

  const map = new Map<string, string>();
  for (const { alias, canonicalCity } of rows) {
    map.set(alias.toLowerCase(), canonicalCity);
  }

  cache = map;
  cacheExpiresAt = now + CACHE_TTL_MS;
  return map;
}

export function invalidateCityAliasCache(): void {
  cache = null;
  cacheExpiresAt = 0;
}

// ─── Sync normalizer (call after awaiting getCityAliasMap) ───────────────────

/**
 * Returns the canonical, correctly-cased city name.
 *
 * Resolution order:
 *  1. Explicit alias from DB map (case-insensitive).
 *  2. Substring match — raw name contains a canonical city name but is not itself
 *     canonical (handles "KharadiPune" → "Pune", "Bangalore Division" → "Bengaluru").
 *  3. Fallback: return trimmed original unchanged.
 */
export function normalizeCity(
  cityRaw: string,
  aliasMap: Map<string, string>,
): string {
  const trimmed = cityRaw.trim();
  if (!trimmed) return trimmed;

  const lower = trimmed.toLowerCase();

  // 1. Explicit alias lookup
  const mapped = aliasMap.get(lower);
  if (mapped) return mapped;

  // 2. Substring match — sort canonical cities longest-first so "Navi Mumbai"
  //    is tested before "Mumbai"
  const canonicals = [...new Set(aliasMap.values())].sort(
    (a, b) => b.length - a.length,
  );
  for (const canonical of canonicals) {
    if (lower.includes(canonical.toLowerCase())) {
      return canonical;
    }
  }

  return trimmed;
}
