import type { NextFunction, Request, Response } from "express";
import { prismaInstance } from "@repo/db";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";
import {
  hashExternalApiKey,
  parseExternalApiKey,
  timingSafeEqualString,
} from "../utils/externalApiKeyUtils";

const unauthorized = (res: Response) =>
  res.status(401).json({
    success: false,
    code: "UNAUTHORIZED",
    message: "Unauthorized",
  });

export const externalApiKeyAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const pepper = process.env.EXTERNAL_API_KEY_PEPPER?.trim();
    if (!pepper) {
      console.error("[external-api.auth] EXTERNAL_API_KEY_PEPPER is not configured");
      return res.status(503).json({
        success: false,
        code: "SERVICE_UNAVAILABLE",
        message: "Service temporarily unavailable",
      });
    }

    const parsed = parseExternalApiKey(req.header("x-api-key") || undefined);
    if (!parsed) return unauthorized(res);

    const apiKey = await prismaInstance.externalApiKey.findUnique({
      where: { keyId: parsed.keyId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            isActive: true,
            scopes: {
              select: {
                scope: true,
              },
            },
          },
        },
      },
    });

    if (!apiKey) return unauthorized(res);
    if (!apiKey.isActive || apiKey.revokedAt) return unauthorized(res);
    if (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now()) return unauthorized(res);
    if (!apiKey.client.isActive) return unauthorized(res);

    const computedHash = hashExternalApiKey(parsed.keyId, parsed.secret, pepper);
    if (!timingSafeEqualString(computedHash, apiKey.keyHash)) return unauthorized(res);

    req.externalApiAuth = {
      apiKeyId: apiKey.id,
      keyId: apiKey.keyId,
      clientId: apiKey.client.id,
      clientName: apiKey.client.name,
      scopes: apiKey.client.scopes.map((entry) => entry.scope),
      rateLimitPerMinute: Math.max(1, apiKey.rateLimitPerMinute || 120),
    };

    void prismaInstance.externalApiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((error) => {
        console.warn("[external-api.auth] Failed to update lastUsedAt", {
          apiKeyId: apiKey.id,
          message: error instanceof Error ? error.message : String(error),
        });
      });

    return next();
  } catch (error) {
    return sendSafeErrorResponse(
      res,
      error,
      "externalApi.auth",
      "Unable to authorize this request right now. Please try again.",
    );
  }
};
