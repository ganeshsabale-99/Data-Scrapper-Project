import axios from "axios";
import * as cheerio from "cheerio";

const VCCIRCLE_URL = "https://www.vccircle.com/deal-type/venture-capital";

export interface ScrapedArticle {
    title: string;
    link: string;
    author?: string;
    date?: string;
}

export const scrapeVCCircle = async (): Promise<ScrapedArticle[]> => {
    try {
        const { data: html } = await axios.get(VCCIRCLE_URL, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
        });

        const $ = cheerio.load(html);
        const articles: ScrapedArticle[] = [];

        $("h4 a").each((_, el) => {
            const title = $(el).text().trim();
            const relativeLink = $(el).attr("href");

            if (!title || !relativeLink) return;

            const link = relativeLink.startsWith("http")
                ? relativeLink
                : `https://www.vccircle.com${relativeLink}`;

            const container = $(el).closest("div");
            const author = container.find(".author-name, .author, a[href*='/author/']").text().trim() || "";

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
        console.error("Failed to scrape VCCircle:", error.message);
        return [];
    }
};

export default scrapeVCCircle;
