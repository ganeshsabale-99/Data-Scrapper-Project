# External API — How It's Built (Copy-Paste Reference)

This documents the "External API" pattern used in `apps/analyzer-api` — a secure,
API-key-authenticated, rate-limited, scoped, and audit-logged surface that lets
**third-party clients** consume selected data from our database, separate from the
internal/admin API (which uses session/JWT auth).

Use this as the blueprint to build the same thing in another project.

---

## 1. Concept

- Internal APIs use `authenticateToken` (JWT/session) + RBAC permissions.
- External APIs use a **long-lived API key** (`x-api-key` header) issued per **Client**,
  scoped to specific permissions, rate-limited per key, and every request is audit-logged
  to the DB.
- An **Admin** (super-admin only) manages External Clients and issues/revokes keys via
  admin-only endpoints.

Request flow for an external endpoint:

```
Client request (x-api-key header)
  → externalApiAuditLogger   (logs request/response after it finishes)
  → externalApiKeyAuth       (validates key, loads scopes, attaches req.externalApiAuth)
  → externalApiRateLimit     (per-key limit, Redis or in-memory)
  → requireExternalApiScope("resource:action")  (per-route authorization)
  → controller
```

---

## 2. Database Schema (Prisma)

Add these 4 models (`packages/db/prisma/schema.prisma`):

```prisma
model ExternalApiClient {
  id          String                  @id @default(cuid())
  name        String                  @unique
  isActive    Boolean                 @default(true)
  createdAt   DateTime                @default(now())
  updatedAt   DateTime                @updatedAt
  keys        ExternalApiKey[]
  scopes      ExternalApiScope[]
  requestLogs ExternalApiRequestLog[]
}

model ExternalApiKey {
  id                 String                  @id @default(cuid())
  keyId              String                  @unique
  keyPrefix          String
  keyHash            String                  @unique
  isActive           Boolean                 @default(true)
  rateLimitPerMinute Int                     @default(120)
  expiresAt          DateTime?
  revokedAt          DateTime?
  lastUsedAt         DateTime?
  createdAt          DateTime                @default(now())
  updatedAt          DateTime                @updatedAt
  clientId           String
  client             ExternalApiClient       @relation(fields: [clientId], references: [id], onDelete: Cascade)
  requestLogs        ExternalApiRequestLog[]

  @@index([clientId, isActive])
  @@index([expiresAt])
}

model ExternalApiScope {
  id        String            @id @default(cuid())
  clientId  String
  scope     String
  createdAt DateTime          @default(now())
  client    ExternalApiClient @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@unique([clientId, scope], name: "external_api_client_scope_unique")
  @@index([scope])
}

model ExternalApiRequestLog {
  id         BigInt             @id @default(autoincrement())
  requestId  String?
  method     String
  path       String
  statusCode Int
  latencyMs  Int
  ip         String?
  userAgent  String?
  query      Json?
  createdAt  DateTime           @default(now())
  apiKeyId   String?
  clientId   String?
  apiKey     ExternalApiKey?    @relation(fields: [apiKeyId], references: [id], onDelete: SetNull)
  client     ExternalApiClient? @relation(fields: [clientId], references: [id], onDelete: SetNull)

  @@index([createdAt])
  @@index([apiKeyId, createdAt])
}
```

Design notes:
- **Client** = a business/partner (e.g. "Acme Corp"). One client can have multiple keys and scopes.
- **Key** stores only a **hash** of the secret, never the raw value (see §3).
- **Scope** is a simple string like `techpark:national:read`, supports wildcards (`*`, `techpark:*`).
- **RequestLog** is an append-only audit trail, written asynchronously (fire-and-forget) so it never blocks the response.

Run `prisma migrate dev` after adding these.

---

## 3. Key Generation & Hashing (`src/utils/externalApiKeyUtils.ts`)

Raw key format: **`tpk_<keyId>.<secret>`** (`tpk_` = arbitrary prefix, change per project, e.g. `xpk_`).

- `keyId` — public, stored in plaintext, used to look up the row (like a username).
- `secret` — private, only ever shown once at creation time, never stored raw.
- Stored `keyHash = HMAC-SHA256(pepper, "<keyId>.<secret>")`. The `pepper` is a server-side secret env var (never in DB), so even a DB leak alone can't be used to forge/verify keys.
- Comparison uses `crypto.timingSafeEqual` to avoid timing attacks.

```ts
import crypto from "node:crypto";
import { promisify } from "node:util";

const randomBytes = promisify(crypto.randomBytes);
const RAW_API_KEY_REGEX = /^tpk_([A-Za-z0-9_-]{8,})\.([A-Za-z0-9_-]{24,})$/;

export type ParsedExternalApiKey = { keyId: string; secret: string };

export const parseExternalApiKey = (rawValue: string | undefined): ParsedExternalApiKey | null => {
  if (!rawValue) return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  const matched = RAW_API_KEY_REGEX.exec(trimmed);
  if (!matched) return null;
  const keyId = matched[1];
  const secret = matched[2];
  if (!keyId || !secret) return null;
  return { keyId, secret };
};

export const generateExternalApiKeySecret = async (): Promise<string> => {
  const bytes = await randomBytes(32);
  return bytes.toString("base64url").slice(0, 48);
};

export const hashExternalApiKey = (keyId: string, secret: string, pepper: string): string =>
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
```

Env var needed: `EXTERNAL_API_KEY_PEPPER=<long random string>` (fail closed with 503 if missing — see §4).

---

## 4. Auth Middleware (`src/middleware/externalApiAuth.ts`)

Validates the `x-api-key` header, checks active/expired/revoked state, verifies the hash,
and attaches an `ExternalApiAuthContext` to `req.externalApiAuth`.

```ts
import type { NextFunction, Request, Response } from "express";
import { prismaInstance } from "@repo/db";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";
import { hashExternalApiKey, parseExternalApiKey, timingSafeEqualString } from "../utils/externalApiKeyUtils";

const unauthorized = (res: Response) =>
  res.status(401).json({ success: false, code: "UNAUTHORIZED", message: "Unauthorized" });

export const externalApiKeyAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pepper = process.env.EXTERNAL_API_KEY_PEPPER?.trim();
    if (!pepper) {
      console.error("[external-api.auth] EXTERNAL_API_KEY_PEPPER is not configured");
      return res.status(503).json({ success: false, code: "SERVICE_UNAVAILABLE", message: "Service temporarily unavailable" });
    }

    const parsed = parseExternalApiKey(req.header("x-api-key") || undefined);
    if (!parsed) return unauthorized(res);

    const apiKey = await prismaInstance.externalApiKey.findUnique({
      where: { keyId: parsed.keyId },
      include: {
        client: {
          select: { id: true, name: true, isActive: true, scopes: { select: { scope: true } } },
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

    // fire-and-forget "last used" tracking — never blocks the request
    void prismaInstance.externalApiKey
      .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
      .catch((error) => console.warn("[external-api.auth] Failed to update lastUsedAt", error));

    return next();
  } catch (error) {
    return sendSafeErrorResponse(res, error, "externalApi.auth", "Unable to authorize this request right now. Please try again.");
  }
};
```

Add the request-context type augmentation (`src/types/externalApi.d.ts`):

```ts
export type ExternalApiAuthContext = {
  apiKeyId: string;
  keyId: string;
  clientId: string;
  clientName: string;
  scopes: string[];
  rateLimitPerMinute: number;
};

declare global {
  namespace Express {
    interface Request {
      externalApiAuth?: ExternalApiAuthContext;
    }
  }
}

export {};
```

---

## 5. Scope Authorization (`src/middleware/externalApiScope.ts`)

Per-route check. Supports exact match, global wildcard `*`, and prefix wildcards (`techpark:*`).

```ts
import type { NextFunction, Request, Response } from "express";

const normalizeScope = (value: string) => value.trim().toLowerCase();

const hasScope = (grantedScopes: string[], requiredScope: string): boolean => {
  const required = normalizeScope(requiredScope);
  const granted = grantedScopes.map(normalizeScope);
  if (granted.includes(required)) return true;
  if (granted.includes("*")) return true;
  return granted.some((scope) => scope.endsWith("*") && required.startsWith(scope.slice(0, -1)));
};

export const requireExternalApiScope = (requiredScope: string) => (req: Request, res: Response, next: NextFunction) => {
  const grantedScopes = req.externalApiAuth?.scopes || [];
  if (!hasScope(grantedScopes, requiredScope)) {
    return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Forbidden" });
  }
  return next();
};
```

Scope naming convention used here: `<resource>:<region-or-tier>:<action>`, e.g.
`techpark:national:read`, `coworking:national:read`, `mall:national:read`.

---

## 6. Rate Limiting (`src/middleware/externalApiRateLimit.ts`)

Per-API-key sliding window, backed by **Redis** (atomic `INCR` + `PEXPIRE` via a Lua script)
with automatic fallback to an **in-memory Map** if Redis isn't configured or fails to connect.
Sets standard `X-RateLimit-*` / `Retry-After` headers and returns `429` when exceeded.

Key implementation points:
- Rate limit key = `key:<apiKeyId>` — one bucket per API key, not per client (so multiple keys for one client are limited independently).
- Limit per key comes from `req.externalApiAuth.rateLimitPerMinute` (set at key-issue time), default 120/min.
- Window size configurable via `EXTERNAL_API_RATE_LIMIT_WINDOW_MS` (default 60000ms).
- Redis connection is lazy + cached (`redisClientPromise`), and gracefully degrades to memory on any failure — never crashes the request.

(See full source in the current repo at `apps/analyzer-api/src/middleware/externalApiRateLimit.ts` — it's ~70 lines of Redis-Lua-eval + in-memory fallback; copy it verbatim, just rename the env var prefixes if desired.)

Env vars:
```
EXTERNAL_API_RATE_LIMIT_STORE=auto        # auto | memory | redis
EXTERNAL_API_RATE_LIMIT_WINDOW_MS=60000
EXTERNAL_API_RATE_LIMIT_REDIS_PREFIX=analyzer:external-api-rate-limit
REDIS_URL=redis://localhost:6379
```

> Note: in this repo the rate-limit middleware is currently **commented out** on the router
> (`// externalTechparksRouter.use(externalApiRateLimit)`), so enable it explicitly if you
> want it live in your new project.

---

## 7. Audit Logging (`src/middleware/externalApiAudit.ts`)

Registered **first** in the router chain. On `res.on("finish")` it fire-and-forgets a row
into `ExternalApiRequestLog` with method, path, status, latency, IP, user-agent, query params,
and the resolved `apiKeyId`/`clientId` (populated later once auth middleware runs, since the
listener reads `req.externalApiAuth` at response-finish time, after auth has already executed).

```ts
import type { NextFunction, Request, Response } from "express";
import { prismaInstance, type Prisma } from "@repo/db";
import { resolveRequestIp } from "../utils/externalApiKeyUtils";

const toJsonSafeValue = (value: unknown): Prisma.InputJsonValue => {
  try { return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue; }
  catch { return {}; }
};

export const externalApiAuditLogger = (req: Request, res: Response, next: NextFunction) => {
  const startedAt = req.requestStartedAt || Date.now();

  res.on("finish", () => {
    const latencyMs = Math.max(0, Date.now() - startedAt);
    const ip = resolveRequestIp(req.header("x-forwarded-for") || undefined, req.ip || "unknown");
    const path = req.originalUrl.split("?")[0] || req.path || "/";

    void prismaInstance.externalApiRequestLog.create({
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
    }).catch((error) => console.error("[external-api.audit] Failed to persist request log", error));
  });

  next();
};
```

This relies on a small global **request-context middleware** (`src/middleware/requestContext.ts`)
mounted app-wide, which assigns `req.requestId` (from `x-request-id` header or a fresh UUID) and
`req.requestStartedAt`, and echoes `requestId`/`timestamp` into every JSON response automatically.

---

## 8. Router — wiring it together (`src/routes/externalTechparksRouter.ts`)

```ts
import { Router } from "express";
import { getExternalNationalTechParks, getExternalTechParkById } from "../controller/externalTechParkController";
import { externalApiAuditLogger } from "../middleware/externalApiAudit";
import { externalApiKeyAuth } from "../middleware/externalApiAuth";
import { externalApiRateLimit } from "../middleware/externalApiRateLimit";
import { requireExternalApiScope } from "../middleware/externalApiScope";

export const externalTechparksRouter: Router = Router();

// unauthenticated health check
externalTechparksRouter.get("/ping", (req, res) => res.json({ ping: "pong external router" }));

// order matters: audit first (so it captures everything), then auth, then (optionally) rate limit
externalTechparksRouter.use(externalApiAuditLogger);
externalTechparksRouter.use(externalApiKeyAuth);
externalTechparksRouter.use(externalApiRateLimit); // enable if desired

externalTechparksRouter.get(
  "/national-data",
  requireExternalApiScope("techpark:national:read"),
  getExternalNationalTechParks,
);
externalTechparksRouter.get(
  "/techparks/:id",
  requireExternalApiScope("techpark:national:read"),
  getExternalTechParkById,
);
// ...repeat per resource, each with its own scope string
```

Mount it in `src/app.ts` under a versioned/public-facing prefix:

```ts
app.use("/v1", externalTechparksRouter);
app.use("/external-integration", externalTechparksRouter); // optional alias
```

### Controller pattern

Controllers behind this router are just normal Express handlers — nothing external-specific
inside them except: (1) they only ever read data (no writes exposed externally), (2) they
whitelist an explicit `select` of DB columns (never return the raw model), and (3) they use a
shared `sendSafeErrorResponse` helper so internal errors never leak stack traces/DB details to
external clients — only a generic message + your own error `code`.

---

## 9. Admin: issuing & revoking keys

Admin-only (`SYSTEM.SUPER_ADMIN` permission) endpoints to manage clients/keys, in
`src/controller/externalApiKeyManagementController.ts`, mounted on the **internal** admin
router (JWT-authenticated, not API-key):

```ts
// src/routes/adminRouter.ts
const requireSuperAdmin = [authenticateToken, checkPermission(["SYSTEM.SUPER_ADMIN"])] as const;

adminRouter.get("/external/clients", ...requireSuperAdmin, listExternalClients);
adminRouter.post("/external/clients", ...requireSuperAdmin, createExternalClient);
adminRouter.post("/external/keys", ...requireSuperAdmin, issueExternalApiKey);
adminRouter.post("/external/keys/:id/revoke", ...requireSuperAdmin, revokeExternalApiKey);
adminRouter.delete("/external/clients/:id", ...requireSuperAdmin, deleteExternalClient);
```

Key issuance logic (`issueExternalApiKey`):

```ts
export const issueExternalApiKey = async (req: Request, res: Response) => {
  const { clientId, name, rateLimitPerMinute, expiresAt, scopes } = req.body;

  const client = await prismaInstance.externalApiClient.findUnique({ where: { id: clientId }, include: { scopes: true } });
  if (!client) return res.status(404).json({ success: false, message: "Client not found" });

  // create any new scopes for this client
  if (scopes?.length) {
    for (const scopeKey of scopes) {
      if (!client.scopes.find((s) => s.scope === scopeKey)) {
        await prismaInstance.externalApiScope.create({ data: { clientId, scope: scopeKey } });
      }
    }
  }

  const secret = await generateExternalApiKeySecret();
  const keyId = crypto.randomBytes(8).toString("hex");
  const pepper = process.env.EXTERNAL_API_KEY_PEPPER;
  if (!pepper) throw new Error("EXTERNAL_API_KEY_PEPPER is not configured on server");

  const keyHash = hashExternalApiKey(keyId, secret, pepper);
  const fullKey = `tpk_${keyId}.${secret}`; // shown ONCE — not recoverable afterwards

  const apiKey = await prismaInstance.externalApiKey.create({
    data: {
      keyId, clientId, keyPrefix: `tpk_${keyId}`, keyHash,
      rateLimitPerMinute: rateLimitPerMinute || 120,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: true,
    },
  });

  return res.status(201).json({ success: true, data: { ...apiKey, name, rawKey: fullKey } });
};
```

`revokeExternalApiKey` just flips `isActive: false` and stamps `revokedAt` (soft delete — keeps
the audit trail and FK integrity in `ExternalApiRequestLog` intact).

---

## 10. Environment variables checklist

```
EXTERNAL_API_KEY_PEPPER=<generate a long random secret — HMAC key for hashing raw keys>
EXTERNAL_API_RATE_LIMIT_STORE=auto            # auto | memory | redis
EXTERNAL_API_RATE_LIMIT_WINDOW_MS=60000
EXTERNAL_API_RATE_LIMIT_REDIS_PREFIX=<app>:external-api-rate-limit
REDIS_URL=redis://localhost:6379              # optional; falls back to in-memory if absent
```

---

## 11. Steps to replicate in a new project

1. Add the 4 Prisma models (§2), run migration.
2. Copy `externalApiKeyUtils.ts` (§3) — change the `tpk_` prefix to something specific to your product.
3. Copy `externalApiAuth.ts`, `externalApiScope.ts`, `externalApiRateLimit.ts`, `externalApiAudit.ts` (§4–§7) — adjust import paths (`@repo/db` → your DB client) and env var names if you want a different prefix.
4. Add the `req.externalApiAuth` type augmentation (§4) and make sure you already have a `requestId`/`requestStartedAt` request-context middleware (§7), or add a minimal one.
5. Create a dedicated router per external resource group, apply `externalApiAuditLogger` → `externalApiKeyAuth` → (optional) `externalApiRateLimit` as router-level `use()`, then `requireExternalApiScope("<resource>:<action>")` per route (§8).
6. Write read-only controllers with an explicit Prisma `select` — never leak full DB rows (§8).
7. Add admin CRUD endpoints for clients/keys, gated behind your existing internal admin auth + a super-admin-only permission (§9).
8. Set `EXTERNAL_API_KEY_PEPPER` (and Redis config if using rate limiting) in `.env` (§10).
9. Mount the router in your app entrypoint under a stable public prefix, e.g. `app.use("/v1", externalRouter)`.
10. To issue a key: call the admin "create client" then "issue key" endpoints; hand the returned `rawKey` to the partner — it is shown once and cannot be retrieved again (only re-issued).
