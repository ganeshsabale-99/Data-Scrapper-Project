import type { NextFunction, Request, Response } from "express";
import { prismaInstance, type Prisma } from "@repo/db";
import { resolveRequestIp } from "../utils/externalApiKeyUtils";

const toJsonSafeValue = (value: unknown): Prisma.InputJsonValue => {
  try {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  } catch {
    return {};
  }
};

export const externalApiAuditLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const startedAt = req.requestStartedAt || Date.now();

  res.on("finish", () => {
    const latencyMs = Math.max(0, Date.now() - startedAt);
    const ip = resolveRequestIp(req.header("x-forwarded-for") || undefined, req.ip || "unknown");
    const path = req.originalUrl.split("?")[0] || req.path || "/";

    void prismaInstance.externalApiRequestLog
      .create({
        data: {
          requestId: req.requestId || null,
          method: req.method,
          path,
          statusCode: res.statusCode,
          latencyMs,
          ip,
          userAgent: req.header("user-agent") || null,
          query: toJsonSafeValue(req.query),
          apiKeyId: req.externalApiAuth?.apiKeyId || null,
          clientId: req.externalApiAuth?.clientId || null,
        },
      })
      .catch((error) => {
        console.error("[external-api.audit] Failed to persist request log", {
          requestId: req.requestId,
          message: error instanceof Error ? error.message : String(error),
        });
      });
  });

  next();
};
