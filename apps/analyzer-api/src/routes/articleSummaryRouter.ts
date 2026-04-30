import type { Router as ExpressRouter } from "express";
import { Router } from "express";
import { authenticateToken, checkPermission } from "../middleware/auth";

import {
  scrapeArticle,
  summarizeText,
  summarizeArticleUrl,
} from "../controller/articleSummaryController";

export const articleSummaryRouter: ExpressRouter = Router();

const canViewFundingNews = checkPermission(["FUNDING.NEWS_VIEW"], {
  mode: "any",
});

// POST /articles/scrape — Scrape article content from URL
articleSummaryRouter.post(
  "/scrape",
  authenticateToken,
  canViewFundingNews,
  scrapeArticle
);

// POST /articles/summarize — Summarize provided text via Ollama
articleSummaryRouter.post(
  "/summarize",
  authenticateToken,
  canViewFundingNews,
  summarizeText
);

// POST /articles/summarize-url — Combined: scrape URL then summarize
articleSummaryRouter.post(
  "/summarize-url",
  authenticateToken,
  canViewFundingNews,
  summarizeArticleUrl
);
