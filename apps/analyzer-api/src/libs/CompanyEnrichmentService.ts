import axios from 'axios';
import * as cheerio from 'cheerio';
// import { PrismaClient } from '@prisma/client'; // Removed
import { prismaInstance } from '@repo/db';
import { logOperationalEvent } from "./serviceHealthLogger";
import dotenv from 'dotenv';

dotenv.config();

// const prisma = new PrismaClient(); // Removed
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY; // Need to add to env
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX; // Need to add to env

interface EnrichedCompanyData {
    domain?: string;
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
}

export class CompanyEnrichmentService {

    /**
     * Searches for a company's official website and social media profiles.
     */
    async findCompanyWebPresence(companyName: string): Promise<EnrichedCompanyData> {
        logOperationalEvent("enrichment.search.started", { companyName });

        // If no API key, return empty (or implement fallback scraping if allowed)
        if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_CX) {
            logOperationalEvent("enrichment.search.api_key_missing", { companyName });
            return {};
        }

        const data: EnrichedCompanyData = {};

        try {
            // Search Query: "Company Name official site linkedin twitter facebook"
            const query = `${companyName} official site linkedin twitter facebook crunchbase`;
            const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_CX}&q=${encodeURIComponent(query)}`;

            const response = await axios.get(url);
            const items = response.data.items || [];

            for (const item of items) {
                const link = item.link as string;
                if (!link) continue;

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

            // Social links on homepage
            $('a[href]').each((_, el) => {
                const href = $(el).attr('href');
                if (!href) return;

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
        logOperationalEvent("enrichment.maps.started", { companyName });
        // Placeholder for actual Places API call
        // In a real implementation:
        // 1. Text Search to get Place ID
        // 2. Place Details to get info

        // For now, we return empty object as we might not have the API key enabled yet
        return {};
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
}
