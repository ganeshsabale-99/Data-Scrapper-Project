import crypto from "node:crypto";
import { promisify } from "node:util";

const randomBytes = promisify(crypto.randomBytes);

const RAW_API_KEY_REGEX = /^tpk_([A-Za-z0-9_-]{8,})\.([A-Za-z0-9_-]{24,})$/;

export type ParsedExternalApiKey = {
  keyId: string;
  secret: string;
};

export const parseExternalApiKey = (rawValue: string | undefined): ParsedExternalApiKey | null => {
  if (!rawValue) return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  const matched = RAW_API_KEY_REGEX.exec(trimmed);
  if (!matched) return null;
  const keyId = matched[1];
  const secret = matched[2];
  if (!keyId || !secret) return null;
  return {
    keyId,
    secret,
  };
};

export const generateExternalApiKeySecret = async (): Promise<string> => {
  const bytes = await randomBytes(32);
  return bytes.toString("base64url").slice(0, 48);
};

export const hashExternalApiKey = (
  keyId: string,
  secret: string,
  pepper: string,
): string =>
  crypto.createHmac("sha256", pepper).update(`${keyId}.${secret}`).digest("hex");

export const timingSafeEqualString = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const resolveRequestIp = (forwardedFor: string | undefined, fallback: string): string => {
  if (forwardedFor) {
    const forwardedIp = forwardedFor.split(",")[0]?.trim();
    if (forwardedIp) return forwardedIp;
  }
  return fallback || "unknown";
};
