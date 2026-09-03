import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { getPlaceReviews, getParkingComplaints, getStoredVenueReviews, getVenueProviderCandidates } from "../controller/placesReviewController";

export const placesReviewRouter: Router = Router();

// GET /places-reviews?name=<place name>&location=<city, state>
placesReviewRouter.get("/", authenticateToken, getPlaceReviews);

placesReviewRouter.get("/stored", authenticateToken, getStoredVenueReviews);
placesReviewRouter.get("/provider-candidates", authenticateToken, getVenueProviderCandidates);

// GET /places-reviews/parking-complaints?name=<place name>&location=<city, state>
placesReviewRouter.get("/parking-complaints", authenticateToken, getParkingComplaints);
