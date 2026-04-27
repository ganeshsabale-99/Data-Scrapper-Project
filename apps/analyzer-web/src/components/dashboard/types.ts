export type Segment = "techParks" | "coworkingSpaces";

export type CurrentView = "states" | "state-details" | "city-details";

export interface DashboardStats {
  total: number;
  contacted: number;
  responseRate: number;
  positive: number;
}

export interface ChartDistribution {
  labels: string[];
  values: number[];
}

export interface CityRow {
  city: string;
  techParks: number;
}

export interface StateRow {
  state: string;
  techParks: number;
}

export interface LocationData {
  id: string;
  name: string;
  address: string;
  website: string;
  operator?: string;
  description?: string;
  rating: number;
  total_ratings?: number;
  business_status: string;
  phone: string;
  map_url: string;
  opening_hours: string;
  locationLat?: string;
  locationLng?: string;
  lat?: number;
  lng?: number;
  status: string;
}

export interface NewLocationData {
  id: string;
  name: string;
  address: string;
  website: string;
  operator: string;
  description: string;
  rating: number;
  total_ratings: number;
  business_status: string;
  phone: string;
  map_url: string;
  opening_hours: string;
  locationLat: string;
  locationLng: string;
  lat: number | null;
  lng: number | null;
  status: string;

  builder_name: string;
  security_agency_name: string;
  property_manager_name: string;
  property_manager_phone: string;
  property_manager_email: string;
  parking_floors: number;
  total_floors: number;
  basement_levels: number;
  spoc_name: string;
  spoc_phone: string;
  seating_capacity: number;
  challenges: string;
  coordinates?: string;
  exterior_media_url?: string;
  exterior_media_urls?: string[];

  // Missing fields for completeness
  generic_email?: string;
  operator_name?: string;
  campus_brand?: string;
  legal_entity?: string;
  campus_size_hint?: string;
  district?: string;
  pincode?: string;
  country?: string;
}

export interface BreadcrumbItem {
  label: string;
  path: string;
  active: boolean;
}

export interface TabItem {
  key: Segment;
  label: string;
}

export interface PaginationInfo {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
} 
