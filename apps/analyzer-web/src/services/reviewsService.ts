import { axiosInstance } from "@/config/axios";

export interface PlaceReview {
  author: string;
  rating: number;
  date: string;
  text: string;
  is_local_guide: boolean;
  profile_photo_url?: string | null;
}

export interface PlaceReviewsData {
  name?: string;
  rating: number | null;
  total_ratings: number;
  place_id: string | null;
  reviews: PlaceReview[];
}

export interface PlaceReviewsResponse {
  success: boolean;
  data: PlaceReviewsData;
}

export interface ParkingComplaintsData {
  place: string | null;
  overall_rating: number | null;
  total_reviews_scanned: number;
  complaints: PlaceReview[];
}

export interface ParkingComplaintsResponse {
  success: boolean;
  data: ParkingComplaintsData;
}

export type StoredReviewFilter = "all" | "issues" | "parking";

export interface StoredVenueReview {
  id: string;
  provider: string;
  authorName?: string | null;
  authorImageUrl?: string | null;
  rating?: number | null;
  text?: string | null;
  publishedAt?: string | null;
  relativeTime?: string | null;
  issueScore: number;
  issueCategories: string[];
  isParkingRelated: boolean;
}

export interface StoredVenueReviewsResponse {
  success: boolean;
  data: {
    items: StoredVenueReview[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    counts: { all: number; issues: number; parking: number };
  };
}

export const reviewsService = {
  async getStoredVenueReviews(venueType: string, venueId: string, filter: StoredReviewFilter, page = 1, pageSize = 10): Promise<StoredVenueReviewsResponse> {
    const response = await axiosInstance.get<StoredVenueReviewsResponse>("/places-reviews/stored", {
      params: { venueType, venueId, filter, page, pageSize },
    });
    return response.data;
  },

  async getPlaceReviews(name: string, location: string, mapUrl?: string | null): Promise<PlaceReviewsResponse> {
    const response = await axiosInstance.get<PlaceReviewsResponse>("/places-reviews", {
      params: { name, location, ...(mapUrl ? { mapUrl } : {}) },
    });
    return response.data;
  },

  async getParkingComplaints(name: string, location: string, mapUrl?: string | null): Promise<ParkingComplaintsResponse> {
    const response = await axiosInstance.get<ParkingComplaintsResponse>("/places-reviews/parking-complaints", {
      params: { name, location, ...(mapUrl ? { mapUrl } : {}) },
    });
    return response.data;
  },
};
