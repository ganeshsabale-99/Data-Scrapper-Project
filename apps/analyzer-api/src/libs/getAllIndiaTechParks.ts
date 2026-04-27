import dotenv from "dotenv";
import { prismaInstance } from "@repo/db";
import { logOperationalEvent } from "./serviceHealthLogger";
import axios from "axios";


dotenv.config({ path: './src/.env' });

const API_KEY = process.env.GOOGLE_API_KEY!;

const TECH_PARK_KEYWORDS = [
  "tech park",
  "IT park",
  "SEZ",
  "software park",
  "business park",
  "IT hub",
  "technology park",
  "IT campus",
  "cyber park",
  "info park",
  "ITPL",
  "tech city",
];

export interface TechParkWithLocation {
  name: string;
  address: string | null;
  city: string;
  state: string;
  location: { lat: number; lng: number };
  place_id: string;
  website: string | null;
  description: string | null;
  operator: string | null;
  rating?: number | null;
  total_ratings?: number | null;
  types?: string[];
  business_status?: string | null;
  plus_code?: string | null;
  opening_hours?: string[];
  map_url?: string | null;
  photo_reference?: string | null;
  contact: {
    phone: string | null;
    international_phone?: string | null;
    email: string | null;
  };
}

function extractCityAndState(address: string | null): { city: string; state: string } {
  if (!address) {
    return { city: "Unknown", state: "Unknown" };
  }

  const addressParts = address.split(',').map(part => part.trim());
  
  let state = "Unknown";
  let city = "Unknown";
  
  const statePatterns = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Delhi", "Chandigarh", "Puducherry", "Andaman and Nicobar Islands",
    "Lakshadweep", "Dadra and Nagar Haveli", "Daman and Diu"
  ];

  for (let i = addressParts.length - 1; i >= 0; i--) {
    const part = addressParts[i];
    if (part && statePatterns.some(statePattern => 
      part.toLowerCase().includes(statePattern.toLowerCase())
    )) {
      state = part;
      if (i > 0) {
        city = addressParts[i - 1] || "Unknown";
      }
      break;
    }
  }

  if (state === "Unknown" && addressParts.length >= 2) {
    city = addressParts[addressParts.length - 2] || "Unknown";
    state = addressParts[addressParts.length - 1] || "Unknown";
  }

  return { city, state };
}


export async function getAllIndiaTechParks(): Promise<TechParkWithLocation[]> {
  const allPlacesMap = new Map<string, any>();

  logOperationalEvent("techpark.search.started", { scope: "india" });

  logOperationalEvent("techpark.search.strategy", { strategy: 1, method: "Text Search API" });
  for (const keyword of TECH_PARK_KEYWORDS) {
    console.log(`  Searching for keyword: "${keyword}"`);
    
    try {
      const textSearchResp = await axios.get(
        "https://maps.googleapis.com/maps/api/place/textsearch/json",
        {
          params: {
            key: API_KEY,
            query: `${keyword} India`,
          }
        }
      );

      console.log(`    Found ${textSearchResp.data.results?.length || 0} results for "${keyword}"`);
      
      if (textSearchResp.data.results) {
        for (const place of textSearchResp.data.results) {
          if (!allPlacesMap.has(place.place_id)) {
            allPlacesMap.set(place.place_id, place);
          }
        }
      }
    } catch (error) {
      console.error(`Error in text search for keyword "${keyword}":`, error);
    }
  }
  
  logOperationalEvent("techpark.search.results", { totalUniqueFound: allPlacesMap.size });

  const enrichedResultsRaw: (TechParkWithLocation | null)[] = await Promise.all(
    Array.from(allPlacesMap.values()).map(async (place: any) => {
      try {
        const detailsResp = await axios.get(
          "https://maps.googleapis.com/maps/api/place/details/json",
          {
            params: {
              key: API_KEY,
              place_id: place.place_id,
              fields: [
                "name",
                "formatted_address",
                "geometry",
                "website",
                "formatted_phone_number",
                "international_phone_number",
                "opening_hours",
                "rating",
                "user_ratings_total",
                "types",
                "business_status",
                "plus_code",
                "url",
                "photos",
              ].join(","),
            },
          }
        );

        const details = detailsResp.data.result;
        if (!details) {
          return null;
        }
        
        const { city, state } = extractCityAndState(details.formatted_address);

        return {
          name: details.name,
          address: details.formatted_address || null,
          city,
          state,
          location: {
            lat: details.geometry?.location.lat,
            lng: details.geometry?.location.lng,
          },
          place_id: details.place_id,
          website: details.website || null,
          description: null,
          operator: null,
          rating: details.rating ?? null,
          total_ratings: details.user_ratings_total ?? null,
          types: details.types ?? [],
          business_status: details.business_status ?? null,
          plus_code: details.plus_code?.global_code ?? null,
          opening_hours: details.opening_hours?.weekday_text ?? [],
          map_url: details.url || null,
          photo_reference: details.photos?.[0]?.photo_reference ?? null,
          contact: {
            phone: details.formatted_phone_number ?? null,
            international_phone: details.international_phone_number ?? null,
            email: null,
          },
        };
      } catch (error) {
        console.error(`Error enriching place ${place.place_id}:`, error);
        return null;
      }
    })
  );

  const results = enrichedResultsRaw.filter((res): res is TechParkWithLocation => !!res);
  
  console.log(`Successfully processed ${results.length} tech parks across India`);
  
  const stateSummary = results.reduce((acc, techPark) => {
    const state = techPark.state;
    if (!acc[state]) {
      acc[state] = 0;
    }
    acc[state]++;
    return acc;
  }, {} as Record<string, number>);

  console.log("Tech parks by state:", stateSummary);

  return results;
}
