import { axiosInstance } from "@/config/axios";
import { getAuthToken } from "@/lib/token";

type CodedError = Error & { code?: string };

export type VerifiedFilter = "ALL" | "VERIFIED" | "UNVERIFIED";
export type VerificationLifecycleStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "READY_FOR_REVIEW"
  | "VERIFIED"
  | "REJECTED";

export interface OverviewData {
  success: boolean;
  totalTechParks: number;
  contactedTechParks: number;
  positiveResponses: number;
  responseRate: number;
  stateData: Array<{
    state: string;
    count: number;
  }>;
}

export interface StateWiseOverviewData {
  success: boolean;
  state: string;
  totalTechParks: number;
  contactedTechParks: number;
  positiveResponses: number;
  responseRate: number;
  cityData: Array<{
    city: string;
    count: number;
  }>;
  statusBreakdown: {
    NOT_CONTACTED: number;
    CONTACTED: number;
    INTERESTED: number;
    MEETING_SCHEDULED: number;
    PROPOSAL_SENT: number;
    IN_PROGRESS: number;
  };
}

export interface CityWiseOverviewItem {
  id: string;
  name: string;
  website: string | null;
  address: string;
  contactNumber: string | null;
  status: string;
  rating: number | null;
  googleMapLink: string | null;
  isVerified: boolean;
  reviewStatus: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  submittedByUserId: string | null;
  verificationLifecycleStatus?: VerificationLifecycleStatus;
  isVerificationFormComplete?: boolean;
  hasVerificationProgress?: boolean;
  verifiedAt: string | null;
  verifiedByName: string | null;
}

export interface VerifyTechParkResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    name: string;
    isVerified: boolean;
    reviewStatus: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
    verifiedAt: string | null;
    verifiedByUser: {
      id: string;
      name: string;
    } | null;
  };
}

export interface VerifyAllCityTechParksResponse {
  success: boolean;
  message: string;
  data: {
    state: string;
    city: string;
    requested?: number;
    verifiedNow: number;
    skipped?: number;
  };
}

export interface CityWiseOverviewData {
  success: boolean;
  state: string;
  city: string;
  totalTechParks: number;
  contactedTechParks: number;
  positiveResponses: number;
  responseRate: number;
  statusBreakdown: Record<string, number>;
  verificationBreakdown: {
    all: number;
    verified: number;
    unverified: number;
    appliedFilter: VerifiedFilter;
  };
  items: CityWiseOverviewItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface CityStateLookupData {
  success: boolean;
  data: {
    state: string;
    city: string;
    is_active: boolean;
  };
}

export const techParkService = {
  async getOverviewData(): Promise<OverviewData> {
    const response = await axiosInstance.get('/new-techparks/overview');
    return response.data;
  },

  async getStateWiseOverview(state: string): Promise<StateWiseOverviewData> {
    const response = await axiosInstance.get(`/new-techparks/state-wise-overview/${state}`);
    return response.data;
  },

  async addCityToState(state: string, city: string) {
    const token = getAuthToken();
    if (!token) {
      const err: CodedError = new Error("Session expired. Please login again.");
      err.code = "TOKEN_MISSING";
      throw err;
    }
    const response = await axiosInstance.post(
      `/new-techparks/state/${encodeURIComponent(state)}/cities`,
      { city },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },

  async getCityWiseOverview(
    state: string,
    city: string,
    page = 1,
    pageSize = 10,
    search?: string,
    verified: VerifiedFilter = "ALL",
  ): Promise<CityWiseOverviewData> {
    const params: Record<string, string | number> = { page, pageSize };
    if (search) params.search = search;
    if (verified && verified !== "ALL") params.verified = verified;

    const response = await axiosInstance.get(`/new-techparks/city-wise-overview/${encodeURIComponent(state)}/${encodeURIComponent(city)}`, {
      params,
    });
    return response.data;
  },

  async resolveStateByCity(city: string): Promise<CityStateLookupData> {
    const response = await axiosInstance.get(
      `/new-techparks/city-catalog/state-by-city/${encodeURIComponent(city)}`
    );
    return response.data;
  },

  async addTechParkToCity(params: {
    state: string;
    city: string;
    payload: {
      name: string;
      address: string;
      website?: string;
      reception_phone?: string;
      status?: string;
      rating?: number | string;
      map_url?: string;
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
      lat?: number;
      lng?: number;
      exterior_media_url?: string;
      exterior_media_urls?: string[];
    };
  }) {
    const { state, city, payload } = params;
    const response = await axiosInstance.post(
      `/new-techparks/city-wise-overview/${encodeURIComponent(state)}/${encodeURIComponent(city)}/add-tech-park`,
      payload
    );
    return response.data;
  },

  async deleteTechPark(id: string) {
    const response = await axiosInstance.delete(`/new-techparks/${id}`);
    return response.data;
  },

  async changeTechParkStatus(id: string, status: string) {
    const response = await axiosInstance.patch(`/new-techparks/status/${id}`, {
      updatedStatus: status
    });
    return response.data;
  },

  async verifyTechPark(id: string): Promise<VerifyTechParkResponse> {
    const response = await axiosInstance.post(`/new-techparks/${id}/verify`);
    return response.data;
  },

  async unverifyTechPark(id: string): Promise<VerifyTechParkResponse> {
    const response = await axiosInstance.post(`/new-techparks/${id}/unverify`);
    return response.data;
  },

  async verifyAllUnverifiedInCity(
    state: string,
    city: string,
  ): Promise<VerifyAllCityTechParksResponse> {
    const response = await axiosInstance.post(
      `/new-techparks/city-wise-overview/${encodeURIComponent(state)}/${encodeURIComponent(city)}/verify-unverified`,
    );
    return response.data;
  },

  async editTechPark(id: string, payload: {
    name?: string;
    address_line1?: string;
    address_line2?: string;
    locality?: string;
    city?: string;
    state?: string;
    pincode?: string;
    website?: string;
    reception_phone?: string;
    international_phone?: string;
    status?: string;
    rating?: number;
    map_url?: string;
    types?: string[];
    is_active?: boolean;
    builder_name?: string;
    security_agency_name?: string;
    property_manager_name?: string;
    property_manager_phone?: string;
    property_manager_email?: string;
    parking_floors?: number;
    total_floors?: number;
    basement_levels?: number;
    spoc_name?: string;
    spoc_phone?: string;
    seating_capacity?: number;
    challenges?: string;
    lat?: number;
    lng?: number;
    exterior_media_url?: string;
    exterior_media_urls?: string[];
  }) {
    const response = await axiosInstance.patch(`/new-techparks/${id}`, payload);
    return response.data;
  },

  async uploadNewTechParkExteriorMedia(files: File[]): Promise<{
    success: boolean;
    files: Array<{ key: string; url: string; signedUrl: string }>;
    urls: string[];
    signedUrls: string[];
    keys: string[];
  }> {
    const token = getAuthToken();
    if (!token) {
      const err: CodedError = new Error("Session expired. Please login again.");
      err.code = "TOKEN_MISSING";
      throw err;
    }
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    const response = await axiosInstance.post(`/media/new-techpark/exterior`, form, {
      headers: { "Content-Type": "multipart/form-data", Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  async getTechParkById(id: string) {
    const response = await axiosInstance.get(`/new-techparks/${id}`);
    return response.data;
  },

  // Company management functions
  async getCompaniesByTechPark(techParkId: string, page = 1, limit = 10, search?: string) {
    const params: Record<string, string | number> = { page, limit };
    if (search) params.search = search;

    const response = await axiosInstance.get(`/new-techparks/${techParkId}/companies`, {
      params,
    });
    return response.data;
  },

  async addCompanyToTechPark(techParkId: string, payload: {
    name: string;
    address?: string;
    contact?: string;
    website?: string;
    map_url?: string;
    rating?: number;
    status?: string;
    description?: string;
  }) {
    const response = await axiosInstance.post(`/new-techparks/${techParkId}/companies`, payload);
    return response.data;
  },

  async discoverCompaniesByTechPark(techParkId: string) {
    const response = await axiosInstance.post(`/new-techparks/${techParkId}/companies/discover`);
    return response.data;
  },

  async updateCompany(companyId: string, payload: {
    name?: string;
    address?: string;
    city?: string;
    website?: string;
    map_url?: string;
    rating?: number;
    total_ratings?: number;
    business_status?: string;
    status?: string;
    description?: string;
    operator?: string;
    contact_phone?: string;
    contact_email?: string;
    contact_international_phone?: string;
    locationLat?: number;
    locationLng?: number;
    opening_hours?: string[];
    types?: string[];
  }) {
    const response = await axiosInstance.patch(`/new-techparks/companies/${companyId}`, payload);
    return response.data;
  },

  async deleteCompany(companyId: string) {
    const response = await axiosInstance.delete(`/new-techparks/companies/${companyId}`);
    return response.data;
  },

  async getCompanyById(companyId: string) {
    const response = await axiosInstance.get(`/new-techparks/companies/${companyId}`);
    return response.data;
  },

  async changeCompanyStatus(companyId: string, status: string) {
    const response = await axiosInstance.patch(`/new-techparks/companies/status/${companyId}`, {
      updatedStatus: status
    });
    return response.data;
  }
}; 
