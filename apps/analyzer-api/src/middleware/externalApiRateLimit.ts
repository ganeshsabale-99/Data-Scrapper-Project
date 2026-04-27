import type { NextFunction, Request, Response } from "express";
import { createClient } from "redis";

type RateLimitConsumeResult = {
  count: number;
  ttlMs: number;
};

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 120;
const DEFAULT_REDIS_PREFIX = "analyzer:external-api-rate-limit";

const REDIS_RATE_LIMIT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
if ttl < 0 then
  ttl = tonumber(ARGV[1])
  redis.call("PEXPIRE", KEYS[1], ttl)
end
return { current, ttl }
`;

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const parseStoreMode = (value: string | undefined): "auto" | "memory" | "redis" => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "memory") return "memory";
  if (normalized === "redis") return "redis";
  return "auto";
};

const inMemoryStore = new Map<string, { count: number; resetAtEpochMs: number }>();

const cleanupInMemoryStore = (nowEpochMs: number) => {
  if (inMemoryStore.size < 1000) return;
  for (const [key, value] of inMemoryStore.entries()) {
    if (value.resetAtEpochMs <= nowEpochMs) inMemoryStore.delete(key);
  }
};

const consumeInMemory = (key: string, windowMs: number): RateLimitConsumeResult => {
  const nowEpochMs = Date.now();
  cleanupInMemoryStore(nowEpochMs);

  const existing = inMemoryStore.get(key);
  const isWindowActive = Boolean(existing && existing.resetAtEpochMs > nowEpochMs);
  const count = isWindowActive && existing ? existing.count + 1 : 1;
  const resetAtEpochMs = isWindowActive && existing ? existing.resetAtEpochMs : nowEpochMs + windowMs;

  inMemoryStore.set(key, {
    count,
    resetAtEpochMs,
  });

  return {
    count,
    ttlMs: Math.max(1, resetAtEpochMs - nowEpochMs),
  };
};

let redisClientPromise: Promise<ReturnType<typeof createClient> | null> | null = null;

const getRedisClient = async (): Promise<ReturnType<typeof createClient> | null> => {
  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      const storeMode = parseStoreMode(
        process.env.EXTERNAL_API_RATE_LIMIT_STORE || process.env.API_RATE_LIMIT_STORE,
      );
      if (storeMode === "memory") return null;

      const redisUrl = process.env.REDIS_URL?.trim();
      if (!redisUrl) {
        if (storeMode === "redis") {
          console.warn("[external-api.rate-limit] REDIS_URL missing; falling back to memory");
        }
        return null;
      }

      try {
        const client = createClient({
          url: redisUrl,
          socket: {
            connectTimeout: parseNumber(process.env.REDIS_CONNECT_TIMEOUT_MS, 5000),
            reconnectStrategy: () => false,
          },
        });
        client.on("error", (error) => {
          console.error("[external-api.rate-limit.redis.error]", {
            message: error instanceof Error ? error.message : String(error),
          });
        });

        if (!client.isOpen) {
          await client.connect();
        }
        return client;
      } catch (error) {
        console.warn("[external-api.rate-limit] Failed to connect redis; using memory", {
          message: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    })();
  }
  return redisClientPromise;
};

const parseRedisResult = (result: unknown): RateLimitConsumeResult | null => {
  if (!Array.isArray(result) || result.length < 2) return null;
  const count = Number(result[0]);
  const ttlMs = Number(result[1]);
  if (!Number.isFinite(count) || !Number.isFinite(ttlMs)) return null;
  return {
    count,
    ttlMs: Math.max(1, ttlMs),
  };
};

const consumeRateLimit = async (key: string, windowMs: number): Promise<RateLimitConsumeResult> => {
  const redisKeyPrefix =
    process.env.EXTERNAL_API_RATE_LIMIT_REDIS_PREFIX?.trim() || DEFAULT_REDIS_PREFIX;
  const redisClient = await getRedisClient();

  if (!redisClient) {
    return consumeInMemory(key, windowMs);
  }

  try {
    const redisKey = `${redisKeyPrefix}:${key}`;
    const result = await redisClient.eval(REDIS_RATE_LIMIT_SCRIPT, {
      keys: [redisKey],
      arguments: [String(windowMs)],
    });
    const parsed = parseRedisResult(result);
    if (!parsed) throw new Error("Unexpected redis response");
    return parsed;
  } catch (error) {
    console.warn("[external-api.rate-limit] redis command failed; using memory", {
      message: error instanceof Error ? error.message : String(error),
    });
    return consumeInMemory(key, windowMs);
  }
};

export const externalApiRateLimit = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.method === "OPTIONS") return next();

  const apiKeyId = req.externalApiAuth?.apiKeyId;
  if (!apiKeyId) {
    return res.status(401).json({
      success: false,
      code: "UNAUTHORIZED",
      message: "Unauthorized",
    });
  }

  const windowMs = parseNumber(process.env.EXTERNAL_API_RATE_LIMIT_WINDOW_MS, DEFAULT_WINDOW_MS);
  const limit = Math.max(
    1,
    req.externalApiAuth?.rateLimitPerMinute || parseNumber(undefined, DEFAULT_MAX_REQUESTS),
  );
  const rateLimitKey = `key:${apiKeyId}`;

  const consumed = await consumeRateLimit(rateLimitKey, windowMs);
  const nowEpochMs = Date.now();
  const resetAtEpochMs = nowEpochMs + consumed.ttlMs;
  const remaining = Math.max(0, limit - consumed.count);
  const retryAfterSeconds = Math.max(1, Math.ceil(consumed.ttlMs / 1000));

  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  res.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAtEpochMs / 1000)));

  if (consumed.count > limit) {
    res.setHeader("Retry-After", String(retryAfterSeconds));
    return res.status(429).json({
      success: false,
      code: "RATE_LIMITED",
      message: "Too many requests. Please try again in a moment.",
      retryAfterSeconds,
    });
  }

  return next();
};
