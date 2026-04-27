import axios from "axios";
import * as cheerio from "cheerio";

const ENTRACKR_URL = "https://entrackr.com/";

export const scrapeEntrackr = async () => {
  try {
    const { data: html } = await axios.get(ENTRACKR_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
    });

    const $ = cheerio.load(html);
    const articles: {
      title: string;
      link: string;
      author?: string;
      date?: string;
    }[] = [];

    $("div.article-box .feat-a-1 .gallery_content").each((_, el) => {
      const title = $(el).find("h2.feat-a-1-title").text().trim();
      const relativeLink = $(el).find("a").attr("href");
      const link = relativeLink?.startsWith("http")
        ? relativeLink
        : `https://entrackr.com${relativeLink}`;
      const author = $(el).find(".author-name").text().trim();
      const date = $(el).find(".publish-date").first().text().trim();

      if (title && link) {
        articles.push({ title, link, author, date });
      }
    });

    $("div.small-post").each((_, el) => {
      const title = $(el).find("div.post-title").text().trim();
      const relativeLink = $(el).find("a").first().attr("href");
      const link = relativeLink?.startsWith("http")
        ? relativeLink
        : `https://entrackr.com${relativeLink}`;
      const author = $(el).find(".author-name").text().trim();
      const date = $(el).find(".publish-date").first().text().trim();

      if (title && link) {
        articles.push({ title, link, author, date });
      }
    });

    return articles;
  } catch (error: any) {
    console.error("Failed to scrape Entrackr:", error.message);
    return [];
  }
};

export default scrapeEntrackr;
