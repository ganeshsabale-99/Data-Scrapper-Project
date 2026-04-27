import { prismaInstance } from "@repo/db";
import {
  getEmailTransportMetadata,
  verifyEmailTransportConnection,
} from "./emailService";
import {
  getRateLimitServiceHealth,
  type RateLimitServiceHealth,
} from "../middleware/security";

type HealthStatus = "healthy" | "degraded" | "unhealthy" | "not_configured";
type LogLevel = "info" | "warn" | "error";

type ServiceHealthDetails = {
  status: HealthStatus;
  latencyMs?: number;
  details?: Record<string, unknown>;
  error?: string;
};

export type ServiceHealthSnapshot = {
  generatedAt: string;
  environment: string;
  uptimeSeconds: number;
  uptimeHuman: string;
  services: {
    backend: ServiceHealthDetails;
    database: ServiceHealthDetails;
    smtp: ServiceHealthDetails;
    s3: ServiceHealthDetails;
    rateLimit: ServiceHealthDetails;
  };
};

const SERVICE_NAME = "analyzer-api";
const DEFAULT_DB_HEALTH_TIMEOUT_MS = 3000;
const DEFAULT_SMTP_HEALTH_TIMEOUT_MS = 5000;
const DEFAULT_RATE_LIMIT_HEALTH_TIMEOUT_MS = 1200;

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
};

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
};

const formatDuration = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const days = Math.floor(safeSeconds / 86400);
  const hours = Math.floor((safeSeconds % 86400) / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  const chunks: string[] = [];
  if (days > 0) chunks.push(`${days}d`);
  if (hours > 0 || days > 0) chunks.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) chunks.push(`${minutes}m`);
  chunks.push(`${remainingSeconds}s`);

  return chunks.join(" ");
};

const withHealthTimeout = async <
  T extends {
    status: HealthStatus;
    latencyMs?: number;
    details?: Record<string, unknown>;
    error?: string;
  },
>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: () => T,
): Promise<T> => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  let timeoutHandle: NodeJS.Timeout | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeoutHandle = setTimeout(() => {
          resolve(fallback());
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
};

const log = (level: LogLevel, event: string, payload: Record<string, unknown>) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    service: SERVICE_NAME,
    ...payload,
  };

  const line = JSON.stringify(logEntry);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
};

const shouldVerifySmtp = (mode: "startup" | "heartbeat"): boolean => {
  const defaultValue = mode === "startup" ? process.env.NODE_ENV === "production" : false;
  const envKey = mode === "startup" ? "HEALTH_VERIFY_SMTP_ON_STARTUP" : "HEALTH_VERIFY_SMTP_ON_HEARTBEAT";
  return parseBoolean(process.env[envKey], defaultValue);
};

const checkDatabaseHealth = async (): Promise<ServiceHealthDetails> => {
  const startedAt = Date.now();
  try {
    await prismaInstance.$queryRaw`SELECT 1`;
    return {
      status: "healthy",
      latencyMs: Date.now() - startedAt,
      details: {
        connected: true,
      },
    };
  } catch (error) {
    return {
      status: "unhealthy",
      latencyMs: Date.now() - startedAt,
      error: toErrorMessage(error),
      details: {
        connected: false,
      },
    };
  }
};

const checkSmtpHealth = async (verifyConnection: boolean): Promise<ServiceHealthDetails> => {
  const metadata = getEmailTransportMetadata();
  if (!metadata.configured) {
    return {
      status: "not_configured",
      details: {
        configured: false,
        provider: metadata.provider,
        source: metadata.source,
      },
    };
  }

  if (!verifyConnection) {
    return {
      status: "healthy",
      details: {
        configured: true,
        provider: metadata.provider,
        source: metadata.source,
        verification: "skipped",
      },
    };
  }

  const verification = await verifyEmailTransportConnection();
  return {
    status: verification.status === "healthy" ? "healthy" : "unhealthy",
    latencyMs: verification.latencyMs,
    error: verification.error,
    details: {
      configured: true,
      provider: verification.metadata.provider,
      source: verification.metadata.source,
      host: verification.metadata.host,
      port: verification.metadata.port,
      secure: verification.metadata.secure,
    },
  };
};

const checkS3Health = (): ServiceHealthDetails => {
  const requiredKeys = [
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_S3_BUCKET_NAME",
  ] as const;

  const missingKeys = requiredKeys.filter((key) => !process.env[key]);
  if (missingKeys.length === requiredKeys.length) {
    return {
      status: "not_configured",
      details: {
        configured: false,
        missingKeys,
      },
    };
  }

  if (missingKeys.length > 0) {
    return {
      status: "degraded",
      details: {
        configured: false,
        missingKeys,
      },
    };
  }

  return {
    status: "healthy",
    details: {
      configured: true,
      region: process.env.AWS_REGION,
      bucket: process.env.AWS_S3_BUCKET_NAME,
    },
  };
};

const resolveLogLevelForSnapshot = (snapshot: ServiceHealthSnapshot): LogLevel => {
  const statuses = Object.values(snapshot.services).map((service) => service.status);
  if (statuses.includes("unhealthy")) return "error";
  if (statuses.includes("degraded")) return "warn";
  return "info";
};

const getServiceSummary = (snapshot: ServiceHealthSnapshot) => ({
  backend: snapshot.services.backend.status,
  database: snapshot.services.database.status,
  smtp: snapshot.services.smtp.status,
  s3: snapshot.services.s3.status,
  rateLimit: snapshot.services.rateLimit.status,
});

export const collectServiceHealthSnapshot = async (
  mode: "startup" | "heartbeat" = "startup",
): Promise<ServiceHealthSnapshot> => {
  const uptimeSeconds = Math.floor(process.uptime());
  const dbTimeoutMs = parseNumber(
    process.env.HEALTH_DB_TIMEOUT_MS,
    DEFAULT_DB_HEALTH_TIMEOUT_MS,
  );
  const smtpTimeoutMs = parseNumber(
    process.env.HEALTH_SMTP_TIMEOUT_MS,
    DEFAULT_SMTP_HEALTH_TIMEOUT_MS,
  );
  const rateLimitTimeoutMs = parseNumber(
    process.env.HEALTH_RATE_LIMIT_TIMEOUT_MS,
    DEFAULT_RATE_LIMIT_HEALTH_TIMEOUT_MS,
  );

  const [database, smtp, rateLimit] = await Promise.all([
    withHealthTimeout(checkDatabaseHealth(), dbTimeoutMs, () => ({
      status: "unhealthy",
      latencyMs: dbTimeoutMs,
      error: `Database health check timed out after ${dbTimeoutMs}ms`,
      details: {
        connected: false,
        timeoutMs: dbTimeoutMs,
      },
    })),
    withHealthTimeout(
      checkSmtpHealth(shouldVerifySmtp(mode)),
      smtpTimeoutMs,
      () => ({
        status: "degraded",
        latencyMs: smtpTimeoutMs,
        error: `SMTP health check timed out after ${smtpTimeoutMs}ms`,
        details: {
          configured: true,
          timeoutMs: smtpTimeoutMs,
        },
      }),
    ),
    withHealthTimeout<RateLimitServiceHealth>(
      getRateLimitServiceHealth(),
      rateLimitTimeoutMs,
      () => ({
        status: "degraded",
        details: {
          enabled: parseBoolean(process.env.API_RATE_LIMIT_ENABLED, true),
          mode: "auto",
          activeStore: "unknown",
          redisConfigured: Boolean(process.env.REDIS_URL?.trim()),
          redisHost: undefined,
          reason: "health_check_timeout",
          lastError: `Rate limit health check timed out after ${rateLimitTimeoutMs}ms`,
        },
      }),
    ),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    uptimeSeconds,
    uptimeHuman: formatDuration(uptimeSeconds),
    services: {
      backend: {
        status: "healthy",
        details: {
          pid: process.pid,
          nodeVersion: process.version,
          memoryRssBytes: process.memoryUsage().rss,
        },
      },
      database,
      smtp,
      s3: checkS3Health(),
      rateLimit,
    },
  };
};

export const logServiceHealthSnapshot = (
  event: string,
  snapshot: ServiceHealthSnapshot,
) => {
  const level = resolveLogLevelForSnapshot(snapshot);
  log(level, event, {
    summary: getServiceSummary(snapshot),
    uptimeSeconds: snapshot.uptimeSeconds,
    uptimeHuman: snapshot.uptimeHuman,
    environment: snapshot.environment,
    services: snapshot.services,
  });
};

export const logOperationalEvent = (
  event: string,
  payload: Record<string, unknown> = {},
  level: LogLevel = "info",
) => {
  log(level, event, payload);
};

export const runStartupHealthChecks = async () => {
  const snapshot = await collectServiceHealthSnapshot("startup");
  logServiceHealthSnapshot("service.health.startup", snapshot);
  return snapshot;
};

export const startHealthHeartbeatLogger = () => {
  const intervalSeconds = parseNumber(
    process.env.HEALTH_HEARTBEAT_INTERVAL_SECONDS,
    process.env.NODE_ENV === "production" ? 300 : 120,
  );

  if (intervalSeconds <= 0) {
    logOperationalEvent("service.health.heartbeat.disabled", {
      reason: "interval_non_positive",
      configuredIntervalSeconds: intervalSeconds,
    });
    return () => {};
  }

  let inFlight = false;
  const intervalMs = intervalSeconds * 1000;
  const timer = setInterval(async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      const snapshot = await collectServiceHealthSnapshot("heartbeat");
      logServiceHealthSnapshot("service.health.heartbeat", snapshot);
    } catch (error) {
      logOperationalEvent(
        "service.health.heartbeat.failed",
        {
          error: toErrorMessage(error),
        },
        "error",
      );
    } finally {
      inFlight = false;
    }
  }, intervalMs);

  timer.unref();

  logOperationalEvent("service.health.heartbeat.started", {
    intervalSeconds,
  });

  return () => clearInterval(timer);
};
