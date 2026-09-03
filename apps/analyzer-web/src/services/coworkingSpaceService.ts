import { axiosInstance } from "@/config/axios";
import { getAuthToken } from "@/lib/token";

type CodedError = Error & { code?: string };

export interface CoworkingSpaceOverviewData {
  success: boolean;
  totalCoworkingSpaces: number;
  contactedCoworkingSpaces: number;
  positiveResponses: number;
  responseRate: number;
  stateData: Array<{
    state: string;
    count: number;
  }>;
}

export interface CoworkingSpaceStateWiseOverviewData {
  success: boolean;
  state: string;
  totalCoworkingSpaces: number;
  contactedCoworkingSpaces: number;
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
    CLOSED: number;
  };
}

export interface CoworkingSpaceCityWiseOverviewItem {
  id: string;
  name: string;
  address: string;
  contactPhone: string | null;
  status: string;
  operator: string | null;
  campusBrand: string | null;
  city: string;
  state: string;
  rating?: number | null;
  total_ratings?: number;
  company_count?: number;
  website?: string | null;
  map_url?: string | null;
  review_priority?: string | null;
  review_issue_score?: number | null;
  reviews_analyzed?: number;
  issue_review_count?: number;
  parking_review_count?: number;
  builder_name?: string | null;
  security_agency_name?: string | null;
  property_manager_name?: string | null;
  serialNumber?: number;
}

export interface CoworkingSpaceCityWiseOverviewData {
  success: boolean;
  state: string;
  city: string;
  totalCoworkingSpaces: number;
  contactedCoworkingSpaces: number;
  positiveResponses: number;
  responseRate: number;
  statusBreakdown: Record<string, number>;
  items: CoworkingSpaceCityWiseOverviewItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface CoworkingSpaceCompany {
  id: string;
  name: string;
  description: string;
  business_status: string;
  operator: string;
  contact_phone: string;
  contact_email: string;
  contact_international_phone: string;
  serialNumber?: number;
}

export interface CoworkingSpaceCompanyData {
  success: boolean;
  data: {
    stats: {
      totalCompanies: number;
      contactedCompanies: number;
      positiveResponses: number;
      responseRate: number;
    };
    statusBreakdown: Record<string, number>;
    items: CoworkingSpaceCompany[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      pageSize: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  };
}

export const coworkingSpaceService = {
  // National Level
  async getOverviewData(): Promise<CoworkingSpaceOverviewData> {
    const response = await axiosInstance.get('/coworking-spaces/overview');
    return response.data;
  },

  // State Level
  async getStateWiseOverview(state: string): Promise<CoworkingSpaceStateWiseOverviewData> {
    const response = await axiosInstance.get(`/coworking-spaces/state-wise-overview/${state}`);
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
      `/coworking-spaces/state/${encodeURIComponent(state)}/cities`,
      { city },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },

  // City Level
  async getCityWiseOverview(
    state: string,
    city: string,
    page = 1,
    pageSize = 10,
    search?: string,
    verified: 'ALL' | 'VERIFIED' | 'UNVERIFIED' = 'ALL'
  ): Promise<CoworkingSpaceCityWiseOverviewData> {
    const params: Record<string, string | number> = { page, pageSize };
    if (search) params.search = search;
    if (verified !== 'ALL') params.verified = verified;

    const response = await axiosInstance.get(
      `/coworking-spaces/city-wise-overview/${encodeURIComponent(state)}/${encodeURIComponent(city)}`,
      { params }
    );
    return response.data;
  },

  // Coworking Space CRUD
  async addCoworkingSpaceToCity(params: {
    state: string;
    city: string;
    payload: {
      name: string;
      city: string;
      state: string;
      district?: string;
      pincode?: string;
      country?: string;
      address?: string;
      contact_phone?: string;
      international_phone?: string;
      generic_email?: string;
      operator_name?: string;
      campus_brand?: string;
      legal_entity?: string;
      campus_size_hint?: string;
      status?: string;
      map_url?: string;
      website?: string;
      rating?: number;
      exterior_media_url?: string;
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
      exterior_media_urls?: string[];
      lat?: number;
      lng?: number;
    };
  }) {
    const { state, city, payload } = params;
    const response = await axiosInstance.post(
      `/coworking-spaces/city-wise-overview/${encodeURIComponent(state)}/${encodeURIComponent(city)}/add-coworking-space`,
      payload
    );
    return response.data;
  },

  async updateCoworkingSpace(id: string, payload: {
    name?: string;
    city?: string;
    state?: string;
    district?: string;
    pincode?: string;
    country?: string;
    address?: string;
    contact_phone?: string;
    international_phone?: string;
    generic_email?: string;
    operator_name?: string;
    campus_brand?: string;
    legal_entity?: string;
    campus_size_hint?: string;
    status?: string;
    map_url?: string;
    website?: string;
    rating?: number;
    exterior_media_url?: string;
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
    exterior_media_urls?: string[];
    lat?: number;
    lng?: number;
  }) {
    const response = await axiosInstance.patch(`/coworking-spaces/${id}`, payload);
    return response.data;
  },

  async deleteCoworkingSpace(id: string) {
    const response = await axiosInstance.delete(`/coworking-spaces/${id}`);
    return response.data;
  },

  async getCoworkingSpaceById(id: string) {
    const response = await axiosInstance.get(`/coworking-spaces/${id}`);
    return response.data;
  },

  async changeStatus(id: string, status: string) {
    const response = await axiosInstance.patch(`/coworking-spaces/status/${id}`, {
      updatedStatus: status
    });
    return response.data;
  },

  async verifyCoworkingSpace(id: string) {
    const response = await axiosInstance.post(`/coworking-spaces/${id}/verify`);
    return response.data;
  },

  async unverifyCoworkingSpace(id: string) {
    const response = await axiosInstance.post(`/coworking-spaces/${id}/unverify`);
    return response.data;
  },

  async assignCoworkingSpace(id: string, userId?: string) {
    const response = await axiosInstance.post(`/coworking-spaces/${id}/assign`, userId ? { userId } : {});
    return response.data;
  },

  async unassignCoworkingSpace(id: string) {
    const response = await axiosInstance.post(`/coworking-spaces/${id}/unassign`);
    return response.data;
  },

  // Company Management
  async getCompaniesByCoworkingSpace(
    coworkingSpaceId: string,
    page = 1,
    limit = 10,
    search?: string
  ): Promise<CoworkingSpaceCompanyData> {
    const params: Record<string, string | number> = { page, limit };
    if (search) params.search = search;

    const response = await axiosInstance.get(`/coworking-spaces/${coworkingSpaceId}/companies`, {
      params,
    });
    return response.data;
  },

  async addCompanyToCoworkingSpace(coworkingSpaceId: string, payload: {
    name: string;
    description?: string;
    business_status?: string;
    operator?: string;
    contact_phone?: string;
    contact_email?: string;
    contact_international_phone?: string;
  }) {
    const response = await axiosInstance.post(`/coworking-spaces/${coworkingSpaceId}/companies`, payload);
    return response.data;
  },

  async updateCompany(companyId: string, payload: {
    name?: string;
    description?: string;
    business_status?: string;
    operator?: string;
    contact_phone?: string;
    contact_email?: string;
    contact_international_phone?: string;
  }) {
    const response = await axiosInstance.patch(`/coworking-spaces/companies/${companyId}`, payload);
    return response.data;
  },

  async deleteCompany(companyId: string) {
    const response = await axiosInstance.delete(`/coworking-spaces/companies/${companyId}`);
    return response.data;
  },

  async getCompanyById(companyId: string) {
    const response = await axiosInstance.get(`/coworking-spaces/companies/${companyId}`);
    return response.data;
  },

  async changeCompanyStatus(companyId: string, status: string) {
    const response = await axiosInstance.patch(`/coworking-spaces/companies/status/${companyId}`, {
      updatedStatus: status
    });
    return response.data;
  }
};
