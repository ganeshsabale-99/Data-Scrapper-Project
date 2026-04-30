import { Request, Response, NextFunction } from "express";
import { scrapeArticleContent } from "../libs/articleScraper";
import { summarizeWithOllama } from "../libs/ollamaSummarizer";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";

const sendArticleSafeError = (
  res: Response,
  error: unknown,
  context: string,
  fallbackMessage: string
) =>
  sendSafeErrorResponse(
    res,
    error,
    `articleSummary.${context}`,
    fallbackMessage
  );

// ─── POST /articles/scrape ───────────────────────────────────────────────────

export const scrapeArticle = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== "string") {
      return res.status(400).json({
        error: "A valid 'url' parameter is required.",
      });
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        error: "Invalid URL format provided.",
      });
    }

    console.log(`[ArticleSummary] Scraping article from: ${url}`);
    const articleContent = await scrapeArticleContent(url);

    return res.status(200).json({
      data: {
        title: articleContent.title,
        bodyText: articleContent.bodyText,
        imageUrl: articleContent.imageUrl,
        publishedDate: articleContent.publishedDate,
        source: articleContent.source,
      },
    });
  } catch (error: any) {
    return sendArticleSafeError(
      res,
      error,
      "scrapeArticle",
      "Unable to scrape article content. The site may be unavailable or blocking requests."
    );
  }
};

// ─── POST /articles/summarize ────────────────────────────────────────────────

export const summarizeText = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        error: "A valid 'text' parameter is required.",
      });
    }

    if (text.trim().length < 50) {
      return res.status(400).json({
        error: "Text is too short to summarize. Please provide at least 50 characters.",
      });
    }

    console.log(
      `[ArticleSummary] Summarizing text (${text.length} chars)...`
    );
    const result = await summarizeWithOllama(text);

    return res.status(200).json({
      data: {
        summary: result.summary,
        model: result.model,
        generatedAt: result.generatedAt,
      },
    });
  } catch (error: any) {
    return sendArticleSafeError(
      res,
      error,
      "summarizeText",
      "Unable to generate summary. The AI service may be temporarily unavailable."
    );
  }
};

// ─── POST /articles/summarize-url (Combined flow) ────────────────────────────

export const summarizeArticleUrl = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== "string") {
      return res.status(400).json({
        error: "A valid 'url' parameter is required.",
      });
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        error: "Invalid URL format provided.",
      });
    }

    console.log(`[ArticleSummary] Starting summarize flow for: ${url}`);

    // Step 1: Scrape article content
    console.log(`[ArticleSummary] Step 1/2: Scraping article...`);
    let articleContent;
    try {
      articleContent = await scrapeArticleContent(url);
    } catch (scrapeError: any) {
      return res.status(422).json({
        error: `Failed to scrape article: ${scrapeError.message || "Unknown scraping error"}`,
        step: "scraping",
      });
    }

    // Step 2: Summarize with Ollama (only send text, not image)
    console.log(
      `[ArticleSummary] Step 2/2: Summarizing with LLM (${articleContent.bodyText.length} chars)...`
    );
    let summaryResult;
    try {
      summaryResult = await summarizeWithOllama(articleContent.bodyText);
    } catch (llmError: any) {
      return res.status(502).json({
        error: `Failed to generate summary: ${llmError.message || "AI service error"}`,
        step: "summarization",
        // Still return scraped data so frontend can show article info
        scrapedData: {
          title: articleContent.title,
          imageUrl: articleContent.imageUrl,
          publishedDate: articleContent.publishedDate,
          source: articleContent.source,
        },
      });
    }

    console.log(`[ArticleSummary] Successfully summarized article: ${articleContent.title}`);

    return res.status(200).json({
      data: {
        title: articleContent.title,
        summary: summaryResult.summary,
        imageUrl: articleContent.imageUrl,
        publishedDate: articleContent.publishedDate,
        source: articleContent.source,
        articleUrl: url,
        model: summaryResult.model,
        generatedAt: summaryResult.generatedAt,
      },
    });
  } catch (error: any) {
    return sendArticleSafeError(
      res,
      error,
      "summarizeArticleUrl",
      "Unable to process article. Please try again later."
    );
  }
};
