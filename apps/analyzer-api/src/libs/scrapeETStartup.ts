import axios from "axios";
import * as cheerio from "cheerio";

const ET_URL = "https://economictimes.indiatimes.com/tech/funding";

export const scrapeETStartup = async () => {
    try {
        const { data: html } = await axios.get(ET_URL, {
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

        $("h4 a, h3 a").each((_, el) => {
            const title = $(el).text().trim();
            const relativeLink = $(el).attr("href");

            if (!title || !relativeLink) return;

            const link = relativeLink.startsWith("http")
                ? relativeLink
                : `https://economictimes.indiatimes.com${relativeLink}`;
            if (!link.includes("/tech/funding") && !link.includes("/tech/startups") && !link.includes("articleshow")) return;

            const author = "Economic Times";
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
        console.error("Failed to scrape ET Startup:", error.message);
        return [];
    }
};

export default scrapeETStartup;
