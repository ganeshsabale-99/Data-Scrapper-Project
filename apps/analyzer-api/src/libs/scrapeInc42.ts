import axios from "axios";
import * as cheerio from "cheerio";

const INC42_URL = "https://inc42.com/buzz/";

export const scrapeInc42 = async () => {
    try {
        const { data: html } = await axios.get(INC42_URL, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
        });

        const $ = cheerio.load(html);
        const articles: {
            title: string;
            link: string;
            author?: string;
            date?: string;
        }[] = [];
        const seenLinks = new Set<string>();

        // The site has changed which heading level wraps each post link before
        // (h3 → h2) without warning — matching both makes this resilient to that
        // happening again instead of silently returning zero results. A post can
        // legitimately show up under both (e.g. a "latest" widget vs. the main
        // list), so dedupe by link.
        $("h2 a, h3 a").each((_, el) => {
            const title = $(el).text().trim();
            const relativeLink = $(el).attr("href");

            if (!title || !relativeLink) return;

            const link = relativeLink.startsWith("http")
                ? relativeLink
                : `https://inc42.com${relativeLink}`;

            if (seenLinks.has(link)) return;

            const lowerTitle = title.toLowerCase();
            const isFundingNews =
                lowerTitle.includes("raise") ||
                lowerTitle.includes("funding") ||
                lowerTitle.includes("invest") ||
                lowerTitle.includes("secure") ||
                lowerTitle.includes("capital") ||
                lowerTitle.includes("series") ||
                lowerTitle.includes("fund") ||
                lowerTitle.includes("debt") ||
                lowerTitle.includes("equity") ||
                lowerTitle.includes("acquire") ||
                lowerTitle.includes("merger");

            if (!isFundingNews) return;

            seenLinks.add(link);
            const author = "Inc42";
            const date = "";

            articles.push({
                title,
                link,
                author,
                date
            });
        });

        return articles;
    } catch (error: any) {
        console.error("Failed to scrape Inc42:", error.message);
        return [];
    }
};

export default scrapeInc42;
