import { CITY_TO_STATE_MAP, INDIA_STATES_AND_UTS, getSegmentLabel } from "./constants";
import type { CurrentView } from "./types";
import { getUserCity, getUserState } from "@/lib/token";

export function inferStateFromCity(city?: string): string | undefined {
  if (!city) return undefined;
  const key = city.trim().toLowerCase();
  return CITY_TO_STATE_MAP[key];
}

function normalizeParam(value?: string | null): string | undefined {
  if (!value) return undefined;

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Keep original value when decode fails.
  }

  const normalized = decoded.trim();
  if (!normalized) return undefined;

  const lower = normalized.toLowerCase();
  if (lower === "undefined" || lower === "null") return undefined;
  return normalized;
}

const KNOWN_STATE_SET = new Set(
  INDIA_STATES_AND_UTS.map((state) => state.toLowerCase()),
);

function isKnownState(value?: string): boolean {
  if (!value) return false;
  return KNOWN_STATE_SET.has(value.trim().toLowerCase());
}

function isLegacyCityOnlyRoute(
  stateParam: string | undefined,
  cityParam: string | undefined,
  pathname: string,
): boolean {
  if (!pathname.includes("/dashboard/city")) return false;
  if (!stateParam || cityParam) return false;

  const userCity = normalizeParam(getUserCity());
  if (userCity && userCity.toLowerCase() === stateParam.toLowerCase()) {
    return true;
  }

  return !isKnownState(stateParam);
}

export function determineCurrentView(
  params: { state?: string; city?: string },
  pathname: string
): CurrentView {
  const stateParam = normalizeParam(params.state);
  const cityParam = normalizeParam(params.city);
  const userState = normalizeParam(getUserState());
  const userCity = normalizeParam(getUserCity());

  if (stateParam && cityParam) return "city-details";
  if (isLegacyCityOnlyRoute(stateParam, cityParam, pathname)) return "city-details";
  if (stateParam) return "state-details";
  if (pathname.includes('/dashboard/state')) {
    if (userState) return "state-details";
    return "states";
  }
  if (pathname.includes('/dashboard/city')) {
    if (userCity) return "city-details";
    if (userState) return "state-details";
    return "states";
  }
  return "states";
}

export function getSelectedStateForCityView(
  params: { state?: string; city?: string },
  pathname: string
): string | undefined {
  const stateParam = normalizeParam(params.state);
  const cityParam = normalizeParam(params.city);
  const userState = normalizeParam(getUserState());
  const userCity = normalizeParam(getUserCity());

  if (stateParam && cityParam) return stateParam;
  if (pathname.includes('/dashboard/state')) {
    return stateParam || userState || undefined;
  }
  if (pathname.includes('/dashboard/city')) {
    if (isLegacyCityOnlyRoute(stateParam, cityParam, pathname)) {
      const inferred = inferStateFromCity(stateParam);
      return inferred || userState || undefined;
    }

    if (stateParam) return stateParam;

    const inferred = inferStateFromCity(cityParam || userCity);
    return userState || inferred || undefined;
  }
  return stateParam || undefined;
}

export function getSelectedCityForDetailView(
  params: { state?: string; city?: string },
  pathname: string
): string | undefined {
  const stateParam = normalizeParam(params.state);
  const cityParam = normalizeParam(params.city);

  if (cityParam) return cityParam;

  if (!pathname.includes('/dashboard/city')) return undefined;

  if (isLegacyCityOnlyRoute(stateParam, cityParam, pathname)) {
    return stateParam;
  }

  if (stateParam && !cityParam) return undefined;

  return normalizeParam(getUserCity()) || undefined;
}

export function getBasePath(pathname: string): string {
  if (pathname.includes('/dashboard/national')) return '/dashboard/national';
  if (pathname.includes('/dashboard/state')) return '/dashboard/state';
  if (pathname.includes('/dashboard/city')) return '/dashboard/city';
  return '/dashboard/mock-techparks';
}

export function withTabParam(path: string, segment: string): string {
  return `${path}?tab=${encodeURIComponent(segment)}`;
}

export function getPageTitle(pathname: string, segment: string): string {
  const type = getSegmentLabel(segment);
  if (pathname.includes('/dashboard/national')) {
    return `National ${type} Overview`;
  } else if (pathname.includes('/dashboard/state')) {
    return `State ${type} Overview`;
  } else if (pathname.includes('/dashboard/city')) {
    return `City ${type} Overview`;
  } else {
    return `Mock ${type} Demo`;
  }
}

export function getTabLabel(pathname: string, segment: string): string {
  const type = getSegmentLabel(segment);
  if (pathname.includes('/dashboard/national')) return `National ${type} Overview`;
  if (pathname.includes('/dashboard/state')) return `State ${type} Overview`;
  if (pathname.includes('/dashboard/city')) return `City ${type} Overview`;
  return `${type} Demo`;
}
