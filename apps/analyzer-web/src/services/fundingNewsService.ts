import { axiosInstance } from "@/config/axios";

export interface FundingNews {
  id: string;
  title: string;
  article_url: string;
  source: 'ENTRACKR' | 'YOURSTORY';
  author?: string;
  date_published?: string;
  content_summary?: string;
  funding_amount?: string;
  company_name?: string;
  industry?: string;
  is_featured: boolean;
  is_bookmarked: boolean;
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_status?: 'NOT_CONTACTED' | 'CONTACTED' | 'INTERESTED' | 'MEETING_SCHEDULED' | 'PROPOSAL_SENT' | 'CLOSED';
  created_at: string;
  updated_at: string;

  // Funding Intelligence Fields (Optional)
  round?: string;
  investors?: string[];
  location?: string;
  founders?: string[];
  full_content?: string;
  image_url?: string;
  serialNumber?: number;
}

export interface FundingNewsResponse {
  data: FundingNews[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SingleNewsResponse {
  data: FundingNews;
}

export interface BookmarkResponse {
  message: string;
  data: FundingNews;
}

export interface ContactUpdateRequest {
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  contact_status?: 'NOT_CONTACTED' | 'CONTACTED' | 'INTERESTED' | 'MEETING_SCHEDULED' | 'PROPOSAL_SENT' | 'CLOSED';
}

export interface ContactUpdateResponse {
  message: string;
  data: FundingNews;
}

export interface FundingNewsStatsResponse {
  data: {
    total: number;
    bySource: {
      entrackr: number;
      yourstory: number;
    };
    bookmarked: number;
  };
}

export class FundingNewsService {
  // Get all funding news with pagination and filtering
  static async getAllFundingNews(params?: {
    page?: number;
    limit?: number;
    source?: string;
    search?: string;
    bookmarked?: boolean;
  }): Promise<FundingNewsResponse> {
    const queryParams = new URLSearchParams();

    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.source) queryParams.append('source', params.source);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.bookmarked) queryParams.append('bookmarked', 'true');

    const response = await axiosInstance.get(`/funding-news?${queryParams.toString()}`);
    return response.data;
  }

  // Get funding news by ID
  static async getFundingNewsById(id: string): Promise<SingleNewsResponse> {
    const response = await axiosInstance.get(`/funding-news/${id}`);
    return response.data;
  }

  // Get global stats (total articles and total bookmarked)
  static async getStats(): Promise<FundingNewsStatsResponse> {
    const response = await axiosInstance.get(`/funding-news/stats`);
    return response.data;
  }

  // Toggle bookmark status
  static async toggleBookmark(id: string): Promise<BookmarkResponse> {
    const response = await axiosInstance.patch(`/funding-news/bookmark/${id}`);
    return response.data;
  }

  // Get bookmarked articles
  static async getBookmarkedArticles(params?: {
    page?: number;
    limit?: number;
  }): Promise<FundingNewsResponse> {
    const queryParams = new URLSearchParams();

    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const response = await axiosInstance.get(`/funding-news/bookmarked?${queryParams.toString()}`);
    return response.data;
  }

  // Update contact details
  static async updateContactDetails(id: string, contactData: ContactUpdateRequest): Promise<ContactUpdateResponse> {
    const response = await axiosInstance.patch(`/funding-news/contact/${id}`, contactData);
    return response.data;
  }

  // Get company details (scraped from article page)
  static async getCompanyDetails(id: string): Promise<CompanyDetailsResponse> {
    const response = await axiosInstance.get(`/funding-news/company-details/${id}`);
    return response.data;
  }
}

export interface CompanyDetails {
  companyName: string;
  website?: string;
  socialLinks: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
    crunchbase?: string;
  };
  otherLinks: string[];
  description?: string;
}

export interface CompanyDetailsResponse {
  data: CompanyDetails;
}