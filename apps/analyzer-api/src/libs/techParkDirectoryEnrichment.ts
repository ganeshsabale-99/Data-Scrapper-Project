import axios from "axios";
import * as cheerio from "cheerio";
import { prismaInstance } from "@repo/db";
import { logOperationalEvent } from "./serviceHealthLogger";

// Website-based enrichment (techParkWebsiteEnrichment.ts) only fills
// builder/property-manager/SPOC/floor data when the tech park has a
// discoverable official website. Most smaller campuses never have one —
// this module fills the same fields from whatever the open web says about
// the campus by name (directory listings, news coverage, tenant blog posts),
// instead of giving up when there's no website to scrape.

export interface TechParkDirectoryTarget {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
}

type DirectoryFindings = {
  builder_name?: string | null;
  property_manager_name?: string | null;
  property_manager_phone?: string | null;
  security_agency_name?: string | null;
  spoc_name?: string | null;
  total_floors?: number | null;
  basement_levels?: number | null;
};

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
};

const MAX_QUERIES = 4;
const MAX_RESULTS_PER_QUERY = 2;

const cleanText = (value: string | null | undefined): string | null => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized || null;
};

const normalizePhone10 = (value: string | null | undefined): string | null => {
  const digits = String(value || "").replace(/[^\d]/g, "");
  if (!digits) return null;
  return digits.length > 10 ? digits.slice(-10) : digits;
};

const unique = <T>(values: T[]): T[] => Array.from(new Set(values));

const extractLabelValue = (text: string, labelPatterns: string[]): string | null => {
  for (const label of labelPatterns) {
    const regex = new RegExp(`${label}\\s*(?:is|:|-)\\s*([^\\n\\r|.]{2,120})`, "i");
    const match = text.match(regex);
    if (match?.[1]) return cleanText(match[1]);
  }
  return null;
};

const extractPhoneByLabel = (text: string, labelPatterns: string[]): string | null => {
  for (const label of labelPatterns) {
    const regex = new RegExp(`${label}[\\s:\\-]*((?:\\+?\\d[\\d\\s\\-()]{8,}\\d))`, "i");
    const match = text.match(regex);
    if (match?.[1]) return normalizePhone10(match[1]);
  }
  return null;
};

// Matches "G+12 floors", "12 floors", "14 storeys", "basement + 2 levels" etc.
const extractFloorCounts = (text: string): { totalFloors: number | null; basementLevels: number | null } => {
  let totalFloors: number | null = null;
  let basementLevels: number | null = null;

  const groundPlusMatch = text.match(/\bG\s*\+\s*(\d{1,2})\b/i);
  const floorsMatch = text.match(/\b(\d{1,2})\s*(?:floors|storeys|stories)\b/i);
  const basementMatch = text.match(/\b(\d{1,2})\s*(?:basement levels?|basements)\b/i);

  if (groundPlusMatch?.[1]) totalFloors = parseInt(groundPlusMatch[1], 10) + 1;
  else if (floorsMatch?.[1]) totalFloors = parseInt(floorsMatch[1], 10);

  if (basementMatch?.[1]) basementLevels = parseInt(basementMatch[1], 10);

  return { totalFloors, basementLevels };
};

const extractSearchResultUrl = (rawUrl: string | null | undefined): string | null => {
  const raw = String(rawUrl || "").trim();
  if (!raw) return null;
  try {
    if (/^https?:\/\//i.test(raw)) {
      const parsed = new URL(raw);
      const uddg = parsed.searchParams.get("uddg");
      return uddg || raw;
    }
    if (raw.startsWith("//")) return `https:${raw}`;
  } catch {
    return raw;
  }
  return raw;
};

const runSearchQuery = async (query: string): Promise<string[]> => {
  const urls = new Set<string>();
  try {
    const response = await axios.get("https://html.duckduckgo.com/html/", {
      params: { q: query },
      timeout: 12000,
      headers: DEFAULT_HEADERS,
      responseType: "text",
    });
    const $ = cheerio.load(typeof response.data === "string" ? response.data : "");
    $("a.result__a, a[href]").each((_, element) => {
      if (urls.size >= MAX_RESULTS_PER_QUERY) return;
      const candidate = extractSearchResultUrl($(element).attr("href"));
      if (candidate && /^https?:\/\//i.test(candidate)) urls.add(candidate);
    });
  } catch (error) {
    logOperationalEvent(
      "techpark.directory_search.query_failed",
      { query, error: error instanceof Error ? error.message : String(error) },
      "warn",
    );
  }
  return Array.from(urls).slice(0, MAX_RESULTS_PER_QUERY);
};

const fetchPageText = async (url: string): Promise<string> => {
  try {
    const response = await axios.get(url, {
      timeout: 12000,
      maxRedirects: 5,
      headers: DEFAULT_HEADERS,
      responseType: "text",
      validateStatus: (status) => status >= 200 && status < 400,
    });
    const html = typeof response.data === "string" ? response.data : "";
    if (!html) return "";
    return cheerio.load(html)("body").text().replace(/\s+/g, " ").trim().slice(0, 6000);
  } catch {
    return "";
  }
};

export const findTechParkDirectoryDetails = async (
  target: TechParkDirectoryTarget,
): Promise<DirectoryFindings> => {
  const locationHint = [target.city, target.state].filter(Boolean).join(", ");
  const queries = [
    `"${target.name}" builder OR developer ${locationHint}`,
    `"${target.name}" property manager OR facility manager ${locationHint}`,
    `"${target.name}" total floors OR "no of floors" ${locationHint}`,
    `"${target.name}" security agency ${locationHint}`,
  ].slice(0, MAX_QUERIES);

  const pageUrls = unique((await Promise.all(queries.map(runSearchQuery))).flat());
  const pageTexts = await Promise.all(pageUrls.map(fetchPageText));
  const combinedText = pageTexts.filter(Boolean).join(" \n ");

  if (!combinedText) return {};

  const { totalFloors, basementLevels } = extractFloorCounts(combinedText);

  return {
    builder_name: extractLabelValue(combinedText, ["builder", "developed by", "developer"]),
    property_manager_name: extractLabelValue(combinedText, [
      "property manager",
      "facility manager",
      "estate manager",
    ]),
    property_manager_phone: extractPhoneByLabel(combinedText, [
      "property manager",
      "facility manager",
    ]),
    security_agency_name: extractLabelValue(combinedText, [
      "security agency",
      "security provided by",
      "security services by",
    ]),
    spoc_name: extractLabelValue(combinedText, ["spoc", "single point of contact"]),
    total_floors: totalFloors,
    basement_levels: basementLevels,
  };
};

export const enrichTechParkDirectoryDetails = async (target: TechParkDirectoryTarget) => {
  const existing = await prismaInstance.newTechPark.findUnique({
    where: { id: target.id },
    select: {
      builder_name: true,
      property_manager_name: true,
      property_manager_phone: true,
      security_agency_name: true,
      spoc_name: true,
      total_floors: true,
      basement_levels: true,
    },
  });
  if (!existing) {
    return { success: false as const, message: "Tech park not found.", data: null };
  }

  const findings = await findTechParkDirectoryDetails(target);

  // Never overwrite a value that's already known (manually entered or
  // filled by an earlier enrichment pass) — only fill genuine gaps.
  const updateData: Record<string, string | number | null> = {};
  if (!existing.builder_name && findings.builder_name) updateData.builder_name = findings.builder_name;
  if (!existing.property_manager_name && findings.property_manager_name)
    updateData.property_manager_name = findings.property_manager_name;
  if (!existing.property_manager_phone && findings.property_manager_phone)
    updateData.property_manager_phone = findings.property_manager_phone;
  if (!existing.security_agency_name && findings.security_agency_name)
    updateData.security_agency_name = findings.security_agency_name;
  if (!existing.spoc_name && findings.spoc_name) updateData.spoc_name = findings.spoc_name;
  if (existing.total_floors == null && findings.total_floors != null)
    updateData.total_floors = findings.total_floors;
  if (existing.basement_levels == null && findings.basement_levels != null)
    updateData.basement_levels = findings.basement_levels;

  if (Object.keys(updateData).length === 0) {
    return {
      success: true as const,
      message: "No new details found on the open web for this tech park.",
      data: null,
    };
  }

  const updated = await prismaInstance.newTechPark.update({
    where: { id: target.id },
    data: updateData,
  });

  logOperationalEvent("techpark.directory_enrichment.completed", {
    techParkId: target.id,
    updatedFields: Object.keys(updateData),
  });

  return {
    success: true as const,
    message: `Found ${Object.keys(updateData).length} new detail(s) from web search.`,
    data: updated,
  };
};
