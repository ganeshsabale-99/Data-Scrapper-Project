import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

type RequestTokenInfo = {
  isValid: boolean;
  expiresAt: Date;
  timeRemaining: number;
  isExpired: boolean;
};

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      requestStartedAt: number;
      tokenInfo?: RequestTokenInfo;
    }
  }
}

const isTruthyObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const sanitizeRequestId = (value: string | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  const isValid = /^[A-Za-z0-9._:-]+$/.test(trimmed);
  return isValid ? trimmed : null;
};

const resolveRequestId = (req: Request): string => {
  const fromRequestId = sanitizeRequestId(req.header("x-request-id") || undefined);
  if (fromRequestId) return fromRequestId;

  const fromCorrelationId = sanitizeRequestId(req.header("x-correlation-id") || undefined);
  if (fromCorrelationId) return fromCorrelationId;

  return randomUUID();
};

export const requestContextMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const requestId = resolveRequestId(req);
  req.requestId = requestId;
  req.requestStartedAt = Date.now();

  res.setHeader("X-Request-Id", requestId);

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (isTruthyObject(body)) {
      if (!("requestId" in body)) {
        body.requestId = requestId;
      }
      if (!("timestamp" in body)) {
        body.timestamp = new Date().toISOString();
      }
    }
    return originalJson(body);
  }) as Response["json"];

  next();
};
