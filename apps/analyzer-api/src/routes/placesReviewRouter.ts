import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { getPlaceReviews, getParkingComplaints, getStoredVenueReviews } from "../controller/placesReviewController";

export const placesReviewRouter: Router = Router();

// GET /places-reviews?name=<place name>&location=<city, state>
placesReviewRouter.get("/", authenticateToken, getPlaceReviews);

placesReviewRouter.get("/stored", authenticateToken, getStoredVenueReviews);

// GET /places-reviews/parking-complaints?name=<place name>&location=<city, state>
placesReviewRouter.get("/parking-complaints", authenticateToken, getParkingComplaints);
