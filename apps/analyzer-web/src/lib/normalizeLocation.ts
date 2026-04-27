type RawLocation = {
  id: string;
  name: string;
  address: string;
  website: string;
  rating: number;
  total_ratings: number;
  business_status: string;
  phone?: string;
  internationalPhone?: string;
  opening_hours?: string[];
  map_url: string;
  status?: string;
};

type NormalizedLocation = {
  id: string;
  name: string;
  address: string;
  website: string;
  rating: number;
  total_ratings: number;
  business_status: string;
  phone: string;
  map_url: string;
  opening_hours: string;
  status: string;
};

export function normalizeLocationData(
  data: RawLocation[]
): NormalizedLocation[] {
  return data.map((item) => ({
    id: item.id,
    name: item.name,
    address: item.address,
    website: item.website,
    rating: item.rating,
    total_ratings: item.total_ratings,
    business_status: item.business_status || "UNKNOWN",
    phone: item.internationalPhone || item.phone || "N/A",
    map_url: item.map_url,
    opening_hours: item.opening_hours
      ? item.opening_hours.join(", ")
      : "No Info",
    status: item.status || "Not Contacted",
  }));
}
