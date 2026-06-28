import axios from "axios";
import * as cheerio from "cheerio";

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
};

const normalizeUrl = (value: string): string | null => {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).toString();
  } catch {
    return null;
  }
};

const toAbsoluteUrl = (candidate: string | undefined, baseUrl: string): string | null => {
  const raw = String(candidate || "").trim();
  if (!raw) return null;
  if (raw.startsWith("data:")) return null;

  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return null;
  }
};

const isLikelyImageUrl = (value: string | null): value is string => {
  if (!value) return false;
  return !value.startsWith("javascript:");
};

export const scrapeWebsiteImage = async (
  websiteUrl: string | null | undefined,
): Promise<string | null> => {
  const normalizedWebsiteUrl = normalizeUrl(String(websiteUrl || ""));
  if (!normalizedWebsiteUrl) return null;

  try {
    const response = await axios.get(normalizedWebsiteUrl, {
      timeout: 12000,
      maxRedirects: 5,
      headers: DEFAULT_HEADERS,
      responseType: "text",
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const finalUrl = normalizeUrl(response.request?.res?.responseUrl || normalizedWebsiteUrl) || normalizedWebsiteUrl;
    const html = typeof response.data === "string" ? response.data : "";
    if (!html) return null;

    const $ = cheerio.load(html);

    const candidates = [
      $('meta[property="og:image"]').attr("content"),
      $('meta[property="og:image:url"]').attr("content"),
      $('meta[name="twitter:image"]').attr("content"),
      $('meta[name="twitter:image:src"]').attr("content"),
      $('link[rel="apple-touch-icon"]').attr("href"),
      $('link[rel="icon"]').attr("href"),
      $('link[rel="shortcut icon"]').attr("href"),
      $('img[src]').first().attr("src"),
      $('source[srcset]').first().attr("srcset")?.split(",")[0]?.trim().split(" ")[0],
    ]
      .map((candidate) => toAbsoluteUrl(candidate, finalUrl))
      .filter(isLikelyImageUrl);

    return candidates[0] ?? null;
  } catch {
    return null;
  }
};
