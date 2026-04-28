import { axiosInstance } from "@/config/axios";

export interface PlaceReview {
  author: string;
  rating: number;
  date: string;
  text: string;
  is_local_guide: boolean;
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

export const reviewsService = {
  async getPlaceReviews(name: string, location: string): Promise<PlaceReviewsResponse> {
    const response = await axiosInstance.get<PlaceReviewsResponse>("/places-reviews", {
      params: { name, location },
    });
    return response.data;
  },

  async getParkingComplaints(name: string, location: string): Promise<ParkingComplaintsResponse> {
    const response = await axiosInstance.get<ParkingComplaintsResponse>("/places-reviews/parking-complaints", {
      params: { name, location },
    });
    return response.data;
  },
};
