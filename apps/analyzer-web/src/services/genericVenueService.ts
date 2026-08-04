import { axiosInstance } from "@/config/axios";

export type VenueSegment = "malls" | "hospitals" | "stadiums" | "airports";

export interface VenueOverviewData {
  success: boolean;
  total: number;
  contacted: number;
  positiveResponses: number;
  responseRate: number;
  stateData: Array<{ state: string; count: number }>;
}

export interface VenueStateWiseData {
  success: boolean;
  state: string;
  total: number;
  contacted: number;
  positiveResponses: number;
  responseRate: number;
  cityData: Array<{ city: string; count: number }>;
  statusBreakdown: Record<string, number>;
}

export interface VenueCityWiseItem {
  id: string;
  name: string;
  address: string | null;
  reception_phone: string | null;
  website: string | null;
  status: string;
  rating: number | null;
  map_url: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
  spoc_name: string | null;
  spoc_phone: string | null;
  challenges: string | null;
  lat: number | null;
  lng: number | null;
}

export interface VenueCityWiseData {
  success: boolean;
  state: string;
  city: string;
  total: number;
  contacted: number;
  positiveResponses: number;
  responseRate: number;
  statusBreakdown: Record<string, number>;
  items: VenueCityWiseItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

function createVenueService(path: string) {
  return {
    async getOverviewData(): Promise<VenueOverviewData> {
      const res = await axiosInstance.get(`/${path}/overview`);
      return res.data;
    },

    async getStateWiseOverview(state: string): Promise<VenueStateWiseData> {
      const res = await axiosInstance.get(`/${path}/state-wise-overview/${encodeURIComponent(state)}`);
      return res.data;
    },

    async getCityWiseOverview(
      state: string,
      city: string,
      page = 1,
      pageSize = 10,
      search?: string,
      verified: "ALL" | "VERIFIED" | "UNVERIFIED" = "ALL",
    ): Promise<VenueCityWiseData> {
      const params: Record<string, string | number> = { page, pageSize };
      if (search) params.search = search;
      if (verified && verified !== "ALL") params.verified = verified;
      const res = await axiosInstance.get(
        `/${path}/city-wise-overview/${encodeURIComponent(state)}/${encodeURIComponent(city)}`,
        { params }
      );
      return res.data;
    },

    async addVenueToCity(state: string, city: string, payload: Record<string, unknown>) {
      const res = await axiosInstance.post(
        `/${path}/city-wise-overview/${encodeURIComponent(state)}/${encodeURIComponent(city)}/add`,
        payload
      );
      return res.data;
    },

    async updateVenue(id: string, payload: Record<string, unknown>) {
      const res = await axiosInstance.patch(`/${path}/${id}`, payload);
      return res.data;
    },

    async deleteVenue(id: string) {
      const res = await axiosInstance.delete(`/${path}/${id}`);
      return res.data;
    },

    async changeStatus(id: string, status: string) {
      const res = await axiosInstance.patch(`/${path}/status/${id}`, { updatedStatus: status });
      return res.data;
    },

    async verifyVenue(id: string) {
      const res = await axiosInstance.post(`/${path}/${id}/verify`);
      return res.data;
    },

    async unverifyVenue(id: string) {
      const res = await axiosInstance.post(`/${path}/${id}/unverify`);
      return res.data;
    },

    async getVenueById(id: string) {
      const res = await axiosInstance.get(`/${path}/${id}`);
      return res.data;
    },
  };
}

export const mallService = createVenueService("malls");
export const hospitalService = createVenueService("hospitals");
export const stadiumService = createVenueService("stadiums");
export const airportService = createVenueService("airports");

export const VENUE_SERVICES: Record<VenueSegment, ReturnType<typeof createVenueService>> = {
  malls: mallService,
  hospitals: hospitalService,
  stadiums: stadiumService,
  airports: airportService,
};
