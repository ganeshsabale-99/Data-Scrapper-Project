import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import express, { Express } from "express";
import { parseBooleanEnv } from "./utils/envUtils";

import { authRouter } from "./routes/authRouter";
import { adminRouter } from "./routes/adminRouter";
import { authenticateToken } from "./middleware/auth";
import { Request, Response } from "express";
import { globalErrorHandler } from "./utils/globalErrorHandler";
import { newTechparksRouter } from "./routes/newTechparksRouter";
import { coworkingSpacesRouter } from "./routes/coworkingSpacesRouter";
import { contactLogRouter } from "./routes/contactLogRouter";
import { fundingNewsRouter } from "./routes/fundingNewsRouter";
import { articleSummaryRouter } from "./routes/articleSummaryRouter";
import { startNewsScheduler } from "./libs/newsScheduler";

import { mediaRouter } from "./routes/mediaRouter";
import { rbacRouter } from "./routes/rbacRouter";
import { exportRouter } from "./routes/exportRouter";
import { externalTechparksRouter } from "./routes/externalTechparksRouter";
<<<<<<< HEAD
import { placesReviewRouter } from "./routes/placesReviewRouter";
=======
import { cityAliasRouter } from "./routes/cityAliasRouter";
>>>>>>> 817186e4c4bae91d20437a9298e9db1cd428623d
import { requestContextMiddleware } from "./middleware/requestContext";
import {
  closeRateLimitStore,
  rateLimitMiddleware,
  securityHeadersMiddleware,
  warmupRateLimitStore,
} from "./middleware/security";
import {
  collectServiceHealthSnapshot,
  logOperationalEvent,
  runStartupHealthChecks,
  startHealthHeartbeatLogger,
} from "./libs/serviceHealthLogger";
import { ensureRbacBootstrap } from "./modules/rbac/accessControlService";

// Standard dotenv loading for development. 
// In production/Docker, these are often already injected.
const shouldLoadDotenv = !process.env.DATABASE_URL || !process.env.AWS_S3_BUCKET_NAME;

if (shouldLoadDotenv) {
  dotenv.config();
  if (!process.env.DATABASE_URL) {
    // Attempt to load from workspace root if not found in local app dir
    dotenv.config({ path: path.resolve(process.cwd(), "../../.env"), override: false });
  }
}

export const app: Express = express();



app.disable("x-powered-by");
if (parseBooleanEnv(process.env.TRUST_PROXY, false)) {
  app.set("trust proxy", true);
}

const allowedOrigins = [
  process.env.WEB_APP_URL,
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGIN,
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "https://techparkinsights.gupio.in",
  "https://www.techparkinsights.gupio.in",
  "https://analyzer.guplo.tech",
  "https://www.analyzer.guplo.tech",
  "https://dev-api.gupio.tech",
  "https://api.gupio.tech"
].filter(Boolean) as string[];

const normalizeOrigin = (value: string): string | null => {
  try {
    const parsed = new URL(value);
    return parsed.origin;
  } catch {
    return null;
  }
};

const allowedOriginSet = new Set(
  allowedOrigins
    .map((origin) => normalizeOrigin(origin))
    .filter((origin): origin is string => Boolean(origin)),
);

const isLocalhostOrigin = (origin: string): boolean => {
  try {
    const parsed = new URL(origin);
    return ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  } catch {
    return false;
  }
};

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (e.g., mobile apps, curl requests)
      if (!origin) return cb(null, true);

      const normalizedOrigin = normalizeOrigin(origin);
      const isAllowed =
        (normalizedOrigin ? allowedOriginSet.has(normalizedOrigin) : false) ||
        isLocalhostOrigin(origin);

      if (isAllowed) {
        return cb(null, true);
      }

      // Log but don't throw; missing Access-Control-Allow-Origin header is standard rejection
      console.warn(`[CORS] Rejected request from origin: ${origin}`);
      return cb(null, false);
    },
    credentials: true,
    optionsSuccessStatus: 204,
  }),
);

// Support for /techpark prefix if deployed behind a path-based proxy
app.use((req, _res, next) => {
  if (req.url.startsWith("/techpark/")) {
    req.url = req.url.replace(/^\/techpark/, "");
  }
  next();
});

app.use(requestContextMiddleware);
app.use(securityHeadersMiddleware);
app.use(rateLimitMiddleware);
app.use(express.json({ limit: process.env.API_JSON_BODY_LIMIT || "10mb" }));

app.get("/health/live", (_req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    status: "healthy",
    service: "analyzer-api",
  });
});

app.get("/health", async (_req: Request, res: Response) => {
  try {
    const snapshot = await collectServiceHealthSnapshot("heartbeat");
    const statuses = Object.values(snapshot.services).map((service) => service.status);
    const overallStatus = statuses.includes("unhealthy")
      ? "unhealthy"
      : statuses.includes("degraded")
        ? "degraded"
        : "healthy";

    return res.status(overallStatus === "unhealthy" ? 503 : 200).json({
      success: overallStatus !== "unhealthy",
      status: overallStatus,
      generatedAt: snapshot.generatedAt,
      environment: snapshot.environment,
      uptimeSeconds: snapshot.uptimeSeconds,
      uptimeHuman: snapshot.uptimeHuman,
      services: snapshot.services,
    });
  } catch (error) {
    logOperationalEvent(
      "health.endpoint.failed",
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "error",
    );
    return res.status(503).json({
      success: false,
      status: "unhealthy",
      code: "HEALTH_CHECK_FAILED",
      message: "Unable to collect health snapshot right now.",
    });
  }
});

app.use("/v1", externalTechparksRouter);
app.use("/external-integration", externalTechparksRouter);
app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/techparks", authenticateToken, (_req: Request, res: Response) => {
  return res.status(410).json({
    success: false,
    code: "LEGACY_ENDPOINT_DEPRECATED",
    message: "The /techparks API is deprecated. Use /new-techparks instead.",
  });
});
app.use("/new-techparks", newTechparksRouter);
app.use("/coworking-spaces", coworkingSpacesRouter);
app.use("/contact-logs", authenticateToken, contactLogRouter);
app.use("/funding-news", fundingNewsRouter);
app.use("/articles", articleSummaryRouter);
app.use("/media", authenticateToken, mediaRouter);
app.use("/rbac", rbacRouter);
app.use("/export", exportRouter);
<<<<<<< HEAD
app.use("/places-reviews", placesReviewRouter);
=======
app.use("/city-aliases", cityAliasRouter);
>>>>>>> 817186e4c4bae91d20437a9298e9db1cd428623d

app.use((req: Request, res: Response) => {
  return res.status(404).json({
    success: false,
    code: "NOT_FOUND",
    message: "Requested endpoint does not exist.",
    path: req.originalUrl,
  });
});

app.use(globalErrorHandler);
