import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "");
// gemini-1.5-flash 404s against this API key/project — gemini-2.0-flash is the
// model actually available and used successfully elsewhere in this codebase
// (scrapeCompanyDetails.ts).
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export interface DetailedFundingInfo {
    company_name: string | null;
    funding_amount: string | null;
    industry: string | null;
    round: string | null;
    investors: string[];
    location: string | null;
    founders: string[];
}

export const extractDetailedFundingInfo = async (content: string): Promise<DetailedFundingInfo> => {
    if (!content || content.length < 50) {
        return {
            company_name: null,
            funding_amount: null,
            industry: null,
            round: null,
            investors: [],
            location: null,
            founders: []
        };
    }

    try {
        const prompt = `
      Analyze the following news article content and extract structured funding information.
      
      Article Content:
      "${content.substring(0, 4000)}" 
      
      (Content truncated to 4000 chars for efficiency)

      Respond ONLY with a valid JSON object with the following keys:
      - company_name: Name of the startup/company raising funds.
      - funding_amount: The amount raised (e.g. "$10M", "INR 50 Cr", "Undisclosed").
      - industry: The sector or industry (e.g. "Fintech", "SaaS").
      - round: The funding round (e.g. "Series A", "Seed", "Pre-Series A").
      - investors: An array of strings listing the investors participating in this round.
      - location: City or location of the startup (e.g. "Bengaluru", "Delhi NCR").
      - founders: An array of strings listing the founders mentioned.

      If a field is not found or ambiguous, use null (or empty array for lists).
      ensure the JSON is valid and has no markdown formatting like \`\`\`json.
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();

        const jsonMatch = text.match(/\{[\s\S]*\}?$/); // Try to match valid JSON
        // Simple JSON parse
        try {
            const data = JSON.parse(text);
            return {
                company_name: data.company_name || null,
                funding_amount: data.funding_amount || null,
                industry: data.industry || null,
                round: data.round || null,
                investors: Array.isArray(data.investors) ? data.investors : [],
                location: data.location || null,
                founders: Array.isArray(data.founders) ? data.founders : []
            };
        } catch (e) {
            console.warn("Failed to parse Gemini response as JSON:", text);
            return {
                company_name: null,
                funding_amount: null,
                industry: null,
                round: null,
                investors: [],
                location: null,
                founders: []
            };
        }
    } catch (error) {
        console.error("Gemini detailed extraction failed:", error);
        return {
            company_name: null,
            funding_amount: null,
            industry: null,
            round: null,
            investors: [],
            location: null,
            founders: []
        };
    }
};
