import type { NextFunction, Request, Response } from "express";

type RateLimitEntry = {
  count: number;
  resetAtEpochMs: number;
};

type RateLimitOptions = {
  enabled: boolean;
  windowMs: number;
  maxRequests: number;
};

type RateLimitStoreResult = {
  count: number;
  ttlMs: number;
};

type RateLimitStoreName = "memory" | "redis";
type RateLimitStoreMode = "auto" | "memory" | "redis";
type RateLimitHealthStatus = "healthy" | "degraded" | "not_configured";

export type RateLimitServiceHealth = {
  status: RateLimitHealthStatus;
  details: {
    enabled: boolean;
    mode: RateLimitStoreMode;
    activeStore: RateLimitStoreName | "unknown";
    redisConfigured: boolean;
    redisHost?: string;
    reason?: string;
    lastError?: string;
  };
};

type RateLimitStore = {
  name: RateLimitStoreName;
  consume: (key: string, windowMs: number) => Promise<RateLimitStoreResult>;
  close: () => Promise<void>;
};

type RedisEvalOptions = {
  keys: string[];
  arguments: string[];
};

type RedisLikeClient = {
  isOpen?: boolean;
  connect?: () => Promise<void>;
  quit?: () => Promise<void>;
  disconnect?: () => Promise<void>;
  destroy?: () => void;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  eval: (script: string, options: RedisEvalOptions) => Promise<unknown>;
};

type RedisModuleLike = {
  createClient: (options: Record<string, unknown>) => RedisLikeClient;
};

const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 250;
const DEFAULT_REDIS_CONNECT_TIMEOUT_MS = 5_000;
const DEFAULT_REDIS_COMMAND_TIMEOUT_MS = 1_500;
const DEFAULT_REDIS_KEY_PREFIX = "analyzer:rate-limit";
const DEFAULT_RATE_LIMIT_STORE_INIT_TIMEOUT_MS = 200;
const REDIS_ERROR_LOG_INTERVAL_MS = 30_000;

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

const parseBooleanEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const parseNumberEnv = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const resolveClientIdentifier = (req: Request): string => {
  const forwardedFor = req.header("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  return req.ip || req.socket.remoteAddress || "unknown";
};

const shouldSkipRateLimit = (req: Request): boolean =>
  req.method === "OPTIONS" ||
  req.path.startsWith("/health") ||
  req.path.startsWith("/media/uploads");

const parseRateLimitStoreMode = (value: string | undefined): RateLimitStoreMode => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "memory") return "memory";
  if (normalized === "redis") return "redis";
  return "auto";
};

const buildRateLimitOptions = (): RateLimitOptions => ({
  enabled: parseBooleanEnv(process.env.API_RATE_LIMIT_ENABLED, true),
  windowMs: parseNumberEnv(process.env.API_RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS),
  maxRequests: parseNumberEnv(
    process.env.API_RATE_LIMIT_MAX_REQUESTS,
    DEFAULT_RATE_LIMIT_MAX_REQUESTS,
  ),
});

const inMemoryRateLimitStore = new Map<string, RateLimitEntry>();
let cleanupCounter = 0;
let cachedRateLimitStore: RateLimitStore | null = null;
let rateLimitStoreInitPromise: Promise<RateLimitStore> | null = null;
let rateLimitStoreInitSeq = 0;
let redisWarningLogged = false;
let rateLimitStoreLastError: string | null = null;
let rateLimitStoreInitTimeoutWarningLogged = false;
let lastRedisErrorLogAt = 0;
let lastRedisErrorMessage = "";

const cleanupExpiredRateLimitEntries = (nowEpochMs: number) => {
  cleanupCounter++;
  if (cleanupCounter % 50 !== 0) return;

  for (const [key, value] of inMemoryRateLimitStore.entries()) {
    if (value.resetAtEpochMs <= nowEpochMs) {
      inMemoryRateLimitStore.delete(key);
    }
  }
};

const createMemoryRateLimitStore = (): RateLimitStore => ({
  name: "memory",
  consume: async (key: string, windowMs: number): Promise<RateLimitStoreResult> => {
    const nowEpochMs = Date.now();
    cleanupExpiredRateLimitEntries(nowEpochMs);

    const existing = inMemoryRateLimitStore.get(key);
    const resetAtEpochMs =
      existing && existing.resetAtEpochMs > nowEpochMs
        ? existing.resetAtEpochMs
        : nowEpochMs + windowMs;
    const count = existing && existing.resetAtEpochMs > nowEpochMs ? existing.count + 1 : 1;

    inMemoryRateLimitStore.set(key, {
      count,
      resetAtEpochMs,
    });

    return {
      count,
      ttlMs: Math.max(1, resetAtEpochMs - nowEpochMs),
    };
  },
  close: async () => { },
});

const memoryRateLimitStore = createMemoryRateLimitStore();

const parseRedisEvalResult = (value: unknown): RateLimitStoreResult | null => {
  if (!Array.isArray(value) || value.length < 2) return null;

  const countRaw = value[0];
  const ttlRaw = value[1];
  const count = Number(countRaw);
  const ttlMs = Number(ttlRaw);

  if (!Number.isFinite(count) || !Number.isFinite(ttlMs)) {
    return null;
  }

  return {
    count,
    ttlMs: Math.max(1, ttlMs),
  };
};

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;

  let timeoutHandle: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
};

const closeRedisClientSafely = async (client: RedisLikeClient) => {
  try {
    if (client.isOpen && client.quit) {
      await client.quit();
      return;
    }
  } catch { }

  try {
    if (client.disconnect) {
      await client.disconnect();
      return;
    }
  } catch { }

  try {
    client.destroy?.();
  } catch { }
};

const getRedisHost = (): string | undefined => {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return undefined;
  try {
    const parsed = new URL(redisUrl);
    return parsed.host || undefined;
  } catch {
    return undefined;
  }
};

const loadRedisModule = async (): Promise<RedisModuleLike | null> => {
  try {
    const dynamicImport = new Function("moduleName", "return import(moduleName)") as (
      moduleName: string,
    ) => Promise<unknown>;
    const imported = await dynamicImport("redis");
    if (!imported || typeof imported !== "object") return null;
    const maybeModule = imported as Partial<RedisModuleLike>;
    if (typeof maybeModule.createClient !== "function") return null;
    return maybeModule as RedisModuleLike;
  } catch {
    return null;
  }
};

const createRedisRateLimitStore = async (): Promise<RateLimitStore | null> => {
  const mode = parseRateLimitStoreMode(process.env.API_RATE_LIMIT_STORE);
  const redisUrl = process.env.REDIS_URL?.trim();

  if (mode === "memory") return null;
  if (!redisUrl) {
    rateLimitStoreLastError = "REDIS_URL is not configured";
    if (mode === "redis" && !redisWarningLogged) {
      redisWarningLogged = true;
      console.warn(
        "[rate-limit.redis] API_RATE_LIMIT_STORE=redis but REDIS_URL is not configured. Using memory store.",
      );
    }
    return null;
  }

  const redisModule = await loadRedisModule();
  if (!redisModule) {
    rateLimitStoreLastError = "Redis package is not installed";
    if (!redisWarningLogged) {
      redisWarningLogged = true;
      console.warn(
        "[rate-limit.redis] Redis package is not installed. Using memory store.",
      );
    }
    return null;
  }

  const connectTimeoutMs = parseNumberEnv(
    process.env.REDIS_CONNECT_TIMEOUT_MS,
    DEFAULT_REDIS_CONNECT_TIMEOUT_MS,
  );
  const commandTimeoutMs = parseNumberEnv(
    process.env.REDIS_COMMAND_TIMEOUT_MS,
    DEFAULT_REDIS_COMMAND_TIMEOUT_MS,
  );
  const client = redisModule.createClient({
    url: redisUrl,
    socket: {
      connectTimeout: connectTimeoutMs,
      reconnectStrategy: () => false,
    },
  });

  client.on?.("error", (error) => {
    const message = toErrorMessage(error) || "Unknown Redis error";
    const normalizedMessage = message.trim() || "Unknown Redis error";
    const now = Date.now();
    if (
      normalizedMessage !== lastRedisErrorMessage ||
      now - lastRedisErrorLogAt >= REDIS_ERROR_LOG_INTERVAL_MS
    ) {
      lastRedisErrorMessage = normalizedMessage;
      lastRedisErrorLogAt = now;
      console.error("[rate-limit.redis.error]", {
        message: normalizedMessage,
      });
    }
  });

  try {
    if (!client.isOpen && client.connect) {
      await withTimeout(
        client.connect(),
        connectTimeoutMs,
        `Redis connect timed out after ${connectTimeoutMs}ms`,
      );
    }
    rateLimitStoreLastError = null;
  } catch (error) {
    rateLimitStoreLastError = toErrorMessage(error);
    if (!redisWarningLogged) {
      redisWarningLogged = true;
      console.warn("[rate-limit.redis] Failed to connect. Using memory store.", {
        message: toErrorMessage(error),
      });
    }
    await closeRedisClientSafely(client);
    return null;
  }

  const keyPrefix =
    process.env.API_RATE_LIMIT_REDIS_PREFIX?.trim() || DEFAULT_REDIS_KEY_PREFIX;

  return {
    name: "redis",
    consume: async (key: string, windowMs: number): Promise<RateLimitStoreResult> => {
      const redisKey = `${keyPrefix}:${key}`;
      try {
        const result = await withTimeout(
          client.eval(REDIS_RATE_LIMIT_SCRIPT, {
            keys: [redisKey],
            arguments: [String(windowMs)],
          }),
          commandTimeoutMs,
          `Redis rate-limit command timed out after ${commandTimeoutMs}ms`,
        );
        const parsed = parseRedisEvalResult(result);
        if (!parsed) {
          throw new Error("Unexpected Redis response for rate limiter");
        }
        return parsed;
      } catch (error) {
        rateLimitStoreLastError = toErrorMessage(error);
        if (!redisWarningLogged) {
          redisWarningLogged = true;
          console.warn("[rate-limit.redis] Runtime failure. Falling back to memory store.", {
            message: rateLimitStoreLastError,
          });
        }

        cachedRateLimitStore = memoryRateLimitStore;
        rateLimitStoreInitPromise = Promise.resolve(memoryRateLimitStore);
        void closeRedisClientSafely(client);

        return memoryRateLimitStore.consume(key, windowMs);
      }
    },
    close: async () => {
      await closeRedisClientSafely(client);
    },
  };
};

const buildRateLimitStore = async (): Promise<RateLimitStore> => {
  const redisStore = await createRedisRateLimitStore();
  if (redisStore) return redisStore;
  return createMemoryRateLimitStore();
};

const getRateLimitStore = async (): Promise<RateLimitStore> => {
  if (cachedRateLimitStore) return cachedRateLimitStore;
  if (!rateLimitStoreInitPromise) {
    const initSeq = ++rateLimitStoreInitSeq;
    rateLimitStoreInitPromise = buildRateLimitStore()
      .then((store) => {
        if (initSeq === rateLimitStoreInitSeq) {
          cachedRateLimitStore = store;
        }
        return store;
      })
      .catch((error) => {
        if (initSeq === rateLimitStoreInitSeq) {
          rateLimitStoreInitPromise = null;
        }
        throw error;
      });
  }
  return rateLimitStoreInitPromise;
};

export const warmupRateLimitStore = async (): Promise<RateLimitStoreName> => {
  const store = await getRateLimitStore();
  return store.name;
};

const getStoreInitTimeoutMs = () =>
  parseNumberEnv(
    process.env.API_RATE_LIMIT_STORE_INIT_TIMEOUT_MS,
    DEFAULT_RATE_LIMIT_STORE_INIT_TIMEOUT_MS,
  );

const getRateLimitStoreWithTimeout = async (): Promise<RateLimitStore> => {
  const timeoutMs = getStoreInitTimeoutMs();
  if (timeoutMs <= 0) {
    return getRateLimitStore();
  }

  let timeoutHandle: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<RateLimitStore>((resolve) => {
    timeoutHandle = setTimeout(() => {
      if (!rateLimitStoreInitTimeoutWarningLogged) {
        rateLimitStoreInitTimeoutWarningLogged = true;
        console.warn("[rate-limit.store.init_timeout] falling back to memory store", {
          timeoutMs,
        });
      }
      if (!cachedRateLimitStore) {
        rateLimitStoreLastError =
          rateLimitStoreLastError ||
          `Rate-limit store init timed out after ${timeoutMs}ms`;
        rateLimitStoreInitSeq++;
        cachedRateLimitStore = memoryRateLimitStore;
        rateLimitStoreInitPromise = Promise.resolve(memoryRateLimitStore);
      }
      resolve(memoryRateLimitStore);
    }, timeoutMs);
  });

  const store = await Promise.race([getRateLimitStore(), timeoutPromise]);
  if (timeoutHandle) clearTimeout(timeoutHandle);
  return store;
};

export const getRateLimitServiceHealth = async (): Promise<RateLimitServiceHealth> => {
  const options = buildRateLimitOptions();
  const mode = parseRateLimitStoreMode(process.env.API_RATE_LIMIT_STORE);
  const redisConfigured = Boolean(process.env.REDIS_URL?.trim());
  const redisHost = getRedisHost();

  if (!options.enabled) {
    return {
      status: "not_configured",
      details: {
        enabled: false,
        mode,
        activeStore: cachedRateLimitStore?.name || "unknown",
        redisConfigured,
        redisHost,
        reason: "rate_limit_disabled",
      },
    };
  }

  try {
    const store = await getRateLimitStore();

    if (mode === "redis") {
      if (!redisConfigured) {
        return {
          status: "degraded",
          details: {
            enabled: true,
            mode,
            activeStore: store.name,
            redisConfigured: false,
            redisHost,
            reason: "redis_url_missing",
            lastError: rateLimitStoreLastError || undefined,
          },
        };
      }

      if (store.name !== "redis") {
        return {
          status: "degraded",
          details: {
            enabled: true,
            mode,
            activeStore: store.name,
            redisConfigured: true,
            redisHost,
            reason: "redis_unavailable_fallback_memory",
            lastError: rateLimitStoreLastError || undefined,
          },
        };
      }
    }

    if (mode === "auto" && redisConfigured && store.name !== "redis") {
      return {
        status: "degraded",
        details: {
          enabled: true,
          mode,
          activeStore: store.name,
          redisConfigured: true,
          redisHost,
          reason: "redis_unavailable_fallback_memory",
          lastError: rateLimitStoreLastError || undefined,
        },
      };
    }

    return {
      status: "healthy",
      details: {
        enabled: true,
        mode,
        activeStore: store.name,
        redisConfigured,
        redisHost,
      },
    };
  } catch (error) {
    return {
      status: "degraded",
      details: {
        enabled: true,
        mode,
        activeStore: cachedRateLimitStore?.name || "unknown",
        redisConfigured,
        redisHost,
        reason: "rate_limit_store_init_failed",
        lastError: toErrorMessage(error),
      },
    };
  }
};

export const closeRateLimitStore = async (): Promise<void> => {
  if (cachedRateLimitStore) {
    await cachedRateLimitStore.close();
  }
  cachedRateLimitStore = null;
  rateLimitStoreInitPromise = null;
};

export const resetRateLimitStoreForTests = async (): Promise<void> => {
  inMemoryRateLimitStore.clear();
  cleanupCounter = 0;
  rateLimitStoreLastError = null;
  redisWarningLogged = false;
  rateLimitStoreInitTimeoutWarningLogged = false;
  lastRedisErrorLogAt = 0;
  lastRedisErrorMessage = "";
  rateLimitStoreInitSeq = 0;
  await closeRateLimitStore();
};

export const securityHeadersMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  );
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");

  const forwardedProto = req.header("x-forwarded-proto")?.toLowerCase();
  if (req.secure || forwardedProto === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
};

export const rateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const options = buildRateLimitOptions();
  if (!options.enabled || shouldSkipRateLimit(req)) {
    return next();
  }

  try {
    const store = await getRateLimitStoreWithTimeout();
    const clientKey = resolveClientIdentifier(req);
    const storeResult = await store.consume(clientKey, options.windowMs);
    const nowEpochMs = Date.now();
    const resetAtEpochMs = nowEpochMs + storeResult.ttlMs;
    const remaining = Math.max(0, options.maxRequests - storeResult.count);
    const resetSeconds = Math.max(1, Math.ceil(storeResult.ttlMs / 1000));

    res.setHeader("X-RateLimit-Limit", String(options.maxRequests));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAtEpochMs / 1000)));
    res.setHeader("X-RateLimit-Store", store.name);

    if (storeResult.count > options.maxRequests) {
      res.setHeader("Retry-After", String(resetSeconds));
      return res.status(429).json({
        success: false,
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again in a moment.",
        retryAfterSeconds: resetSeconds,
      });
    }
  } catch (error) {
    console.error("[rate-limit.middleware.error]", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  next();
};
