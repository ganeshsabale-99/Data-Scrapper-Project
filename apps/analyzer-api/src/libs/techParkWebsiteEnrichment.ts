import axios from "axios";
import * as cheerio from "cheerio";
import { prismaInstance } from "@repo/db";
import { logOperationalEvent } from "./serviceHealthLogger";
import { scrapeWebsiteImage } from "./scrapeWebsiteImage";

type TechParkWebsiteTarget = {
  id: string;
  place_id?: string | null;
  name: string;
  address_line1?: string | null;
  locality?: string | null;
  city?: string | null;
  state?: string | null;
  website?: string | null;
  contact_page_url?: string | null;
};

type ScrapedTechParkDetails = {
  website?: string | null;
  contact_page_url?: string | null;
  generic_email?: string | null;
  reception_phone?: string | null;
  international_phone?: string | null;
  map_url?: string | null;
  rating?: string | null;
  total_ratings?: string | null;
  business_status?: string | null;
  builder_name?: string | null;
  property_manager_name?: string | null;
  property_manager_phone?: string | null;
  property_manager_email?: string | null;
  spoc_name?: string | null;
  spoc_phone?: string | null;
  photo_url?: string | null;
};

type GooglePlaceDetailsSnapshot = {
  website?: string | null;
  map_url?: string | null;
  reception_phone?: string | null;
  international_phone?: string | null;
  rating?: number | null;
  total_ratings?: number | null;
  business_status?: string | null;
};

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
};

const normalizeUrl = (value: string | null | undefined): string | null => {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).toString();
  } catch {
    return null;
  }
};

const toAbsoluteUrl = (candidate: string | null | undefined, baseUrl: string): string | null => {
  const raw = String(candidate || "").trim();
  if (!raw || raw.startsWith("javascript:") || raw.startsWith("mailto:") || raw.startsWith("tel:")) {
    return null;
  }

  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return null;
  }
};

const normalizePhone10 = (value: string | null | undefined): string | null => {
  const digits = String(value || "").replace(/[^\d]/g, "");
  if (!digits) return null;
  return digits.length > 10 ? digits.slice(-10) : digits;
};

const cleanText = (value: string | null | undefined): string | null => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized || null;
};

const unique = <T>(values: T[]): T[] => Array.from(new Set(values));

const SOCIAL_HOSTS = [
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "wikipedia.org",
];

const isLikelyOfficialWebsite = (url: string): boolean => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return !SOCIAL_HOSTS.some((domain) => host.includes(domain));
  } catch {
    return false;
  }
};

const normalizeText = (value: string | null | undefined): string =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value: string | null | undefined): string[] =>
  normalizeText(value)
    .replace(/\b(tech|park|it|business|campus|tower|apartment|heights|main|road|work|place)\b/g, " ")
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

const extractSearchResultUrl = (rawUrl: string | null | undefined): string | null => {
  const raw = String(rawUrl || "").trim();
  if (!raw) return null;

  try {
    if (/^https?:\/\//i.test(raw)) {
      const parsed = new URL(raw);
      const uddg = parsed.searchParams.get("uddg");
      const target = parsed.searchParams.get("target");
      return normalizeUrl(uddg || target || raw);
    }

    if (raw.startsWith("//")) {
      return normalizeUrl(`https:${raw}`);
    }
  } catch {
    return normalizeUrl(raw);
  }

  return normalizeUrl(raw);
};

const scoreCandidateUrl = (
  url: string,
  target: TechParkWebsiteTarget,
): number => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (!isLikelyOfficialWebsite(url)) return -1;

    const nameTokens = tokenize(target.name);
    const contextTokens = tokenize(`${target.city || ""} ${target.state || ""}`);
    let score = 0;

    for (const token of nameTokens) {
      if (hostname.includes(token)) score += 3;
    }
    for (const token of contextTokens) {
      if (hostname.includes(token)) score += 1;
    }

    if (/\bcontact|about|careers|linkedin|facebook|instagram|twitter|x\.com\b/i.test(url)) {
      score -= 2;
    }

    return score;
  } catch {
    return -1;
  }
};

const verifyCandidateUrl = async (
  url: string,
  target: TechParkWebsiteTarget,
): Promise<number> => {
  try {
    const response = await axios.get(url, {
      timeout: 12000,
      maxRedirects: 5,
      headers: DEFAULT_HEADERS,
      responseType: "text",
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const html = typeof response.data === "string" ? response.data : "";
    if (!html) return -1;

    const $ = cheerio.load(html);
    const pageText = normalizeText(
      [
        $("title").text(),
        $('meta[name="description"]').attr("content"),
        $('meta[property="og:description"]').attr("content"),
        $("body").text().slice(0, 4000),
      ]
        .filter(Boolean)
        .join(" "),
    );

    const nameTokens = tokenize(target.name);
    const cityTokens = tokenize(target.city || "");
    const stateTokens = tokenize(target.state || "");

    let score = scoreCandidateUrl(url, target);
    for (const token of nameTokens) {
      if (pageText.includes(token)) score += 4;
    }
    score += Math.min(2, cityTokens.filter((token) => pageText.includes(token)).length);
    score += Math.min(1, stateTokens.filter((token) => pageText.includes(token)).length);
    return score;
  } catch {
    return scoreCandidateUrl(url, target);
  }
};

const findEmails = (text: string): string[] =>
  unique(
    (text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])
      .map((email) => email.trim().toLowerCase())
      .filter((email) => !email.endsWith(".png") && !email.endsWith(".jpg") && !email.includes("example.com")),
  );

const findPhones = (text: string): string[] =>
  unique(
    (text.match(/(?:\+?\d[\d\s\-()]{8,}\d)/g) || [])
      .map((phone) => normalizePhone10(phone))
      .filter((phone): phone is string => Boolean(phone && phone.length >= 10)),
  );

const extractLabelValue = (text: string, labelPatterns: string[]): string | null => {
  for (const label of labelPatterns) {
    const regex = new RegExp(`${label}\\s*[:\\-]\\s*([^\\n\\r|]{2,120})`, "i");
    const match = text.match(regex);
    if (match?.[1]) {
      return cleanText(match[1]);
    }
  }
  return null;
};

const extractEmailByLabel = (text: string, labelPatterns: string[]): string | null => {
  for (const label of labelPatterns) {
    const regex = new RegExp(`${label}[\\s:\\-]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})`, "i");
    const match = text.match(regex);
    if (match?.[1]) {
      return cleanText(match[1]);
    }
  }
  return null;
};

const extractPhoneByLabel = (text: string, labelPatterns: string[]): string | null => {
  for (const label of labelPatterns) {
    const regex = new RegExp(`${label}[\\s:\\-]*((?:\\+?\\d[\\d\\s\\-()]{8,}\\d))`, "i");
    const match = text.match(regex);
    if (match?.[1]) {
      return normalizePhone10(match[1]);
    }
  }
  return null;
};

const fetchGooglePlaceDetailsSnapshot = async (
  target: TechParkWebsiteTarget,
): Promise<GooglePlaceDetailsSnapshot | null> => {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey || !target.place_id) return null;

  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/place/details/json",
      {
        params: {
          key: apiKey,
          place_id: target.place_id,
          fields: "website,url,name,formatted_phone_number,international_phone_number,rating,user_ratings_total,business_status",
        },
        timeout: 12000,
      },
    );

    const details = response.data?.result;
    return {
      website: normalizeUrl(details?.website || null),
      map_url: normalizeUrl(details?.url || null),
      reception_phone: cleanText(details?.formatted_phone_number || null),
      international_phone: cleanText(details?.international_phone_number || null),
      rating: typeof details?.rating === "number" ? details.rating : null,
      total_ratings: Number.isFinite(Number(details?.user_ratings_total))
        ? Number(details.user_ratings_total)
        : null,
      business_status: cleanText(details?.business_status || null),
    };
  } catch (error) {
    logOperationalEvent("techpark.website_place_details.failed", {
      techParkId: target.id,
      techParkName: target.name,
      placeId: target.place_id,
      error: error instanceof Error ? error.message : String(error),
    }, "warn");
    return null;
  }
};

const searchOfficialWebsite = async (target: TechParkWebsiteTarget): Promise<string | null> => {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;
  const locationHint = [target.address_line1, target.locality, target.city, target.state]
    .filter(Boolean)
    .join(" ");
  if (!apiKey || !cx) {
    const fallbackQueries = [
      [target.name, locationHint, "official website"].filter(Boolean).join(" "),
      [target.name, target.locality, target.city, "tech park website"].filter(Boolean).join(" "),
      [`"${target.name}"`, locationHint].filter(Boolean).join(" "),
    ];

    const candidateSet = new Set<string>();

    for (const query of fallbackQueries) {
      for (const searchUrl of [
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
      ]) {
        try {
          const response = await axios.get(searchUrl, {
            timeout: 12000,
            headers: DEFAULT_HEADERS,
            responseType: "text",
          });
          const $ = cheerio.load(typeof response.data === "string" ? response.data : "");
          $("a[href]").each((_, element) => {
            const href = $(element).attr("href");
            const candidate = extractSearchResultUrl(href);
            if (!candidate) return;
            candidateSet.add(candidate);
          });
        } catch (error) {
          logOperationalEvent("techpark.website_search.fallback_error", {
            techParkId: target.id,
            techParkName: target.name,
            searchUrl,
            error: error instanceof Error ? error.message : String(error),
          }, "warn");
        }
      }
    }

    const ranked = await Promise.all(
      Array.from(candidateSet)
        .slice(0, 12)
        .map(async (url) => ({
          url,
          score: await verifyCandidateUrl(url, target),
        })),
    );

    const bestCandidate = ranked
      .filter((entry) => entry.score >= 4)
      .sort((left, right) => right.score - left.score)[0];

    return bestCandidate?.url || null;
  }

  try {
    const query = [target.name, locationHint, "official website"]
      .filter(Boolean)
      .join(" ");

    const response = await axios.get("https://www.googleapis.com/customsearch/v1", {
      params: {
        key: apiKey,
        cx,
        q: query,
        num: 5,
      },
      timeout: 12000,
    });

    const items = Array.isArray(response.data?.items) ? response.data.items : [];
    for (const item of items) {
      const link = normalizeUrl(item?.link);
      if (link && isLikelyOfficialWebsite(link)) {
        return link;
      }
    }
  } catch (error) {
    logOperationalEvent("techpark.website_search.failed", {
      techParkId: target.id,
      techParkName: target.name,
      error: error instanceof Error ? error.message : String(error),
    }, "warn");
  }

  return null;
};

const fetchHtml = async (url: string): Promise<{ finalUrl: string; html: string } | null> => {
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 5,
      headers: DEFAULT_HEADERS,
      responseType: "text",
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const finalUrl = normalizeUrl(response.request?.res?.responseUrl || url) || url;
    const html = typeof response.data === "string" ? response.data : "";
    if (!html) return null;

    return { finalUrl, html };
  } catch {
    return null;
  }
};

const collectRelevantPages = async (websiteUrl: string, existingContactPageUrl?: string | null) => {
  const pages: Array<{ url: string; text: string }> = [];
  const homepage = await fetchHtml(websiteUrl);
  if (!homepage) return pages;

  const $ = cheerio.load(homepage.html);
  const homeText = $("body").text().replace(/\s+/g, " ").trim();
  pages.push({ url: homepage.finalUrl, text: homeText });

  const candidateContactLinks = unique(
    [
      existingContactPageUrl || null,
      $('a[href*="contact"]').first().attr("href") || null,
      $('a[href*="about"]').first().attr("href") || null,
      $('a[href*="management"]').first().attr("href") || null,
      $('a[href*="team"]').first().attr("href") || null,
    ]
      .map((candidate) => toAbsoluteUrl(candidate, homepage.finalUrl))
      .filter((url): url is string => Boolean(url)),
  ).slice(0, 3);

  for (const url of candidateContactLinks) {
    const page = await fetchHtml(url);
    if (!page) continue;
    const text = cheerio.load(page.html)("body").text().replace(/\s+/g, " ").trim();
    pages.push({ url: page.finalUrl, text });
  }

  return pages;
};

const deriveScrapedDetails = async (
  target: TechParkWebsiteTarget,
  websiteUrl: string,
): Promise<ScrapedTechParkDetails> => {
  const pages = await collectRelevantPages(websiteUrl, target.contact_page_url);
  const combinedText = pages.map((page) => page.text).join(" \n ");
  const emails = findEmails(combinedText);
  const phones = findPhones(combinedText);

  const contactPageUrl =
    pages.find((page) => page.url !== websiteUrl && /contact|about|management|team/i.test(page.url))?.url ||
    target.contact_page_url ||
    null;

  const genericEmail =
    extractEmailByLabel(combinedText, ["email", "contact email", "mail us"]) ||
    emails[0] ||
    null;

  const receptionPhone =
    extractPhoneByLabel(combinedText, ["reception", "phone", "contact", "call us"]) ||
    phones[0] ||
    null;

  const propertyManagerEmail = extractEmailByLabel(combinedText, [
    "property manager email",
    "facility manager email",
    "manager email",
  ]);

  const propertyManagerPhone = extractPhoneByLabel(combinedText, [
    "property manager phone",
    "property manager contact",
    "facility manager phone",
    "facility manager contact",
  ]);

  const spocPhone = extractPhoneByLabel(combinedText, [
    "spoc phone",
    "spoc contact",
    "single point of contact",
  ]);

  const photoUrl = await scrapeWebsiteImage(websiteUrl);

  return {
    website: websiteUrl,
    contact_page_url: contactPageUrl,
    generic_email: genericEmail,
    reception_phone: receptionPhone,
    builder_name: extractLabelValue(combinedText, ["builder", "developed by", "developer"]),
    property_manager_name: extractLabelValue(combinedText, [
      "property manager",
      "facility manager",
      "estate manager",
    ]),
    property_manager_phone: propertyManagerPhone,
    property_manager_email: propertyManagerEmail,
    spoc_name: extractLabelValue(combinedText, [
      "spoc name",
      "spoc",
      "single point of contact",
    ]),
    spoc_phone: spocPhone,
    photo_url: photoUrl,
  };
};

export const enrichTechParkWebsiteDetails = async (
  target: TechParkWebsiteTarget,
) => {
  const placeDetails = await fetchGooglePlaceDetailsSnapshot(target);
  const websiteUrl =
    normalizeUrl(target.website) ||
    placeDetails?.website ||
    await searchOfficialWebsite(target);

  if (!websiteUrl && !placeDetails) {
    return {
      success: false as const,
      message: "No official website or place details found for this tech park.",
      data: null,
    };
  }

  const details = websiteUrl
    ? await deriveScrapedDetails(target, websiteUrl)
    : {};

  const mergedDetails: Record<string, string | null> = {
    website: details.website ?? placeDetails?.website ?? null,
    contact_page_url: details.contact_page_url ?? null,
    generic_email: details.generic_email ?? null,
    reception_phone: details.reception_phone ?? placeDetails?.reception_phone ?? null,
    international_phone: details.international_phone ?? placeDetails?.international_phone ?? null,
    map_url: details.map_url ?? placeDetails?.map_url ?? null,
    rating:
      details.rating ??
      (typeof placeDetails?.rating === "number" ? String(placeDetails.rating) : null),
    total_ratings:
      details.total_ratings ??
      (typeof placeDetails?.total_ratings === "number" ? String(placeDetails.total_ratings) : null),
    business_status: details.business_status ?? placeDetails?.business_status ?? null,
    builder_name: details.builder_name ?? null,
    property_manager_name: details.property_manager_name ?? null,
    property_manager_phone: details.property_manager_phone ?? null,
    property_manager_email: details.property_manager_email ?? null,
    spoc_name: details.spoc_name ?? null,
    spoc_phone: details.spoc_phone ?? null,
    photo_url: details.photo_url ?? null,
  };

  const updateData: Record<string, string | null> = {};
  const keys = Object.keys(mergedDetails) as Array<keyof typeof mergedDetails>;
  for (const key of keys) {
    const value = mergedDetails[key];
    if (value !== undefined) {
      updateData[key] = value ?? null;
    }
  }

  const updated = await prismaInstance.newTechPark.update({
    where: { id: target.id },
    data: {
      ...updateData,
      rating: updateData.rating ? Number(updateData.rating) : null,
      total_ratings: updateData.total_ratings ? Number(updateData.total_ratings) : null,
    },
  });

  logOperationalEvent("techpark.website_enrichment.completed", {
    techParkId: target.id,
    techParkName: target.name,
    website: websiteUrl,
    updatedFields: Object.keys(updateData),
  });

  return {
    success: true as const,
    message: "Tech park website details enriched successfully.",
    data: updated,
  };
};
