import type { Request, Response } from "express";
import { getQueryString } from "../utils/queryUtils";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";

type ProxyConfig = {
  baseUrl: string;
  apiKey: string;
};

const getProxyConfig = (): ProxyConfig | null => {
  const baseUrl = process.env.GUPIO_LEADS_API_BASE_URL?.trim();
  const apiKey = process.env.GUPIO_LEADS_API_KEY?.trim();
  if (!baseUrl || !apiKey) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
};

const unavailable = (res: Response) =>
  res.status(503).json({
    success: false,
    code: "SERVICE_UNAVAILABLE",
    message: "The leads integration is not configured on this server.",
  });

export const listLeadsFromGupioWebsite = async (req: Request, res: Response) => {
  const config = getProxyConfig();
  if (!config) return unavailable(res);

  try {
    const params = new URLSearchParams();
    const forwardedKeys = ["page", "pageSize", "city", "lookingFor", "communicationMethod"];
    for (const key of forwardedKeys) {
      const value = getQueryString(req.query[key]);
      if (value) params.set(key, value);
    }

    const upstream = await fetch(`${config.baseUrl}/leads?${params.toString()}`, {
      headers: { "x-api-key": config.apiKey },
    });
    const body = await upstream.json();
    return res.status(upstream.status).json(body);
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "leads.proxy.list",
      "Unable to fetch leads right now. Please try again.",
    );
  }
};

export const getLeadFromGupioWebsiteById = async (req: Request, res: Response) => {
  const config = getProxyConfig();
  if (!config) return unavailable(res);

  try {
    const id = getQueryString(req.params.id)?.trim();
    if (!id) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "id is required",
      });
    }

    const upstream = await fetch(`${config.baseUrl}/leads/${encodeURIComponent(id)}`, {
      headers: { "x-api-key": config.apiKey },
    });
    const body = await upstream.json();
    return res.status(upstream.status).json(body);
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "leads.proxy.getById",
      "Unable to fetch this lead right now. Please try again.",
    );
  }
};
