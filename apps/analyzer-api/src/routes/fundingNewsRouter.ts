import type { Router as ExpressRouter } from "express";
import { Router } from "express";
import { authenticateToken, checkPermission } from "../middleware/auth";

import {
  getAllFundingNews,
  getFundingNewsById,
  toggleBookmark,
  getBookmarkedArticles,
  triggerScraping,
  getFundingStats,
  updateContactDetails,
  getCompanyDetails
} from "../controller/fundingNewsController";

export const fundingNewsRouter: ExpressRouter = Router();

const canViewFundingNews = checkPermission(["FUNDING.NEWS_VIEW"], {
  mode: "any",
});

fundingNewsRouter.get("/", authenticateToken, canViewFundingNews, getAllFundingNews);
fundingNewsRouter.get("/bookmarked", authenticateToken, canViewFundingNews, getBookmarkedArticles);
fundingNewsRouter.get("/stats", authenticateToken, canViewFundingNews, getFundingStats);
fundingNewsRouter.get("/company-details/:id", authenticateToken, canViewFundingNews, getCompanyDetails);
fundingNewsRouter.get("/:id", authenticateToken, canViewFundingNews, getFundingNewsById);
fundingNewsRouter.patch("/bookmark/:id", authenticateToken, canViewFundingNews, toggleBookmark);
fundingNewsRouter.patch("/contact/:id", authenticateToken, canViewFundingNews, updateContactDetails);
fundingNewsRouter.post(
  "/trigger-scraping",
  authenticateToken,
  checkPermission(["SYSTEM.ADMIN"], {
    mode: "any",
  }),
  triggerScraping,
); 
