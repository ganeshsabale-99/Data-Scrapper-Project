import { axiosInstance } from "@/config/axios";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ArticleSummaryData {
  title: string;
  summary: string;
  imageUrl: string | null;
  publishedDate: string | null;
  source: string | null;
  articleUrl: string;
  model: string;
  generatedAt: string;
}

export interface ArticleSummaryResponse {
  data: ArticleSummaryData;
}

export interface ArticleScrapeData {
  title: string;
  bodyText: string;
  imageUrl: string | null;
  publishedDate: string | null;
  source: string | null;
}

export interface ArticleScrapeResponse {
  data: ArticleScrapeData;
}

export interface ArticleSummarizeTextResponse {
  data: {
    summary: string;
    model: string;
    generatedAt: string;
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class ArticleSummaryService {
  /**
   * Combined flow: scrape article content from URL and summarize via Ollama.
   */
  static async summarizeUrl(url: string): Promise<ArticleSummaryResponse> {
    const response = await axiosInstance.post("/articles/summarize-url", {
      url,
    });
    return response.data;
  }

  /**
   * Scrape article content only (no summarization).
   */
  static async scrapeArticle(url: string): Promise<ArticleScrapeResponse> {
    const response = await axiosInstance.post("/articles/scrape", { url });
    return response.data;
  }

  /**
   * Summarize provided text via Ollama (no scraping).
   */
  static async summarizeText(
    text: string
  ): Promise<ArticleSummarizeTextResponse> {
    const response = await axiosInstance.post("/articles/summarize", { text });
    return response.data;
  }
}
