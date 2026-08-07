import axios from 'axios';
import * as cheerio from 'cheerio';
// import { PrismaClient } from '@prisma/client'; // Removed
import { prismaInstance } from '@repo/db';
import { logOperationalEvent } from "./serviceHealthLogger";
import { parseBooleanEnv } from "../utils/envUtils";
import dotenv from 'dotenv';

dotenv.config();

// const prisma = new PrismaClient(); // Removed
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY; // Need to add to env
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX; // Need to add to env
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
// The no-API-key fallback scrapes DuckDuckGo/Bing directly with cheerio. In practice
// this has been observed to fail 100% of the time (every request times out) while
// still taking ~12s x up to 8 requests per company — slow enough to exhaust a
// serverless Postgres connection mid-sync. Off by default until GOOGLE_SEARCH_API_KEY
// is configured; set ENRICHMENT_WEB_FALLBACK_ENABLED=true to opt back in.
const WEB_FALLBACK_ENABLED = parseBooleanEnv(process.env.ENRICHMENT_WEB_FALLBACK_ENABLED, false);
const DEFAULT_HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml",
};

interface EnrichedCompanyData {
    domain?: string;
    website?: string;
    linkedin_url?: string;
    twitter_url?: string;
    facebook_url?: string;
    instagram_url?: string;
    crunchbase_url?: string;
    email?: string;
    phone?: string;
    address_line?: string;
    description?: string;
    logo_url?: string;
    map_url?: string;
    rating?: number;
    total_ratings?: number;
    opening_hours?: string[];
    business_status?: string;
    types?: string[];
    plus_code?: string;
    photo_reference?: string;
    locationLat?: number;
    locationLng?: number;
}

type CompanyEnrichmentTarget = {
    id: string;
    name: string;
    address?: string | null;
    city?: string | null;
    website?: string | null;
};

export class CompanyEnrichmentService {
    private normalizeText(value: string | null | undefined): string {
        return String(value || "")
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    private tokenizeName(value: string | null | undefined): string[] {
        return this.normalizeText(value)
            .replace(/\b(private|limited|pvt|ltd|llp|inc|corp|corporation|technologies|technology|solutions|services|branch|tower|apartment|work|place|road|main|office|park|tech)\b/g, " ")
            .split(" ")
            .map((token) => token.trim())
            .filter((token) => token.length >= 3);
    }

    private normalizeCompanyQuery(companyName: string, addressHint?: string, locationHint?: string): string {
        return [
            companyName,
            addressHint,
            locationHint,
            "official site company website",
        ]
            .filter(Boolean)
            .join(" ");
    }

    private normalizeUrl(rawUrl: string): string | null {
        const raw = String(rawUrl || "").trim();
        if (!raw) return null;
        try {
            if (raw.startsWith("/")) {
                return null;
            }
            return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).toString();
        } catch {
            return null;
        }
    }

    private extractSearchResultUrl(rawUrl: string): string | null {
        const raw = String(rawUrl || "").trim();
        if (!raw) return null;

        try {
            if (/^https?:\/\//i.test(raw)) {
                const parsed = new URL(raw);
                const uddg = parsed.searchParams.get("uddg");
                const target = parsed.searchParams.get("target");
                return this.normalizeUrl(uddg || target || raw);
            }

            if (raw.startsWith("//")) {
                return this.normalizeUrl(`https:${raw}`);
            }
        } catch {
            return this.normalizeUrl(raw);
        }

        return this.normalizeUrl(raw);
    }

    private getHostname(url: string): string | null {
        try {
            return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
        } catch {
            return null;
        }
    }

    private scoreWebsiteCandidate(url: string, companyName: string, addressHint?: string, locationHint?: string): number {
        const hostname = this.getHostname(url) || "";
        if (!hostname || this.isSocialOrAggregator(hostname)) return -1;

        const companyTokens = this.tokenizeName(companyName);

        const contextText = `${addressHint || ""} ${locationHint || ""}`.toLowerCase();
        let score = 0;

        for (const token of companyTokens) {
            if (hostname.includes(token)) {
                score += 3;
            }
        }

        if (contextText && hostname.split(".").some((part) => contextText.includes(part))) {
            score += 1;
        }

        if (/\bcontact|about|careers|linkedin|facebook|instagram|twitter|x\.com\b/i.test(url)) {
            score -= 2;
        }

        return score;
    }

    private async verifyWebsiteCandidate(
        url: string,
        companyName: string,
        addressHint?: string,
        locationHint?: string,
    ): Promise<number> {
        try {
            const response = await axios.get(url, {
                timeout: 10000,
                headers: DEFAULT_HEADERS,
                responseType: "text",
                maxRedirects: 5,
                validateStatus: (status) => status >= 200 && status < 400,
            });

            const html = typeof response.data === "string" ? response.data : "";
            if (!html) return -1;

            const $ = cheerio.load(html);
            const pageText = this.normalizeText(
                [
                    $("title").text(),
                    $('meta[name="description"]').attr("content"),
                    $('meta[property="og:description"]').attr("content"),
                    $("body").text().slice(0, 4000),
                ]
                    .filter(Boolean)
                    .join(" "),
            );

            const companyTokens = this.tokenizeName(companyName);
            const addressTokens = this.tokenizeName(addressHint || "");
            const locationTokens = this.tokenizeName(locationHint || "");

            let score = this.scoreWebsiteCandidate(url, companyName, addressHint, locationHint);

            for (const token of companyTokens) {
                if (pageText.includes(token)) {
                    score += 4;
                }
            }

            const matchedAddressTokens = addressTokens.filter((token) => pageText.includes(token)).length;
            const matchedLocationTokens = locationTokens.filter((token) => pageText.includes(token)).length;

            score += Math.min(4, matchedAddressTokens);
            score += Math.min(2, matchedLocationTokens);

            const hostname = this.getHostname(url) || "";
            if (companyTokens.some((token) => hostname.includes(token))) {
                score += 3;
            }

            return score;
        } catch {
            return this.scoreWebsiteCandidate(url, companyName, addressHint, locationHint);
        }
    }

    private async searchWithoutApi(
        companyName: string,
        locationHint?: string,
        addressHint?: string,
    ): Promise<EnrichedCompanyData> {
        if (!WEB_FALLBACK_ENABLED) {
            logOperationalEvent("enrichment.search.fallback_skipped", { companyName });
            return {};
        }

        const data: EnrichedCompanyData = {};
        const queries = [
            this.normalizeCompanyQuery(companyName, addressHint, locationHint),
            [companyName, addressHint, "official website"].filter(Boolean).join(" "),
            [companyName, locationHint, "company website"].filter(Boolean).join(" "),
            [`"${companyName}"`, addressHint, locationHint].filter(Boolean).join(" "),
        ];

        const collectedCandidates = new Set<string>();

        for (const query of queries) {
            const searchUrls = [
                `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
                `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
            ];

            // Run both search engines for this query concurrently rather than
            // sequentially — halves the worst-case wall-clock time per query.
            await Promise.all(searchUrls.map(async (searchUrl) => {
                try {
                    const response = await axios.get(searchUrl, {
                        timeout: 6000,
                        headers: DEFAULT_HEADERS,
                        responseType: "text",
                    });

                    const $ = cheerio.load(typeof response.data === "string" ? response.data : "");

                    $("a[href]").each((_, element) => {
                        const href = $(element).attr("href");
                        const normalized = this.extractSearchResultUrl(String(href || ""));
                        if (!normalized) return;
                        collectedCandidates.add(normalized);
                    });
                } catch (error) {
                    logOperationalEvent("enrichment.search.fallback_error", {
                        companyName,
                        searchUrl,
                        error: (error as Error).message,
                    }, "warn");
                }
            }));

            // Already have viable candidates — no need to burn time on more query variants.
            if (collectedCandidates.size >= 4) break;
        }

        const rankedCandidates = await Promise.all(
            Array.from(collectedCandidates)
                .slice(0, 12)
                .map(async (url) => ({
                    url,
                    score: await this.verifyWebsiteCandidate(url, companyName, addressHint, locationHint),
                })),
        );

        const bestCandidate = rankedCandidates
            .filter((entry) => entry.score >= 4)
            .sort((left, right) => right.score - left.score)[0];

        if (bestCandidate?.url) {
            data.domain = this.getHostname(bestCandidate.url) || undefined;
            if (data.domain) {
                logOperationalEvent("enrichment.search.fallback_success", {
                    companyName,
                    locationHint,
                    addressHint,
                    url: bestCandidate.url,
                    score: bestCandidate.score,
                });
                return data;
            }
        }

        return data;
    }

    /**
     * Searches for a company's official website and social media profiles.
     */
    async findCompanyWebPresence(
        companyName: string,
        locationHint?: string,
        addressHint?: string,
    ): Promise<EnrichedCompanyData> {
        logOperationalEvent("enrichment.search.started", { companyName, locationHint, addressHint });

        // If no API key, return empty (or implement fallback scraping if allowed)
        if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_CX) {
            logOperationalEvent("enrichment.search.api_key_missing", { companyName });
            return this.searchWithoutApi(companyName, locationHint, addressHint);
        }

        const data: EnrichedCompanyData = {};

        try {
            // Search Query: "Company Name official site linkedin twitter facebook"
            const query = [
                this.normalizeCompanyQuery(companyName, addressHint, locationHint),
                "linkedin twitter facebook crunchbase",
            ].join(" ");
            const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_CX}&q=${encodeURIComponent(query)}`;

            const response = await axios.get(url);
            const items = response.data.items || [];

            for (const item of items) {
                const link = item.link as string;
                if (!link || /\b(intent\/tweet|sharer|share\.php|dialog\/(feed|share))\b/i.test(link)) continue;

                // Identify Socials
                if (link.includes('linkedin.com/company/')) data.linkedin_url = link;
                else if (link.includes('twitter.com/') || link.includes('x.com/')) data.twitter_url = link;
                else if (link.includes('facebook.com/')) data.facebook_url = link;
                else if (link.includes('instagram.com/')) data.instagram_url = link;
                else if (link.includes('crunchbase.com/organization/')) data.crunchbase_url = link;

                // Identify Official Website (heuristic: not a social media or news site)
                // This is a naive check; a better one would check the domain against the company name
                else if (!data.domain && !this.isSocialOrAggregator(link)) {
                    data.domain = new URL(link).hostname.replace('www.', '');
                }
            }
        } catch (error) {
            logOperationalEvent("enrichment.search.error", { companyName, error: (error as Error).message });
        }

        if (!data.domain) {
            const fallbackData = await this.searchWithoutApi(companyName, locationHint, addressHint);
            if (fallbackData.domain) {
                return { ...data, ...fallbackData };
            }
        }

        return data;
    }

    /**
     * Scrapes the company's website for contact info.
     */
    async scrapeCompanyWebsite(domain: string): Promise<Partial<EnrichedCompanyData>> {
        if (!domain) return {};
        logOperationalEvent("enrichment.scrape.started", { domain });

        const data: Partial<EnrichedCompanyData> = {};

        try {
            const response = await axios.get(`https://${domain}`, {
                timeout: 5000,
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CompanyBot/1.0)' }
            });
            const $ = cheerio.load(response.data);

            // Emails (simple regex)
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            const emails = $('body').text().match(emailRegex);
            if (emails && emails.length > 0) {
                // Filter out common false positives
                const validEmails = emails.filter(e => !e.endsWith('.png') && !e.endsWith('.jpg') && !e.includes('example.com'));
                if (validEmails.length > 0) data.email = validEmails[0]; // Take the first valid one
            }

            // Social links on homepage. Corporate sites are full of "share this page"
            // widgets pointing at twitter.com/facebook.com/etc — those look like a
            // real profile link by domain alone but are share actions, not the
            // company's own profile, so they're explicitly excluded below.
            const isShareWidgetLink = (href: string): boolean =>
                /\b(intent\/tweet|share|sharer|share\.php|dialog\/(feed|share))\b/i.test(href);

            $('a[href]').each((_, el) => {
                const href = $(el).attr('href');
                if (!href || isShareWidgetLink(href)) return;

                if (href.includes('linkedin.com/company') && !data.linkedin_url) data.linkedin_url = href;
                if ((href.includes('twitter.com') || href.includes('x.com')) && !data.twitter_url) data.twitter_url = href;
                if (href.includes('facebook.com') && !data.facebook_url) data.facebook_url = href;
                if (href.includes('instagram.com') && !data.instagram_url) data.instagram_url = href;
            });

            // Meta Description
            const metaDesc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content');
            if (metaDesc) data.description = metaDesc;

        } catch (error) {
            logOperationalEvent("enrichment.scrape.error", { domain, error: (error as Error).message });
        }

        return data;
    }

    isSocialOrAggregator(url: string): boolean {
        const domains = [
            'linkedin.com', 'twitter.com', 'facebook.com', 'instagram.com', 'crunchbase.com',
            'youtube.com', 'medium.com', 'wikipedia.org', 'glassdoor.com', 'indeed.com',
            'bloomberg.com', 'techcrunch.com', 'forbes.com', 'inc.com'
        ];
        return domains.some(d => url.includes(d));
    }

    /**
     * Fetches details from Google Maps (Places API).
     * Note: Requires GOOGLE_MAPS_API_KEY.
     */
    async fetchGoogleMapsDetails(companyName: string, location?: string): Promise<Partial<EnrichedCompanyData>> {
        logOperationalEvent("enrichment.maps.started", { companyName, location });
        if (!GOOGLE_API_KEY) {
            return {};
        }

        try {
            const query = [companyName, location].filter(Boolean).join(" ");
            const searchResponse = await axios.get(
                "https://maps.googleapis.com/maps/api/place/textsearch/json",
                {
                    params: {
                        key: GOOGLE_API_KEY,
                        query,
                    },
                    timeout: 12000,
                },
            );

            const results = Array.isArray(searchResponse.data?.results)
                ? searchResponse.data.results
                : [];
            const first = results[0];
            if (!first?.place_id) {
                return {};
            }

            const detailsResponse = await axios.get(
                "https://maps.googleapis.com/maps/api/place/details/json",
                {
                    params: {
                        key: GOOGLE_API_KEY,
                        place_id: first.place_id,
                        fields: [
                            "place_id",
                            "name",
                            "formatted_address",
                            "geometry",
                            "website",
                            "formatted_phone_number",
                            "international_phone_number",
                            "opening_hours",
                            "rating",
                            "user_ratings_total",
                            "types",
                            "business_status",
                            "plus_code",
                            "url",
                            "photos",
                        ].join(","),
                    },
                    timeout: 12000,
                },
            );

            const details = detailsResponse.data?.result;
            if (!details) {
                return {};
            }

            return {
                website: details.website || undefined,
                map_url: details.url || undefined,
                phone: details.formatted_phone_number || details.international_phone_number || undefined,
                rating: typeof details.rating === "number" ? details.rating : undefined,
                total_ratings: Number.isFinite(Number(details.user_ratings_total))
                    ? Number(details.user_ratings_total)
                    : undefined,
                opening_hours: Array.isArray(details.opening_hours?.weekday_text)
                    ? details.opening_hours.weekday_text
                    : undefined,
                business_status: typeof details.business_status === "string"
                    ? details.business_status
                    : undefined,
                types: Array.isArray(details.types) ? details.types : undefined,
                plus_code: details.plus_code?.global_code || undefined,
                photo_reference: details.photos?.[0]?.photo_reference || undefined,
                address_line: details.formatted_address || undefined,
                locationLat: typeof details.geometry?.location?.lat === "number"
                    ? details.geometry.location.lat
                    : undefined,
                locationLng: typeof details.geometry?.location?.lng === "number"
                    ? details.geometry.location.lng
                    : undefined,
            };
        } catch (error) {
            logOperationalEvent("enrichment.maps.error", {
                companyName,
                location,
                error: (error as Error).message,
            }, "warn");
            return {};
        }
    }

    /**
     * Main entry point to enrich a company.
     */
    async enrichCompany(companyName: string): Promise<void> {
        // 1. Check DB
        let company = await prismaInstance.techParkCompany.findFirst({ where: { name: companyName } });

        // 2. Search Web
        const webData = await this.findCompanyWebPresence(companyName);

        // 3. Scrape Website (if domain found)
        let siteData: Partial<EnrichedCompanyData> = {};
        if (webData.domain) {
            siteData = await this.scrapeCompanyWebsite(webData.domain);
        }

        // 4. Google Maps (Optional)
        const mapsData = await this.fetchGoogleMapsDetails(companyName);

        // 5. Merge Data
        const mergedData = { ...webData, ...siteData, ...mapsData };

        // 6. Update/Create DB
        // Note: Creating a standalone company without a TechPark might not be valid depending on schema constraints (newTechParkId is optional but relationship exists).
        // For enrichment, we likely only want to update existing companies or create if we know the TechPark. 
        // Assuming this service is for enriching EXISTING companies for now.

        if (company) {
            await prismaInstance.techParkCompany.update({
                where: { id: company.id },
                data: {
                    website: mergedData.domain ? `https://${mergedData.domain}` : undefined, // domain is usually just hostname
                    description: mergedData.description,
                    contact_email: mergedData.email,
                    contact_phone: mergedData.phone,
                    // Map other fields as needed and available in TechParkCompany
                    // updated_at: new Date() // handled by @updatedAt
                }
            });
            logOperationalEvent("enrichment.complete", { companyName });
        } else {
            logOperationalEvent("enrichment.company_not_found_in_db", { companyName });
        }
    }

    async enrichCompanyRecord(company: CompanyEnrichmentTarget, locationHint?: string): Promise<{
        website?: string;
        description?: string;
        contact_email?: string;
        contact_phone?: string;
        map_url?: string;
        rating?: number;
        total_ratings?: number;
        opening_hours?: string[];
        business_status?: string;
        types?: string[];
        plus_code?: string;
        photo_reference?: string;
        address?: string;
        locationLat?: number;
        locationLng?: number;
        linkedin_url?: string;
        twitter_url?: string;
        facebook_url?: string;
        instagram_url?: string;
        crunchbase_url?: string;
    }> {
        const addressHint = company.address || undefined;
        const webData = await this.findCompanyWebPresence(company.name, locationHint, addressHint);
        const mapsData = await this.fetchGoogleMapsDetails(
            company.name,
            [addressHint, locationHint].filter(Boolean).join(" "),
        );

        const website =
            company.website ||
            mapsData.website ||
            (webData.domain ? `https://${webData.domain}` : undefined);

        let siteData: Partial<EnrichedCompanyData> = {};
        if (website) {
            try {
                const hostname = new URL(website).hostname.replace(/^www\./i, "");
                siteData = await this.scrapeCompanyWebsite(hostname);
            } catch {
                siteData = {};
            }
        }

        return {
            website,
            description: siteData.description || mapsData.description || webData.description,
            contact_email: siteData.email || mapsData.email || webData.email,
            contact_phone: siteData.phone || mapsData.phone || webData.phone,
            map_url: mapsData.map_url,
            rating: mapsData.rating,
            total_ratings: mapsData.total_ratings,
            opening_hours: mapsData.opening_hours,
            business_status: mapsData.business_status,
            types: mapsData.types,
            plus_code: mapsData.plus_code,
            photo_reference: mapsData.photo_reference,
            address: mapsData.address_line,
            locationLat: mapsData.locationLat,
            locationLng: mapsData.locationLng,
            // Prefer links scraped directly off the company's own site (siteData) over
            // ones guessed from search results (webData) — the site is verified, the
            // search result is a heuristic match.
            linkedin_url: siteData.linkedin_url || webData.linkedin_url,
            twitter_url: siteData.twitter_url || webData.twitter_url,
            facebook_url: siteData.facebook_url || webData.facebook_url,
            instagram_url: siteData.instagram_url || webData.instagram_url,
            crunchbase_url: webData.crunchbase_url,
        };
    }
}

export const findCompanyWebsiteByName = async (
    companyName: string,
    locationHint?: string,
    addressHint?: string,
): Promise<string | null> => {
    const service = new CompanyEnrichmentService();
    const webData = await service.findCompanyWebPresence(companyName, locationHint, addressHint);
    return webData.domain ? `https://${webData.domain}` : null;
};

export const enrichCompanyRecordDetails = async (
    company: CompanyEnrichmentTarget,
    locationHint?: string,
) => {
    const service = new CompanyEnrichmentService();
    return service.enrichCompanyRecord(company, locationHint);
};
