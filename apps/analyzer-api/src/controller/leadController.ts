import type { Request, Response } from "express";
import type { Prisma } from "@repo/db";
import { prismaInstance } from "@repo/db";
import { getQueryString } from "../utils/queryUtils";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";

const LEAD_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  companyName: true,
  communicationMethod: true,
  city: true,
  lookingFor: true,
  type: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LeadSelect;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const trimToLength = (value: unknown, maxLength: number): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
};

export const createLead = async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;

    const name = trimToLength(body.name, 200);
    const email = trimToLength(body.email, 200)?.toLowerCase();

    if (!name || !email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "name and a valid email are required",
      });
    }

    const lead = await prismaInstance.lead.create({
      data: {
        name,
        email,
        phone: trimToLength(body.phone, 32) || null,
        companyName: trimToLength(body.companyName, 200) || null,
        communicationMethod: trimToLength(body.communicationMethod, 64) || null,
        city: trimToLength(body.city, 120) || null,
        lookingFor: trimToLength(body.lookingFor, 200) || null,
        type: trimToLength(body.type, 64) || "TRIAL_7_DAY",
      },
      select: LEAD_SELECT,
    });

    return res.status(201).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "lead.create",
      "Unable to submit this request right now. Please try again.",
    );
  }
};

const parsePositiveInteger = (
  value: string | undefined,
  fallback: number,
): number | null => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return parsed;
};

export const listLeads = async (req: Request, res: Response) => {
  try {
    const pageRaw = parsePositiveInteger(getQueryString(req.query.page), 1);
    const pageSizeRaw = parsePositiveInteger(getQueryString(req.query.pageSize), 20);
    if (!pageRaw || !pageSizeRaw) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "page and pageSize must be positive integers",
      });
    }

    const page = pageRaw;
    const pageSize = Math.min(100, pageSizeRaw);
    const skip = (page - 1) * pageSize;

    const city = getQueryString(req.query.city)?.trim();
    const lookingFor = getQueryString(req.query.lookingFor)?.trim();
    const communicationMethod = getQueryString(req.query.communicationMethod)?.trim();
    const type = getQueryString(req.query.type)?.trim();

    const where: Prisma.LeadWhereInput = {
      ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
      ...(lookingFor ? { lookingFor: { equals: lookingFor, mode: "insensitive" } } : {}),
      ...(communicationMethod
        ? { communicationMethod: { equals: communicationMethod, mode: "insensitive" } }
        : {}),
      ...(type ? { type: { equals: type, mode: "insensitive" } } : {}),
    };

    const [total, items] = await Promise.all([
      prismaInstance.lead.count({ where }),
      prismaInstance.lead.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: LEAD_SELECT,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return res.status(200).json({
      success: true,
      data: items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    });
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "lead.list",
      "Unable to fetch leads right now. Please try again.",
    );
  }
};

export const getLeadById = async (req: Request, res: Response) => {
  try {
    const idRaw = getQueryString(req.params.id)?.trim();
    const id = idRaw ? Number.parseInt(idRaw, 10) : NaN;
    if (!Number.isFinite(id)) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "id must be a valid number",
      });
    }

    const lead = await prismaInstance.lead.findUnique({
      where: { id },
      select: LEAD_SELECT,
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Lead not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "lead.getById",
      "Unable to fetch this lead right now. Please try again.",
    );
  }
};
