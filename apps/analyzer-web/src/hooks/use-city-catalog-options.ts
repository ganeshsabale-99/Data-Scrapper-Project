import { useQuery } from "@tanstack/react-query";
import {
  getCustomLocationCatalog,
  locationCatalogService,
} from "@/services/locationCatalogService";
import { INDIA_STATES_AND_UTS } from "@/components/dashboard/constants";

const EMPTY_CATALOG = {
  states: [...INDIA_STATES_AND_UTS] as string[],
  citiesByState: INDIA_STATES_AND_UTS.reduce<Record<string, string[]>>(
    (acc, state) => {
      acc[state] = [];
      return acc;
    },
    {},
  ),
  allCities: [] as string[],
};

export function useCityCatalogOptions() {
  const query = useQuery({
    queryKey: ["city-catalog", "options"],
    queryFn: () => locationCatalogService.getOptions(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const apiCatalog = query.data?.data;
  const customCatalog = getCustomLocationCatalog();
  const baseStates = [...INDIA_STATES_AND_UTS];
  const canonicalStateSet = new Set<string>(baseStates);
  const apiCitiesByState = apiCatalog?.citiesByState ?? {};
  const apiStateKeys = new Set<string>([
    ...(apiCatalog?.states ?? []),
    ...Object.keys(apiCitiesByState),
    ...(customCatalog.states ?? []),
    ...Object.keys(customCatalog.citiesByState ?? {}),
  ]);
  const extraStates = [...apiStateKeys]
    .filter((state) => !canonicalStateSet.has(state))
    .sort((a, b) => a.localeCompare(b));
  const states = [...baseStates, ...extraStates];

  const citiesByState = states.reduce<Record<string, string[]>>((acc, state) => {
    const merged = new Map<string, string>();
    for (const city of apiCitiesByState[state] ?? []) {
      const trimmed = city.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (!merged.has(key)) merged.set(key, trimmed);
    }
    for (const city of customCatalog.citiesByState[state] ?? []) {
      const trimmed = city.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (!merged.has(key)) merged.set(key, trimmed);
    }
    acc[state] = Array.from(merged.values()).sort((a, b) => a.localeCompare(b));
    return acc;
  }, {});
  const allCities = Array.from(
    new Set(
      Object.values(citiesByState)
        .flat()
        .map((city) => city.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));

  return {
    ...query,
    catalog:
      query.data?.success && query.data.data
        ? { states, citiesByState, allCities }
        : EMPTY_CATALOG,
  };
}
