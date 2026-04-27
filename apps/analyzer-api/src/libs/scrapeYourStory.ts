import puppeteer from 'puppeteer';
import fs from 'fs';

interface FundingArticle {
  title: string;
  article_url: string;
  date_published: string;
}

const scrapeYourStoryFunding = async (): Promise<FundingArticle[]> => {
  const browser = await puppeteer.launch({
    headless: false, 
    slowMo: 50,       
    defaultViewport: null,
  });

  const page = await browser.newPage();

  await page.goto('https://yourstory.com/tag/funding-news', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });

  try {

    await page.waitForSelector('main', { timeout: 20000 });
    console.log('Page structure loaded');


    await page.screenshot({ path: 'debug.png', fullPage: true });


    const articles = await page.evaluate(() => {
      const results: FundingArticle[] = [];

      const cards = document.querySelectorAll('li a[href^="/ai-story"]');
      cards.forEach((a) => {
        const title = a.textContent?.trim() || '';
        const href = a.getAttribute('href') || '';
        if (title && href) {
          results.push({
            title,
            article_url: `https://yourstory.com${href}`,
            date_published: '', 
          });
        }
      });

      return results;
    });

    await browser.close();
    return articles;
  } catch (err) {
    console.warn('Selector not found. Taking screenshot...');
    await page.screenshot({ path: 'debug.png', fullPage: true });
    await browser.close();
    throw err;
  }
};

export default scrapeYourStoryFunding;
