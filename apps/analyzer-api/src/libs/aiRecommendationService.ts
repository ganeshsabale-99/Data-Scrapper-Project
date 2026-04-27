import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export interface ExtractedDetails {
    company_name: string | null;
    funding_amount: string | null;
    industry: string | null;
}

export const extractNewsDetails = async (title: string): Promise<ExtractedDetails> => {
    try {
        const prompt = `
      Extract the following details from this funding news title:
      Title: "${title}"
      
      Respond only with a JSON object in this format:
      {
        "company_name": "name of the company that was funded",
        "funding_amount": "amount of funding (e.g. $10M, 50 Crore)",
        "industry": "industry sector (e.g. Fintech, SaaS, E-commerce)"
      }
      If a detail is not present, set it to null.
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]) as ExtractedDetails;
        }

        return { company_name: null, funding_amount: null, industry: null };
    } catch (error) {
        console.error("Gemini extraction failed:", error);
        return { company_name: null, funding_amount: null, industry: null };
    }
};
