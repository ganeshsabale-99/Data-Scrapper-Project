import axios from "axios";
import * as cheerio from "cheerio";

const TECHCRUNCH_URL = "https://techcrunch.com/category/startups/funding/";

export const scrapeTechCrunch = async () => {
    try {
        const { data: html } = await axios.get(TECHCRUNCH_URL, {
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

        // "category/startups/funding/" isn't purely funding news — TechCrunch mixes
        // in event-ticket promos (TC Disrupt, etc.) on the same listing. A keyword
        // filter on the title, same idea as the Inc42/ETStartup scrapers, keeps
        // those out instead of ingesting them as if they were real funding stories.
        const isFundingNews = (title: string): boolean => {
            const lowerTitle = title.toLowerCase();
            return (
                lowerTitle.includes("raise") ||
                lowerTitle.includes("raises") ||
                lowerTitle.includes("funding") ||
                lowerTitle.includes("invest") ||
                lowerTitle.includes("secures") ||
                lowerTitle.includes("capital") ||
                lowerTitle.includes("series ") ||
                lowerTitle.includes("valuation") ||
                lowerTitle.includes("fund") ||
                lowerTitle.includes("seed round") ||
                lowerTitle.includes("acquire") ||
                lowerTitle.includes("acquisition") ||
                lowerTitle.includes("merger")
            );
        };

        $("h2 a, h3 a").each((_, el) => {
            const title = $(el).text().trim();
            const relativeLink = $(el).attr("href");

            if (!title || !relativeLink || !isFundingNews(title)) return;

            const link = relativeLink.startsWith("http")
                ? relativeLink
                : `https://techcrunch.com${relativeLink}`;

            if (seenLinks.has(link)) return;
            seenLinks.add(link);

            const container = $(el).closest("div");
            const author = container.find("a[href*='/author/']").text().trim() || "";

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
        console.error("Failed to scrape TechCrunch:", error.message);
        return [];
    }
};

export default scrapeTechCrunch;
