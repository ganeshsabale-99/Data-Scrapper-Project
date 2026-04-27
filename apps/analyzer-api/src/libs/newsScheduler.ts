import cron from 'node-cron';
import { scrapeEntrackr } from './scrapeEntracker';
import scrapeYourStoryFunding from './scrapeYourStory';
import { scrapeVCCircle } from './scrapeVCCircle';
import { scrapeTechCrunch } from './scrapeTechCrunch';
import { scrapeETStartup } from './scrapeETStartup';
import { scrapeInc42 } from './scrapeInc42';
import { prismaInstance } from '@repo/db';


const cleanText = (text: string | null | undefined): string | null => {
  if (!text) return null;
  return text.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
};

const toNonEmptyText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const s = typeof value === "string" ? value : String(value);
  return cleanText(s);
};

const parseDateString = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr) return null;

  try {
    const cleanedStr = dateStr
      .replace(/\s+/g, ' ')
      .replace(/IST|EST|PST|UTC|GMT/gi, '')
      .trim();

    const parsedDate = new Date(cleanedStr);

    if (isNaN(parsedDate.getTime())) {
      console.warn(`Could not parse date: "${dateStr}" (cleaned: "${cleanedStr}")`);
      return null;
    }

    return parsedDate;
  } catch (error) {
    console.warn(`Error parsing date "${dateStr}":`, error);
    return null;
  }
};

const scheduleNewsScraping = () => {
  cron.schedule('0 */2 9-18 * * *', async () => {
    await scrapeAndStoreNews();
  }, {
    timezone: "Asia/Kolkata"
  });

  scrapeAndStoreNews();
};

const scrapeAndStoreNews = async () => {
  try {
    try {
      const entrackrArticles = await scrapeEntrackr();
      await storeArticles(entrackrArticles, 'ENTRACKR');
    } catch (error) {
      console.error('Entrackr scraping failed:', error);
    }

    try {
      const vccircleArticles = await scrapeVCCircle();
      await storeArticles(vccircleArticles, 'VCCIRCLE');
    } catch (error) {
      console.error('VCCircle scraping failed:', error);
    }

    try {
      const techcrunchArticles = await scrapeTechCrunch();
      await storeArticles(techcrunchArticles, 'TECHCRUNCH');
    } catch (error) {
      console.error('TechCrunch scraping failed:', error);
    }

    try {
      const etArticles = await scrapeETStartup();
      await storeArticles(etArticles, 'ETSTARTUP');
    } catch (error) {
      console.error('ET Startup scraping failed:', error);
    }

    try {
      const inc42Articles = await scrapeInc42();
      await storeArticles(inc42Articles, 'INC42');
    } catch (error) {
      console.error('Inc42 scraping failed:', error);
    }
  } catch (error) {
    console.error('Scheduled news scraping failed:', error);
  }
};

const storeArticles = async (articles: any[], source: 'ENTRACKR' | 'YOURSTORY' | 'VCCIRCLE' | 'TECHCRUNCH' | 'ETSTARTUP' | 'INC42') => {
  for (const article of articles) {
    try {
      if (source === 'ENTRACKR') {
        const articleUrl = toNonEmptyText(article.link);
        const title = toNonEmptyText(article.title);
        if (!articleUrl || !title) {
          console.warn(`Skipping ${source} article due to missing url/title`, { articleUrl, title });
          continue;
        }

        const updateData: any = {
          author: cleanText(article.author),
          date_published: parseDateString(article.date),
          updated_at: new Date(),
        };
        if (title) updateData.title = title;

        await prismaInstance.fundingNews.upsert({
          where: { article_url: articleUrl },
          update: updateData,
          create: {
            title,
            article_url: articleUrl,
            source: 'ENTRACKR',
            author: cleanText(article.author),
            date_published: parseDateString(article.date)
          }
        });
      } else if (source === 'YOURSTORY') {
        const articleUrl = toNonEmptyText(article.article_url);
        const title = toNonEmptyText(article.title);
        if (!articleUrl || !title) {
          console.warn(`Skipping ${source} article due to missing url/title`, { articleUrl, title });
          continue;
        }

        const updateData: any = {
          date_published: parseDateString(article.date_published),
          updated_at: new Date(),
        };
        if (title) updateData.title = title;

        await prismaInstance.fundingNews.upsert({
          where: { article_url: articleUrl },
          update: updateData,
          create: {
            title,
            article_url: articleUrl,
            source: 'YOURSTORY',
            date_published: parseDateString(article.date_published)
          }
        });
      } else if (source === 'VCCIRCLE') {
        const articleUrl = toNonEmptyText(article.link);
        const title = toNonEmptyText(article.title);
        if (!articleUrl || !title) {
          console.warn(`Skipping ${source} article due to missing url/title`, { articleUrl, title });
          continue;
        }

        const updateData: any = {
          author: cleanText(article.author),
          date_published: parseDateString(article.date),
          updated_at: new Date(),
        };
        if (title) updateData.title = title;

        await prismaInstance.fundingNews.upsert({
          where: { article_url: articleUrl },
          update: updateData,
          create: {
            title,
            article_url: articleUrl,
            source: 'VCCIRCLE',
            author: cleanText(article.author),
            date_published: parseDateString(article.date)
          }
        });
      } else if (source === 'TECHCRUNCH') {
        const articleUrl = toNonEmptyText(article.link);
        const title = toNonEmptyText(article.title);
        if (!articleUrl || !title) {
          console.warn(`Skipping ${source} article due to missing url/title`, { articleUrl, title });
          continue;
        }

        const updateData: any = {
          author: cleanText(article.author),
          date_published: parseDateString(article.date),
          updated_at: new Date(),
        };
        if (title) updateData.title = title;

        await prismaInstance.fundingNews.upsert({
          where: { article_url: articleUrl },
          update: updateData,
          create: {
            title,
            article_url: articleUrl,
            source: 'TECHCRUNCH',
            author: cleanText(article.author),
            date_published: parseDateString(article.date)
          }
        });
      } else if (source === 'ETSTARTUP') {
        const articleUrl = toNonEmptyText(article.link);
        const title = toNonEmptyText(article.title);
        if (!articleUrl || !title) {
          console.warn(`Skipping ${source} article due to missing url/title`, { articleUrl, title });
          continue;
        }

        const updateData: any = {
          author: cleanText(article.author),
          date_published: parseDateString(article.date),
          updated_at: new Date(),
        };
        if (title) updateData.title = title;

        await prismaInstance.fundingNews.upsert({
          where: { article_url: articleUrl },
          update: updateData,
          create: {
            title,
            article_url: articleUrl,
            source: 'ETSTARTUP',
            author: cleanText(article.author),
            date_published: parseDateString(article.date)
          }
        });
      } else if (source === 'INC42') {
        const articleUrl = toNonEmptyText(article.link);
        const title = toNonEmptyText(article.title);
        if (!articleUrl || !title) {
          console.warn(`Skipping ${source} article due to missing url/title`, { articleUrl, title });
          continue;
        }

        const updateData: any = {
          author: cleanText(article.author),
          date_published: parseDateString(article.date),
          updated_at: new Date(),
        };
        if (title) updateData.title = title;

        await prismaInstance.fundingNews.upsert({
          where: { article_url: articleUrl },
          update: updateData,
          create: {
            title,
            article_url: articleUrl,
            source: 'INC42',
            author: cleanText(article.author),
            date_published: parseDateString(article.date)
          }
        });
      }
    } catch (error: any) {
      console.error(`Error storing article from ${source}:`, error.message || error);

      if (error.code === 'P5010' || error.code === 'P6003' || error.message?.includes('fetch failed') || error.message?.includes('planLimitReached')) {
        console.warn(`Prisma Accelerate limit or connectivity issue detected for ${source}. Skipping remaining articles in this batch.`);
        break;
      }
    }
  }
};

export const triggerManualScraping = async () => {
  await scrapeAndStoreNews();
};
export const startNewsScheduler = () => {
  scheduleNewsScraping();
};

export default startNewsScheduler; 
