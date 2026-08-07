import puppeteer from 'puppeteer';

interface FundingArticle {
  title: string;
  article_url: string;
  date_published: string;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Runs headless so this works unattended on a server — the previous
// `headless: false` requires a real display and would never run on a
// deployed box, which is why this source was never actually wired into
// the scheduler.
const scrapeYourStoryFunding = async (): Promise<FundingArticle[]> => {
  const maxAttempts = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await scrapeOnce();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) await sleep(2000 * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

// Navigation to this specific site has been observed to time out intermittently
// (site slowness, not a code bug) — the retry loop above absorbs that instead
// of the whole funding-news pipeline losing this source for the run.
const scrapeOnce = async (): Promise<FundingArticle[]> => {
  const browser = await puppeteer.launch({
    headless: "shell",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
  });

  try {
    const page = await browser.newPage();
    // The default headless-shell fingerprint gets served a stripped-down page
    // with no <main> (likely bot detection at the CDN/WAF level) — a real
    // desktop Chrome UA gets the actual content.
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    );

    // /tag/funding-news currently only surfaces generic "daily roundup" digest
    // posts, not individual funding announcements — /tag/startup-funding is the
    // page that actually lists per-company funding stories.
    await page.goto('https://yourstory.com/tag/startup-funding', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    await page.waitForSelector('main', { timeout: 20000 });

    // The old selector (`/ai-story/...`) is stale — the site now links articles
    // as `/YYYY/MM/slug`. Each card renders the same link twice (once wrapping
    // the thumbnail, once wrapping the title), and the visible title text is
    // CSS-truncated with a literal "…" — the untruncated title only exists in
    // the thumbnail's `alt` attribute, so that's preferred when present.
    const rawLinks = await page.evaluate(() => {
      const byHref = new Map<string, string>();
      const anchors = document.querySelectorAll('li a[href^="/20"]');
      anchors.forEach((a) => {
        const href = a.getAttribute('href') || '';
        if (!href) return;

        const fullTitle = a.querySelector('img[alt]')?.getAttribute('alt')?.trim();
        const visibleTitle = a.textContent?.trim();
        const title = fullTitle || visibleTitle || '';
        if (!title) return;

        // Prefer whichever candidate is the fuller title if we see this href twice.
        const existing = byHref.get(href);
        if (!existing || title.length > existing.length) {
          byHref.set(href, title);
        }
      });
      return Array.from(byHref.entries()).map(([href, title]) => ({ title, href }));
    });

    const seenLinks = new Set<string>();
    const articles: FundingArticle[] = [];
    for (const { title, href } of rawLinks) {
      const lowerTitle = title.toLowerCase();
      const isFundingNews =
        lowerTitle.includes('raise') ||
        lowerTitle.includes('funding') ||
        lowerTitle.includes('invest') ||
        lowerTitle.includes('secure') ||
        lowerTitle.includes('capital') ||
        lowerTitle.includes('series ') ||
        lowerTitle.includes('valuation') ||
        lowerTitle.includes('acquire') ||
        lowerTitle.includes('merger');
      if (!isFundingNews) continue;

      const article_url = `https://yourstory.com${href}`;
      if (seenLinks.has(article_url)) continue;
      seenLinks.add(article_url);

      articles.push({ title, article_url, date_published: '' });
    }

    return articles;
  } finally {
    await browser.close();
  }
};

export default scrapeYourStoryFunding;
