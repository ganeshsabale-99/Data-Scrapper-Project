import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer, { type Browser } from "puppeteer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

// ─── Gemini AI Setup ─────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "");
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-3.6-flash" });

export interface CompanyDetails {
    companyName: string;
    website?: string;
    socialLinks: {
        linkedin?: string;
        twitter?: string;
        facebook?: string;
        instagram?: string;
        crunchbase?: string;
    };
    otherLinks: string[];
    description?: string;
}

// ─── Step 0: Use Gemini AI to extract company name from title ────────────────

async function extractCompanyNameWithAI(title: string): Promise<string | null> {
    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) return null;

    try {
        const prompt = `Extract ONLY the specific company or startup name from this funding news headline.

Rules:
- Return ONLY the company/startup name, nothing else
- If the headline mentions a specific company or startup by name, return that name
- If NO specific company or startup name is mentioned (e.g. generic news about students, investors, or industry), return exactly: NONE
- No quotes, no explanation, just the name or NONE

Examples:
- "Zepto raises $200M in Series F" → Zepto
- "Unicorn India Ventures marks final close of third fund" → Unicorn India Ventures
- "Two Stanford students launch $2M startup accelerator" → NONE
- "Indian startups raised $10B in 2024" → NONE
- "PhonePe gets RBI approval for UPI" → PhonePe

Title: "${title}"

Company name:`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text().trim();

        // If AI says NONE, no specific company found
        if (!text || text.toUpperCase() === "NONE" || text.length === 0) {
            return "NONE";
        }

        // Validate: should be short (company names are typically 1-5 words)
        if (text.length > 0 && text.length < 60 && !text.includes("\n")) {
            return text;
        }
        return null;
    } catch (error: any) {
        console.error("Gemini company name extraction failed:", error.message);
        return null;
    }
}

/**
 * Extracts the company name from a funding news title.
 * Uses Gemini AI first, falls back to regex heuristics.
 */
export async function extractCompanyNameSmart(title: string, dbCompanyName?: string): Promise<string> {
    // Priority 1: DB field
    if (dbCompanyName && dbCompanyName.trim()) {
        return dbCompanyName.trim();
    }

    if (!title) return "Unknown Company";

    // Priority 2: Gemini AI extraction
    const aiName = await extractCompanyNameWithAI(title);
    if (aiName) return aiName;

    // Priority 3: Regex fallback
    return extractCompanyNameRegex(title);
}


function extractCompanyNameRegex(title: string): string {
    let cleaned = title
        .replace(/^\[.*?\]\s*/i, "")
        .replace(/^(exclusive|breaking|update|funding alert|deal alert)\s*[:\-–—]\s*/i, "")
        .trim();

    const keywordPattern = /\s+(raises?|secures?|gets?|bags?|closes?|marks?|lands?|nabs?|receives?|grabs?|clinches|nets?|mops?\s*up|acquires?|merges?|announces?|launches?|unveils?|plans?|to\s+raise|in\s+talks?\s+to|plans?\s+to|eyes?|seeks?|funding|series\s+[a-z]|round|seed\s+round|pre-seed)\b/i;
    const parts = cleaned.split(keywordPattern);

    if (parts.length > 1 && parts[0] && parts[0].trim()) {
        cleaned = parts[0].trim();
    }

    cleaned = cleaned.replace(/[\s,;:\-–—]+$/, "").trim();
    if (cleaned.length < 2 || cleaned.length > 100) {
        return title.substring(0, 80);
    }
    return cleaned;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SOURCE_BRANDS = [
    "entrackr", "yourstory", "vccircle", "inc42", "techcrunch",
    "etstartup", "economictimes", "moneycontrol", "livemint",
    "businessstandard", "bloomberg", "forbes", "reuters", "cnbc",
    "ndtv", "thehindu", "startuptalky", "ipoplatform", "startupwired",
];

const NEWS_AND_SOCIAL_DOMAINS = [
    "linkedin.com", "twitter.com", "x.com", "facebook.com", "instagram.com",
    "crunchbase.com", "youtube.com", "medium.com", "wikipedia.org",
    "glassdoor.com", "indeed.com", "bloomberg.com", "techcrunch.com",
    "forbes.com", "inc.com", "entrackr.com", "yourstory.com", "vccircle.com",
    "inc42.com", "economictimes.indiatimes.com", "moneycontrol.com",
    "livemint.com", "ndtv.com", "thehindu.com", "business-standard.com",
    "reuters.com", "cnbc.com", "bing.com",
    "apple.com", "github.com",
    "bit.ly", "t.co", "goo.gl", "tinyurl.com", "msn.com",
];

/** Check if URL belongs to Google (any TLD) */
function isGoogleDomain(url: string): boolean {
    try {
        const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
        // Matches google.com, google.co.in, google.co.uk, google.de, etc.
        return /^google\.[a-z.]+$/.test(hostname) ||
               hostname.endsWith(".google.com") ||
               hostname.includes("googleapis.com") ||
               hostname.includes("gstatic.com");
    } catch {
        return false;
    }
}

function isNewsDomain(url: string): boolean {
    try {
        if (isGoogleDomain(url)) return true;
        const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
        return NEWS_AND_SOCIAL_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
    } catch {
        return false;
    }
}

function belongsToSourceSite(url: string): boolean {
    const lower = url.toLowerCase();
    return SOURCE_BRANDS.some((brand) => lower.includes(`/${brand}`));
}

function categorizeSocial(url: string): string | null {
    const l = url.toLowerCase();
    if (l.includes("linkedin.com/company/") || l.includes("linkedin.com/in/")) return "linkedin";
    if ((l.includes("twitter.com/") || l.includes("x.com/")) && !l.includes("/search")) return "twitter";
    if (l.includes("facebook.com/") && !l.includes("/sharer")) return "facebook";
    if (l.includes("instagram.com/") && !l.includes("/p/")) return "instagram";
    if (l.includes("crunchbase.com/organization/")) return "crunchbase";
    return null;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Step 1: Google Search via Puppeteer ─────────────────────────────────────

async function googleSearchWithPuppeteer(companyName: string): Promise<Partial<CompanyDetails>> {
    const result: Partial<CompanyDetails> = {
        socialLinks: {},
        otherLinks: [],
    };

    let browser: Browser | null = null;

    try {
        browser = await puppeteer.launch({
            headless: "shell",
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-blink-features=AutomationControlled",
            ],
        });

        const page = await browser.newPage();

        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, "webdriver", { get: () => undefined });
        });

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        );
        await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

        // Visit Google homepage first to get cookies
        await page.goto("https://www.google.com", {
            waitUntil: "networkidle2",
            timeout: 10000,
        });
        await sleep(800);

        // Handle consent dialog
        try {
            const btns = await page.$$("button");
            for (const btn of btns) {
                const text = await btn.evaluate((el) => el.textContent || "");
                if (/accept all|i agree|accept/i.test(text)) {
                    await btn.click();
                    await sleep(800);
                    break;
                }
            }
        } catch {
            // no consent needed
        }

        // Search for the company
        const query = `${companyName} official website`;
        await page.goto(
            `https://www.google.com/search?q=${encodeURIComponent(query)}`,
            { waitUntil: "networkidle2", timeout: 15000 }
        );
        await sleep(1500);

        // Check for CAPTCHA
        const currentUrl = page.url();
        if (currentUrl.includes("/sorry/") || currentUrl.includes("captcha")) {
            console.warn("Google CAPTCHA detected, skipping search results.");
            return result;
        }

        // Extract all links from search results
        const links: string[] = await page.evaluate(() => {
            const results: string[] = [];
            document.querySelectorAll("a[href]").forEach((a) => {
                const href = (a as HTMLAnchorElement).href;
                if (
                    href &&
                    href.startsWith("http") &&
                    // Filter out ALL Google domains (google.com, google.co.in, etc.)
                    !/google\.[a-z.]+/i.test(new URL(href).hostname) &&
                    !href.includes("gstatic.com") &&
                    !href.includes("googleapis.com")
                ) {
                    results.push(href);
                }
            });
            return [...new Set(results)];
        });

        // Categorize links
        const companyLower = companyName.toLowerCase().replace(/\s+/g, "");

        for (const link of links) {
            if (belongsToSourceSite(link)) continue;

            const socialType = categorizeSocial(link);
            if (socialType) {
                const sl = result.socialLinks!;
                if (socialType === "linkedin" && !sl.linkedin) sl.linkedin = link;
                else if (socialType === "twitter" && !sl.twitter) sl.twitter = link;
                else if (socialType === "facebook" && !sl.facebook) sl.facebook = link;
                else if (socialType === "instagram" && !sl.instagram) sl.instagram = link;
                else if (socialType === "crunchbase" && !sl.crunchbase) sl.crunchbase = link;
                continue;
            }

            // Check for company website
            if (!isNewsDomain(link) && !result.website) {
                try {
                    const host = new URL(link).hostname.toLowerCase().replace(/^www\./, "");
                    const domainRoot = host.split(".")[0] || "";
                    if (
                        domainRoot.includes(companyLower) ||
                        companyLower.includes(domainRoot) ||
                        host.includes(companyLower)
                    ) {
                        result.website = link.split("?")[0] || link;
                    }
                } catch {
                    // skip
                }
            }
        }

        // Fallback: take first non-social, non-news link as website
        if (!result.website) {
            const candidate = links.find(
                (l) => !isNewsDomain(l) && !categorizeSocial(l) && !belongsToSourceSite(l)
            );
            if (candidate) {
                result.website = candidate.split("?")[0] || candidate;
            }
        }
    } catch (error: any) {
        console.error(`Puppeteer Google search failed for "${companyName}":`, error.message);
    } finally {
        if (browser) {
            await browser.close().catch(() => {});
        }
    }

    return result;
}

// ─── Step 2: Scrape company website for description ──────────────────────────

async function scrapeCompanyWebsite(websiteUrl: string): Promise<string | undefined> {
    try {
        const { data: html } = await axios.get(websiteUrl, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            },
            timeout: 8000,
            maxRedirects: 3,
        });

        const $ = cheerio.load(html);

        const description =
            $('meta[name="description"]').attr("content") ||
            $('meta[property="og:description"]').attr("content") ||
            "";

        if (description && description.trim().length > 10) {
            return description.trim();
        }

        let firstP = "";
        $("main p, #content p, .about p, section p, body p").each((_, el) => {
            const text = $(el).text().trim();
            if (!firstP && text.length > 50 && text.length < 500) {
                firstP = text;
            }
        });

        return firstP || undefined;
    } catch (error: any) {
        console.error(`Failed to scrape company website ${websiteUrl}:`, error.message);
        return undefined;
    }
}


// ─── Main entry point ────────────────────────────────────────────────────────

/**
 * Scrapes company details using:
 * 1) Gemini AI → extract company name from title
 * 2) Puppeteer + Google Search → find company website + social profiles
 * 3) Company's own website → get company description
 */
export async function scrapeCompanyDetails(
    articleUrl: string,
    companyName: string
): Promise<CompanyDetails> {
    const details: CompanyDetails = {
        companyName,
        socialLinks: {},
        otherLinks: [],
    };

    // If no specific company name was identified (NONE or empty), return early
    if (!companyName || companyName === "NONE" || companyName === "Unknown Company") {
        console.log(`[CompanyDetails] No specific company name found in title, skipping search.`);
        details.companyName = "Unknown";
        return details;
    }

    console.log(`[CompanyDetails] Searching for: "${companyName}"`);

    // Step 1: Google search for website + social links
    const searchResults = await googleSearchWithPuppeteer(companyName);

    // Merge search results
    if (searchResults.website) details.website = searchResults.website;
    if (searchResults.socialLinks) {
        details.socialLinks = { ...details.socialLinks, ...searchResults.socialLinks };
    }

    // Step 2: Scrape company website for description
    if (details.website) {
        const description = await scrapeCompanyWebsite(details.website);
        if (description) details.description = description;
    }

    console.log(`[CompanyDetails] Results for "${companyName}": website=${details.website || 'none'}, linkedin=${details.socialLinks.linkedin || 'none'}`);

    return details;
}

export default scrapeCompanyDetails;
