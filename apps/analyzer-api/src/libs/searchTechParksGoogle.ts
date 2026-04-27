import axios from "axios";

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



export interface PlaceResultGoogle {
  name: string;
  address: string | null;
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

export async function searchTechParksGoogle(
  locationQuery: string
): Promise<PlaceResultGoogle[]> {
  const geoResp = await axios.get(
    "https://maps.googleapis.com/maps/api/geocode/json",
    {
      params: { address: locationQuery, key: API_KEY },
    }
  );
  const geoData = geoResp.data.results?.[0];
  if (!geoData) throw new Error("Invalid location. Coordinates not found.");
  const { lat, lng } = geoData.geometry.location;

  const allPlacesMap = new Map<string, any>();

  for (const keyword of TECH_PARK_KEYWORDS) {
    let nextPageToken: string | null = null;

    do {
      const params: Record<string, any> = {
        key: API_KEY,
        location: `${lat},${lng}`,
        radius: 10000,
        keyword,
        type: "point_of_interest",
      };
      if (nextPageToken) {
        params.pagetoken = nextPageToken;
        await new Promise((r) => setTimeout(r, 2000));
      }

      const placesResp = await axios.get(
        "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
        { params }
      );

      for (const place of placesResp.data.results) {
        if (!allPlacesMap.has(place.place_id)) {
          allPlacesMap.set(place.place_id, place);
        }
      }

      nextPageToken = placesResp.data.next_page_token || null;
    } while (nextPageToken && allPlacesMap.size < 100);
  }

  const enrichedResultsRaw: (PlaceResultGoogle | null)[] = await Promise.all(
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

        return {
          name: details.name,
          address: details.formatted_address || null,
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
      } catch {
        return null;
      }
    })
  );

  return enrichedResultsRaw.filter((res): res is PlaceResultGoogle => !!res);
}
