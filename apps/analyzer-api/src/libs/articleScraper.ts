import axios from "axios";
import * as cheerio from "cheerio";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ArticleContent {
  title: string;
  bodyText: string;
  imageUrl: string | null;
  publishedDate: string | null;
  source: string | null;
}

// ─── User Agent ──────────────────────────────────────────────────────────────

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ─── Global selectors to REMOVE from any site ────────────────────────────────

const GLOBAL_REMOVE = [
  // Core non-content
  "script", "style", "noscript", "iframe", "svg", "canvas",
  "nav", "footer", "header", "aside", "form", "button", "select", "input", "textarea",
  // Ads
  ".ad", ".ads", ".advertisement", ".adsbygoogle", "[id*='google_ads']",
  "[class*='ad-']", "[class*='advert']", "[class*='sponsor']", "[class*='promo']",
  // Social/sharing
  ".social-share", ".share-buttons", ".social-media", ".share-bar", ".sharing",
  // Related/recommended
  ".related-articles", ".related-posts", ".related-stories", ".also-read",
  ".recommended", ".more-stories", ".trending", ".most-popular",
  // Comments
  ".comments", ".comment-section", "#comments", ".disqus",
  // Misc
  ".newsletter", ".popup", ".modal", ".cookie-banner", ".breadcrumb",
  ".pagination", ".signup", ".login", ".download-app",
  "[role='navigation']", "[role='banner']", "[role='complementary']",
  "[aria-hidden='true']",
].join(", ");

// ─── Site-specific configuration ─────────────────────────────────────────────
// Each site has:
//   contentSelectors: CSS selectors to find the article body (tried in order)
//   removeSelectors: Extra elements to remove BEFORE extracting text

interface SiteConfig {
  contentSelectors: string[];
  removeSelectors: string[];
}

const SITE_CONFIGS: Record<string, SiteConfig> = {
  techcrunch: {
    contentSelectors: [
      ".article-content",
      ".article__content",
      ".entry-content",
      ".post-content",
    ],
    removeSelectors: [
      // Event banners & promos ("StrictlyVC", "Meet your next investor", "Disrupt")
      "[class*='event']", "[class*='Event']", "[class*='promo']", "[class*='Promo']",
      "[class*='banner']", "[class*='Banner']",
      "[class*='register']", "[class*='Register']",
      // "Most Popular" sidebar
      ".most-popular", "[class*='popular']", "[class*='Popular']",
      // Author bio section
      ".author-bio", ".article__author", "[class*='author-card']",
      // Image credits
      ".image-credits", "[class*='image-credit']", "[class*='ImageCredit']",
      "figcaption",
      // Topic tags
      ".article-tags", ".tags", "[class*='topic']",
      // "When you purchase through links..." disclaimer
      ".affiliate-disclaimer", "[class*='commission']",
      // Footer content
      ".site-footer", ".footer-nav",
    ],
  },

  vccircle: {
    contentSelectors: [
      // VCCircle uses CSS module hashed classes like articleDetail_article-content__GPSys
      "[class*='articleDetail_article-content']",
      "[class*='article-content']",
      ".article-body",
      ".entry-content",
      ".story-content",
    ],
    removeSelectors: [
      // Sidebar & related articles
      "[class*='article-detail-sidebar']", "[class*='articles-side-bar']",
      "[class*='article-listing']",
      // Tags & share buttons
      "[class*='tags']", "[class*='share-article']", "[class*='share__']",
      "[class*='social-links']",
      // Author & meta
      "[class*='author']", "[class*='meta__']", "[class*='listen']",
      // Image description/caption
      "[class*='image-description']",
      // Premium/subscription
      "[class*='premium']", "[class*='Premium']",
      "[class*='subscribe']", "[class*='Subscribe']",
      // Newsletter
      "[class*='newsLetter']", "[class*='newsletter']",
      // News cards (related)
      "[class*='newsCard']",
      // Google News widget
      "[class*='googleNews']",
      // Footer
      "[class*='newfooter']", "[class*='footer']",
      // App download
      "[class*='app-download']", "[class*='app-dwn']",
    ],
  },

  inc42: {
    contentSelectors: [
      ".post-content",
      ".entry-content",
      ".article-body",
      ".article-content",
    ],
    removeSelectors: [
      // The MASSIVE unicorn/soonicorn/investor lists at the bottom
      "[class*='unicorn']", "[class*='Unicorn']",
      "[class*='soonicorn']", "[class*='Soonicorn']",
      "[class*='listed-']", "[class*='Listed']",
      "[class*='investor-list']", "[class*='Investor']",
      // These lists are often in footer-like containers
      "[class*='company-list']", "[class*='taxonomy']",
      "[class*='tag-list']", "[class*='glossary']",
      // Datalabs widget
      "[class*='datalabs']", "[class*='Datalabs']", "[class*='DataLabs']",
      // "Latest Funding Rounds" widget
      "[class*='funding-round']", "[class*='latest-funding']",
      // Newsletter form
      "[class*='newsletter']", "[class*='Newsletter']",
      "[class*='join-inc42']", "[class*='inc42-plus']",
      // Event banners
      "[class*='event']", "[class*='Event']",
      "[class*='summit']", "[class*='Summit']",
      "[class*='retreat']", "[class*='Retreat']",
      // Courses/media sidebar
      "[class*='course']", "[class*='Course']",
      "[class*='brandlab']", "[class*='BrandLab']",
      // Follow us / social
      "[class*='follow']", "[class*='Follow']",
      // Summary box (Inc42 puts a SUMMARY block at top with bullets — we want the full article)
      "[class*='summary-box']", "[class*='SUMMARY']",
      // Partner/about
      "[class*='partner']", "[class*='about-us']", "[class*='career']",
    ],
  },

  economictimes: {
    contentSelectors: [
      ".artText",
      ".article_content",
      ".Normal",
      ".artData",
      "[data-articlebody]",
      ".economicTimes_storyBody",
    ],
    removeSelectors: [
      // Stock tickers & market data
      "[class*='ticker']", "[class*='Ticker']",
      "[class*='stock']", "[class*='Stock']",
      "[class*='market']", "[class*='Market']",
      "[class*='benchmark']", "[class*='Benchmark']",
      "[class*='nifty']", "[class*='sensex']",
      // Mutual fund / investment widgets
      "[class*='fund']", "[class*='Fund']",
      "[class*='invest']", "[class*='Invest']",
      "[class*='etmoney']",
      // Featured funds
      "[class*='featured']", "[class*='Featured']",
      // Watchlist, subscribe, ePaper
      "[class*='watchlist']", "[class*='Watchlist']",
      "[class*='epaper']", "[class*='ePaper']",
      "[class*='subscribe']", "[class*='Subscribe']",
      // RHS sidebar
      ".artSto498_RHS", "#stickyUnit", "[class*='rhs']", "[class*='RHS']",
      // Prime widget
      "[class*='prime']", "[class*='Prime']",
    ],
  },

  yourstory: {
    contentSelectors: [
      ".post-content",
      ".article-body",
      ".story-content",
      ".ys-article-content",
    ],
    removeSelectors: [
      "[class*='related']", "[class*='tags']",
      "[class*='author-card']", "[class*='social']",
      "[class*='newsletter']",
    ],
  },

  entrackr: {
    contentSelectors: [
      ".entry-content",
      ".post-content",
      ".article-body",
    ],
    removeSelectors: [
      "[class*='related']", "[class*='tags']",
      "[class*='author']", "[class*='social']",
      "[class*='newsletter']", "[class*='share']",
    ],
  },

  livemint: {
    contentSelectors: [
      ".contentSec",
      ".mainArea",
      ".article-content",
      ".storyPage_story",
    ],
    removeSelectors: [
      "[class*='related']", "[class*='trending']",
      "[class*='newsletter']", "[class*='subscribe']",
      "[class*='premium']", "[class*='author']",
    ],
  },
};

// ─── Junk text patterns — lines matching these are removed ───────────────────

const JUNK_PATTERNS = [
  /^(share|tweet|email|print|copy link|bookmark)/i,
  /^(sign in|sign up|subscribe|log in|register|download)/i,
  /^(follow us|connect with us|join us)/i,
  /^(advertisement|promoted|sponsored|Ad\b)/i,
  /^(also read|read more|read also|related|see also)/i,
  /^(image|photo|video)\s*(source|credit|courtesy)/i,
  /^(nifty|sensex|bse|nse)\s*[\d,]/i,
  /^\d+[.,]\d+\s*[%₹$]/,
  /^(invest now|apply now|buy now|get started|register now)/i,
  /\b(cookie|privacy policy|terms of service|terms & conditions)\b/i,
  /^\s*(home|markets?|news|industry|tech|opinion|politics)\s*$/i,
  /\bePaper\b/i,
  /\bMutual Fund\b.*\breturn\b/i,
  /^\d+Y RETURN/i,
  /^★/,
  /^Enter .* to search/i,
  /^English Edition/i,
  /^My Watchlist/i,
  /^Topics?\s*$/i,
  /^Image Credits?:/i,
  /^Credit:/i,
  /^REGISTER NOW/i,
  /^FOLLOW\s*(US)?$/i,
  /^(Latest|Most Popular|Trending)\s*$/i,
  /^©\s*\d{4}/,
  /^(Unicorns|Soonicorns|Listed Tech Companies|Investors)\s*$/i,
  // Inc42 junk — massive comma-separated company/investor lists
  /^(Zomato|Peak XV|Blume|MapmyIndia),?\s/i,
  /^(CarTrade|FINO|Infibeam)/i,
  // "Note: We at Inc42 take our ethics..."
  /^Note:\s*We at/i,
  // Skip very long lines that are likely lists (>500 chars with lots of commas)
];

// ─── Main scraper function ───────────────────────────────────────────────────

export async function scrapeArticleContent(
  url: string
): Promise<ArticleContent> {
  const { data: html } = await axios.get(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    timeout: 15000,
    maxRedirects: 5,
  });

  const $ = cheerio.load(html);

  // Extract metadata BEFORE removing elements
  const title = extractTitle($);
  const imageUrl = extractImageUrl($, url);
  const publishedDate = extractPublishedDate($);
  const source = extractSource($, url);

  // ── Priority 0: Try JSON-LD articleBody FIRST (cleanest, unaffected by DOM) ──
  const jsonLdBody = extractJsonLdBody($);
  let bodyText = "";

  if (jsonLdBody && jsonLdBody.length > 200) {
    console.log(`[ArticleScraper] Using JSON-LD articleBody (${jsonLdBody.length} chars)`);
    bodyText = jsonLdBody;
  }

  if (!bodyText) {
    // ── Step 1: Remove global junk ───────────────────────────────────────
    $(GLOBAL_REMOVE).remove();

    // ── Step 2: Try site-specific content selectors BEFORE site-specific removal
    const siteKey = getSiteKey(url);

    if (siteKey && SITE_CONFIGS[siteKey]) {
      for (const selector of SITE_CONFIGS[siteKey]!.contentSelectors) {
        const container = $(selector);
        if (container.length) {
          const text = collectParagraphs($, container);
          if (text.length > 100) {
            console.log(`[ArticleScraper] Using site-specific selector: ${selector}`);
            bodyText = text;
            break;
          }
        }
      }
    }

    // ── Step 3: If still nothing, remove site junk then try generic
    if (!bodyText) {
      if (siteKey && SITE_CONFIGS[siteKey]) {
        const siteRemove = SITE_CONFIGS[siteKey]!.removeSelectors.join(", ");
        $(siteRemove).remove();
      }
      bodyText = extractBodyText($, url, siteKey);
    }
  }

  // ── Validate ───────────────────────────────────────────────────────────
  if (!bodyText || bodyText.trim().length < 50) {
    throw new Error("Unable to extract meaningful article content from this URL.");
  }

  console.log(`[ArticleScraper] Extracted ${bodyText.length} chars from ${source || url}`);

  return {
    title,
    bodyText: bodyText.trim(),
    imageUrl,
    publishedDate,
    source,
  };
}

// ─── Extract body text (site-aware, with multiple fallbacks) ─────────────────

function extractBodyText($: cheerio.CheerioAPI, url: string, siteKey: string | null): string {
  // Priority 1: JSON-LD articleBody (cleanest possible source)
  const jsonLdBody = extractJsonLdBody($);
  if (jsonLdBody && jsonLdBody.length > 200) {
    console.log(`[ArticleScraper] Using JSON-LD articleBody (${jsonLdBody.length} chars)`);
    return jsonLdBody;
  }

  // Priority 2: Site-specific content selectors
  if (siteKey && SITE_CONFIGS[siteKey]) {
    for (const selector of SITE_CONFIGS[siteKey]!.contentSelectors) {
      const container = $(selector);
      if (container.length) {
        const text = collectParagraphs($, container);
        if (text.length > 100) {
          console.log(`[ArticleScraper] Using site-specific selector: ${selector}`);
          return text;
        }
      }
    }
  }

  // Priority 3: <article> element
  const articleEl = $("article");
  if (articleEl.length) {
    const text = collectParagraphs($, articleEl);
    if (text.length > 200) return text;
  }

  // Priority 4: Generic content selectors
  const genericSelectors = [
    ".article-body", ".article-content", ".post-content",
    ".post-body", ".entry-content", ".story-content",
    ".content-body", ".article__body", ".story-body",
    '[itemprop="articleBody"]',
    "main", "#content", ".content",
  ];

  for (const selector of genericSelectors) {
    const container = $(selector);
    if (container.length) {
      const text = collectParagraphs($, container);
      if (text.length > 200) return text;
    }
  }

  // Priority 5: All <p> tags from body
  const allParagraphs = collectParagraphs($, $("body"));
  if (allParagraphs.length > 100) return allParagraphs;

  // Last resort
  return $("body").text().replace(/\s+/g, " ").trim();
}

// ─── Extract articleBody from JSON-LD structured data ────────────────────────

function extractJsonLdBody($: cheerio.CheerioAPI): string | null {
  let body: string | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    if (body) return;
    try {
      const raw = $(el).html();
      if (!raw) return;
      const parsed = JSON.parse(raw);

      // Handle array format
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item?.articleBody && typeof item.articleBody === "string" && item.articleBody.length > 100) {
          body = item.articleBody.trim();
          return;
        }
        // Some sites nest it under @graph
        if (item?.["@graph"]) {
          for (const graphItem of item["@graph"]) {
            if (graphItem?.articleBody && typeof graphItem.articleBody === "string") {
              body = graphItem.articleBody.trim();
              return;
            }
          }
        }
      }
    } catch {
      // ignore
    }
  });

  return body;
}

// ─── Collect meaningful paragraphs from a container ──────────────────────────

function collectParagraphs(
  $: cheerio.CheerioAPI,
  container: ReturnType<cheerio.CheerioAPI>
): string {
  const paragraphs: string[] = [];

  container.find("p, h2, h3, blockquote").each((_, el) => {
    const text = $(el).text().trim();

    // Skip very short lines
    if (text.length < 40) return;

    // Skip lines that are just comma-separated lists (unicorn/investor dumps)
    const commaCount = (text.match(/,/g) || []).length;
    if (commaCount > 10 && text.length > 300) return;

    // Skip junk patterns
    if (isJunkText(text)) return;

    paragraphs.push(text);
  });

  return paragraphs.join("\n\n");
}

// ─── Check if text matches any junk pattern ──────────────────────────────────

function isJunkText(text: string): boolean {
  return JUNK_PATTERNS.some((pattern) => pattern.test(text));
}

// ─── Get site key from URL ───────────────────────────────────────────────────

function getSiteKey(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    for (const key of Object.keys(SITE_CONFIGS)) {
      if (hostname.includes(key)) return key;
    }
  } catch {
    // ignore
  }
  return null;
}

// ─── Extract title ───────────────────────────────────────────────────────────

function extractTitle($: cheerio.CheerioAPI): string {
  const ogTitle = $('meta[property="og:title"]').attr("content");
  if (ogTitle?.trim()) return ogTitle.trim();

  const metaTitle = $('meta[name="title"]').attr("content");
  if (metaTitle?.trim()) return metaTitle.trim();

  const h1 = $("article h1, main h1, .post-title, .article-title, h1")
    .first()
    .text();
  if (h1?.trim()) return h1.trim();

  const titleTag = $("title").text();
  if (titleTag?.trim()) {
    return titleTag.replace(/\s*[|\-–—]\s*[^|\-–—]*$/, "").trim();
  }

  return "Untitled Article";
}

// ─── Extract image URL ──────────────────────────────────────────────────────

function extractImageUrl($: cheerio.CheerioAPI, baseUrl: string): string | null {
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage?.trim()) return resolveUrl(ogImage.trim(), baseUrl);

  const twitterImage = $('meta[name="twitter:image"]').attr("content");
  if (twitterImage?.trim()) return resolveUrl(twitterImage.trim(), baseUrl);

  const featuredImg = $(
    "article img, .featured-image img, .post-thumbnail img, .article-image img"
  ).first().attr("src");
  if (featuredImg?.trim()) return resolveUrl(featuredImg.trim(), baseUrl);

  let firstImg: string | null = null;
  $("main img, article img, .content img, body img").each((_, el) => {
    if (firstImg) return;
    const src = $(el).attr("src") || $(el).attr("data-src");
    const width = parseInt($(el).attr("width") || "0", 10);
    if (src && (width === 0 || width >= 200)) {
      if (!/logo|icon|avatar|pixel|tracking/i.test(src)) {
        firstImg = resolveUrl(src.trim(), baseUrl);
      }
    }
  });

  return firstImg;
}

// ─── Extract published date ─────────────────────────────────────────────────

function extractPublishedDate($: cheerio.CheerioAPI): string | null {
  const metaDate =
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[name="publish-date"]').attr("content") ||
    $('meta[name="date"]').attr("content") ||
    $('meta[property="og:article:published_time"]').attr("content");
  if (metaDate?.trim()) return metaDate.trim();

  const timeEl = $("time[datetime]").first().attr("datetime");
  if (timeEl?.trim()) return timeEl.trim();

  const timeText = $("time").first().text();
  if (timeText?.trim()) return timeText.trim();

  const jsonLd = $('script[type="application/ld+json"]').html();
  if (jsonLd) {
    try {
      const parsed = JSON.parse(jsonLd);
      const datePublished =
        parsed.datePublished ||
        (Array.isArray(parsed) ? parsed[0]?.datePublished : null);
      if (datePublished) return datePublished;
    } catch {
      // ignore
    }
  }

  return null;
}

// ─── Extract source ─────────────────────────────────────────────────────────

function extractSource($: cheerio.CheerioAPI, url: string): string | null {
  const ogSiteName = $('meta[property="og:site_name"]').attr("content");
  if (ogSiteName?.trim()) return ogSiteName.trim();

  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "").split(".")[0];
    if (hostname) return hostname.charAt(0).toUpperCase() + hostname.slice(1);
  } catch {
    // ignore
  }

  return null;
}

// ─── Resolve relative URLs ──────────────────────────────────────────────────

function resolveUrl(url: string, baseUrl: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

export default scrapeArticleContent;
