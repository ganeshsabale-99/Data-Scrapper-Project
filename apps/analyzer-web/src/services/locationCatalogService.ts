import { axiosInstance } from "@/config/axios";
import { getAuthToken } from "@/lib/token";

export interface LocationCatalogData {
  states: string[];
  citiesByState: Record<string, string[]>;
}

export interface LocationCatalogResponse {
  success: boolean;
  data: LocationCatalogData;
}

const CUSTOM_LOCATION_STORAGE_KEY = "custom_location_catalog_v1";

const STATIC_FALLBACK_CITIES_BY_STATE: Record<string, string[]> = {
  "Andhra Pradesh": ["Visakhapatnam", "Vijayawada"],
  "Bihar": ["Patna"],
  "Chandigarh": ["Chandigarh"],
  "Delhi": ["New Delhi"],
  "Gujarat": ["Ahmedabad", "Surat", "Vadodara"],
  "Haryana": ["Gurugram", "Faridabad"],
  "Karnataka": ["Bengaluru", "Mysuru", "Hubballi"],
  "Kerala": ["Kochi", "Thiruvananthapuram"],
  "Madhya Pradesh": ["Indore", "Bhopal"],
  "Maharashtra": ["Pune", "Mumbai", "Nagpur", "Nashik"],
  "Odisha": ["Bhubaneswar"],
  "Punjab": ["Ludhiana", "Mohali"],
  "Rajasthan": ["Jaipur", "Udaipur"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai"],
  "Telangana": ["Hyderabad", "Warangal"],
  "Uttar Pradesh": ["Noida", "Lucknow", "Kanpur"],
  "West Bengal": ["Kolkata"],
};

type StateRow = { state?: string; count?: number };
type CityRow = { city?: string };

const normalize = (value: string) => value.trim().toLowerCase();

const safeParseCustomLocations = (): Array<{ state: string; city: string }> => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_LOCATION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        state: String(item?.state || "").trim(),
        city: String(item?.city || "").trim(),
      }))
      .filter((item) => item.state.length > 0 && item.city.length > 0);
  } catch {
    return [];
  }
};

const saveCustomLocations = (items: Array<{ state: string; city: string }>) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOM_LOCATION_STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    if (import.meta.env.DEV) {
      console.debug("[locationCatalog] localStorage write skipped", error);
    }
  }
};

export const addCustomLocationOption = (stateRaw?: string | null, cityRaw?: string | null) => {
  const state = String(stateRaw || "").trim();
  const city = String(cityRaw || "").trim();
  if (!state || !city) return;

  const existing = safeParseCustomLocations();
  const exists = existing.some(
    (item) => normalize(item.state) === normalize(state) && normalize(item.city) === normalize(city),
  );
  if (exists) return;

  saveCustomLocations([...existing, { state, city }]);
};

export const getCustomLocationCatalog = (): LocationCatalogData => {
  const customLocations = safeParseCustomLocations();
  if (customLocations.length === 0) {
    return { states: [], citiesByState: {} };
  }

  const grouped = collectCitiesByState(customLocations);
  return grouped;
};

const collectCitiesByState = (rows: Array<{ state: string; city: string }>) => {
  const buckets = new Map<string, { state: string; cities: Map<string, string> }>();

  for (const row of rows) {
    const state = row.state.trim();
    const city = row.city.trim();
    if (!state || !city) continue;

    const stateKey = normalize(state);
    const cityKey = normalize(city);
    const bucket = buckets.get(stateKey) ?? { state, cities: new Map<string, string>() };
    if (!bucket.cities.has(cityKey)) {
      bucket.cities.set(cityKey, city);
    }
    buckets.set(stateKey, bucket);
  }

  const states = Array.from(buckets.values())
    .map((x) => x.state)
    .sort((a, b) => a.localeCompare(b));

  const citiesByState: Record<string, string[]> = {};
  for (const state of states) {
    const bucket = buckets.get(normalize(state));
    citiesByState[state] = Array.from(bucket?.cities.values() ?? []).sort((a, b) =>
      a.localeCompare(b),
    );
  }

  return { states, citiesByState };
};

const getResponseStatus = (error: unknown): number => {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return 0;
  }
  const response = (error as { response?: unknown }).response;
  if (typeof response !== "object" || response === null || !("status" in response)) {
    return 0;
  }
  const status = (response as { status?: unknown }).status;
  return typeof status === "number" ? status : 0;
};

const mergeCatalogWithCustomLocations = (
  catalog: LocationCatalogResponse,
): LocationCatalogResponse => {
  const customLocations = safeParseCustomLocations();
  if (customLocations.length === 0) return catalog;

  const baseStates = [...(catalog.data.states || [])];
  const citiesByState: Record<string, string[]> = { ...(catalog.data.citiesByState || {}) };

  for (const item of customLocations) {
    if (!baseStates.includes(item.state)) {
      baseStates.push(item.state);
    }

    const cityList = citiesByState[item.state] ? [...citiesByState[item.state]] : [];
    const hasCity = cityList.some((city) => normalize(city) === normalize(item.city));
    if (!hasCity) {
      cityList.push(item.city);
      cityList.sort((a, b) => a.localeCompare(b));
    }
    citiesByState[item.state] = cityList;
  }

  return {
    success: true,
    data: {
      states: baseStates,
      citiesByState,
    },
  };
};

const getStaticFallbackCatalog = (): LocationCatalogResponse => ({
  success: true,
  data: {
    states: Object.keys(STATIC_FALLBACK_CITIES_BY_STATE).sort((a, b) =>
      a.localeCompare(b),
    ),
    citiesByState: STATIC_FALLBACK_CITIES_BY_STATE,
  },
});

const getStateWiseCities = async (basePath: "/new-techparks" | "/coworking-spaces", state: string) => {
  const response = await axiosInstance.get(`${basePath}/state-wise-overview/${encodeURIComponent(state)}`);
  const cityData = Array.isArray(response.data?.cityData)
    ? (response.data.cityData as CityRow[])
    : [];
  return cityData
    .map((x) => ({ state, city: String(x.city || "").trim() }))
    .filter((x) => x.city.length > 0 && x.city.toLowerCase() !== "unknown");
};

const buildFallbackLocationCatalog = async (): Promise<LocationCatalogResponse> => {
  const statesWithData = new Set<string>();

  const [techOverview, coworkingOverview] = await Promise.allSettled([
    axiosInstance.get("/new-techparks/overview"),
    axiosInstance.get("/coworking-spaces/overview"),
  ]);

  const extractStates = (result: PromiseSettledResult<unknown>) => {
    if (result.status !== "fulfilled") return;
    const value = result.value as { data?: { stateData?: unknown } };
    const rows = Array.isArray(value?.data?.stateData)
      ? (value.data.stateData as StateRow[])
      : [];
    for (const row of rows) {
      const state = String(row.state || "").trim();
      const count = Number(row.count || 0);
      if (!state || count <= 0 || state.toLowerCase() === "unknown") continue;
      statesWithData.add(state);
    }
  };

  extractStates(techOverview);
  extractStates(coworkingOverview);

  const states = Array.from(statesWithData);
  const results = await Promise.allSettled(
    states.flatMap((state) => [
      getStateWiseCities("/new-techparks", state),
      getStateWiseCities("/coworking-spaces", state),
    ]),
  );

  const rows: Array<{ state: string; city: string }> = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      rows.push(...result.value);
    }
  }

  if (rows.length === 0) {
    return getStaticFallbackCatalog();
  }

  const data = collectCitiesByState(rows);
  return { success: true, data };
};

export const locationCatalogService = {
  async getOptions(): Promise<LocationCatalogResponse> {
    try {
      const response = await axiosInstance.get<LocationCatalogResponse>(
        "/auth/city-catalog/options",
      );
      return mergeCatalogWithCustomLocations(response.data);
    } catch (error: unknown) {
      const status = getResponseStatus(error);
      if (status === 503) {
        // Database outage: keep signup usable with static city suggestions.
        return mergeCatalogWithCustomLocations(getStaticFallbackCatalog());
      }

      if (status === 404) {
        let hasAuthToken = false;
        try {
          hasAuthToken = Boolean(getAuthToken());
        } catch {
          hasAuthToken = false;
        }

        if (!hasAuthToken) {
          return mergeCatalogWithCustomLocations(getStaticFallbackCatalog());
        }

        try {
          return mergeCatalogWithCustomLocations(await buildFallbackLocationCatalog());
        } catch {
          return mergeCatalogWithCustomLocations(getStaticFallbackCatalog());
        }
      }
      throw error;
    }
  },
};
