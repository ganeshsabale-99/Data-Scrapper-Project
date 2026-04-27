import { prismaInstance } from "@repo/db";
import { INDIA_STATES_AND_UTS } from "./indiaStates";
import { normalizeCity, getCityAliasMap } from "./cityNormalization";

export const normalizeStateName = (stateRaw: string): string => {
  const trimmed = stateRaw.trim();
  const match = INDIA_STATES_AND_UTS.find(
    (state) => state.toLowerCase() === trimmed.toLowerCase(),
  );
  return match || trimmed;
};

export const upsertCityCatalogEntry = async (
  stateRaw?: string | null,
  cityRaw?: string | null,
): Promise<{ state: string; city: string } | null> => {
  const stateTrimmed = (stateRaw || "").trim();
  const cityTrimmed = (cityRaw || "").trim();

  if (!stateTrimmed || !cityTrimmed) {
    return null;
  }

  const state = normalizeStateName(stateTrimmed);
  const aliasMap = await getCityAliasMap();
  const city = normalizeCity(cityTrimmed, aliasMap);

  await prismaInstance.cityCatalog.upsert({
    where: {
      state_city_unique: {
        state,
        city,
      },
    },
    update: {
      is_active: true,
    },
    create: {
      state,
      city,
      is_active: true,
    },
  });

  return { state, city };
};
