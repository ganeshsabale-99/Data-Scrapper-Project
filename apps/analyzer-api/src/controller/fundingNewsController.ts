import { NextFunction, Request, Response } from "express";
import { prismaInstance } from "@repo/db";
import { triggerManualScraping } from "../libs/newsScheduler";
import { getQueryString } from "../utils/queryUtils";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";

const sendFundingSafeError = (
  res: Response,
  error: unknown,
  context: string,
  fallbackMessage: string,
) =>
  sendSafeErrorResponse(
    res,
    error,
    `fundingNews.${context}`,
    fallbackMessage,
  );


export const getAllFundingNews = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsedPage = parseInt(getQueryString(req.query.page) || "1", 10);
    const parsedLimit = parseInt(getQueryString(req.query.limit) || "20", 10);
    const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
    const limit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(parsedLimit, 100))
      : 20;
    const source = getQueryString(req.query.source);
    const search = getQueryString(req.query.search);
    const isBookmarked = getQueryString(req.query.bookmarked) === 'true';

    const skip = (page - 1) * limit;

    const where: any = {};
    if (source) where.source = source;
    if (isBookmarked) where.is_bookmarked = true;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { company_name: { contains: search, mode: 'insensitive' } },
        { industry: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [paged, total] = await Promise.all([
      prismaInstance.fundingNews.findMany({
        where,
        orderBy: { date_published: 'desc' },
        skip,
        take: limit
      }),
      prismaInstance.fundingNews.count({ where })
    ]);

    const dataWithSerial = paged.map((item, index) => ({
      ...item,
      serialNumber: skip + index + 1
    }));

    return res.status(200).json({
      data: dataWithSerial,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    return sendFundingSafeError(
      res,
      error,
      "getAllFundingNews",
      "Unable to fetch funding news right now. Please try again.",
    );
  }
};

export const getFundingNewsById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = getQueryString(req.params.id);

    const article = await prismaInstance.fundingNews.findUnique({
      where: { id }
    });

    if (!article) {
      return res.status(404).json({ error: "Article not found." });
    }

    return res.status(200).json({ data: article });
  } catch (error: any) {
    return sendFundingSafeError(
      res,
      error,
      "getFundingNewsById",
      "Unable to fetch article details right now. Please try again.",
    );
  }
};

export const toggleBookmark = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = getQueryString(req.params.id);

    const article = await prismaInstance.fundingNews.findUnique({
      where: { id }
    });

    if (!article) {
      return res.status(404).json({ error: "Article not found." });
    }

    const updatedArticle = await prismaInstance.fundingNews.update({
      where: { id },
      data: { is_bookmarked: !article.is_bookmarked }
    });

    return res.status(200).json({
      message: `Article ${updatedArticle.is_bookmarked ? 'bookmarked' : 'unbookmarked'} successfully`,
      data: updatedArticle
    });
  } catch (error: any) {
    return sendFundingSafeError(
      res,
      error,
      "toggleBookmark",
      "Unable to update bookmark right now. Please try again.",
    );
  }
};

export const getBookmarkedArticles = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsedPage = parseInt(getQueryString(req.query.page) || "1", 10);
    const parsedLimit = parseInt(getQueryString(req.query.limit) || "20", 10);
    const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
    const limit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(parsedLimit, 100))
      : 20;
    const skip = (page - 1) * limit;

    const [paged, total] = await Promise.all([
      prismaInstance.fundingNews.findMany({
        where: { is_bookmarked: true },
        orderBy: { date_published: 'desc' },
        skip,
        take: limit
      }),
      prismaInstance.fundingNews.count({ where: { is_bookmarked: true } })
    ]);

    const dataWithSerial = paged.map((item, index) => ({
      ...item,
      serialNumber: skip + index + 1
    }));

    return res.status(200).json({
      data: dataWithSerial,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    return sendFundingSafeError(
      res,
      error,
      "getBookmarkedArticles",
      "Unable to fetch bookmarked articles right now. Please try again.",
    );
  }
};

export const triggerScraping = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await triggerManualScraping();

    const totalCount = await prismaInstance.fundingNews.count();

    return res.status(200).json({
      message: "Scraping completed successfully",
      totalArticles: totalCount
    });
  } catch (error: any) {
    return sendFundingSafeError(
      res,
      error,
      "triggerScraping",
      "Failed to trigger scraping.",
    );
  }
};

export const updateContactDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = getQueryString(req.params.id);
    const { contact_person, contact_email, contact_phone, contact_status } = req.body;

    const hasAnyField =
      contact_person !== undefined ||
      contact_email !== undefined ||
      contact_phone !== undefined ||
      contact_status !== undefined;

    if (!hasAnyField) {
      return res.status(400).json({
        error: "At least one field must be provided: contact_person, contact_email, contact_phone, or contact_status"
      });
    }

    if (contact_status) {
      const validStatuses = ['NOT_CONTACTED', 'CONTACTED', 'INTERESTED', 'MEETING_SCHEDULED', 'PROPOSAL_SENT', 'CLOSED'];
      if (!validStatuses.includes(contact_status)) {
        return res.status(400).json({
          error: "Invalid contact_status. Must be one of: " + validStatuses.join(', ')
        });
      }
    }

    const article = await prismaInstance.fundingNews.findUnique({
      where: { id }
    });

    if (!article) {
      return res.status(404).json({ error: "Article not found." });
    }

    const updateData: any = {};

    updateData.contact_person = contact_person !== undefined ? (contact_person.trim() || null) : null;
    updateData.contact_email = contact_email !== undefined ? (contact_email.trim() || null) : null;
    updateData.contact_phone = contact_phone !== undefined ? (contact_phone.trim() || null) : null;
    if (contact_status !== undefined) {
      updateData.contact_status = contact_status;
    }

    const updatedArticle = await prismaInstance.fundingNews.update({
      where: { id },
      data: updateData
    });

    return res.status(200).json({
      message: "Contact details updated successfully",
      data: updatedArticle
    });
  } catch (error: any) {
    return sendFundingSafeError(
      res,
      error,
      "updateContactDetails",
      "Unable to update contact details right now. Please try again.",
    );
  }
};

export const getFundingStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const [totalCount, bookmarkedCount, sourceRows] = await Promise.all([
      prismaInstance.fundingNews.count(),
      prismaInstance.fundingNews.count({ where: { is_bookmarked: true } }),
      prismaInstance.fundingNews.groupBy({
        by: ["source"],
        _count: { source: true },
      }),
    ]);

    const sourceCounts = sourceRows.reduce<Record<string, number>>((acc, row) => {
      const key = String(row.source || "").toLowerCase();
      if (!key) return acc;
      acc[key] = row._count.source ?? 0;
      return acc;
    }, {});

    return res.status(200).json({
      data: {
        total: totalCount,
        bySource: {
          entrackr: sourceCounts.entrackr ?? 0,
          yourstory: sourceCounts.yourstory ?? 0,
          ...sourceCounts,
        },
        bookmarked: bookmarkedCount
      }
    });
  } catch (error: any) {
    return sendFundingSafeError(
      res,
      error,
      "getFundingStats",
      "Unable to fetch funding stats right now. Please try again.",
    );
  }
};
