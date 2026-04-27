import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { requestContextMiddleware } from "./requestContext";
import {
  getRateLimitServiceHealth,
  rateLimitMiddleware,
  resetRateLimitStoreForTests,
} from "./security";
import {
  createMockRequest,
  createMockResponse,
  createNextSpy,
} from "../test-utils/httpTestUtils";

const ORIGINAL_ENV = {
  API_RATE_LIMIT_ENABLED: process.env.API_RATE_LIMIT_ENABLED,
  API_RATE_LIMIT_STORE: process.env.API_RATE_LIMIT_STORE,
  API_RATE_LIMIT_WINDOW_MS: process.env.API_RATE_LIMIT_WINDOW_MS,
  API_RATE_LIMIT_MAX_REQUESTS: process.env.API_RATE_LIMIT_MAX_REQUESTS,
  REDIS_URL: process.env.REDIS_URL,
};

const restoreEnv = () => {
  process.env.API_RATE_LIMIT_ENABLED = ORIGINAL_ENV.API_RATE_LIMIT_ENABLED;
  process.env.API_RATE_LIMIT_STORE = ORIGINAL_ENV.API_RATE_LIMIT_STORE;
  process.env.API_RATE_LIMIT_WINDOW_MS = ORIGINAL_ENV.API_RATE_LIMIT_WINDOW_MS;
  process.env.API_RATE_LIMIT_MAX_REQUESTS = ORIGINAL_ENV.API_RATE_LIMIT_MAX_REQUESTS;
  process.env.REDIS_URL = ORIGINAL_ENV.REDIS_URL;
};

describe("security middleware", () => {
  it("injects requestId and timestamp into JSON responses", () => {
    const req = createMockRequest({
      method: "GET",
      originalUrl: "/health",
      headers: { "x-request-id": "req-custom-001" },
    });
    const res = createMockResponse(req);
    const nextSpy = createNextSpy();

    requestContextMiddleware(req, res, nextSpy.next);
    res.json({ success: true });

    const body = res.body as { requestId?: string; timestamp?: string; success?: boolean };
    assert.equal(nextSpy.wasCalled(), true);
    assert.equal(body.success, true);
    assert.equal(body.requestId, "req-custom-001");
    assert.equal(typeof body.timestamp, "string");
    assert.equal(res.headers["x-request-id"], "req-custom-001");
  });

  it("enforces rate limit and returns RATE_LIMITED after threshold", async () => {
    process.env.API_RATE_LIMIT_ENABLED = "true";
    process.env.API_RATE_LIMIT_STORE = "memory";
    process.env.API_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.API_RATE_LIMIT_MAX_REQUESTS = "1";
    await resetRateLimitStoreForTests();
    try {
      const firstReq = createMockRequest({
        method: "GET",
        originalUrl: "/auth/login",
        path: "/auth/login",
        ip: "10.10.10.10",
      });
      const firstRes = createMockResponse(firstReq);
      const firstNext = createNextSpy();

      await rateLimitMiddleware(firstReq, firstRes, firstNext.next);

      assert.equal(firstNext.wasCalled(), true);
      assert.equal(firstRes.statusCode, 200);
      assert.equal(firstRes.headers["x-ratelimit-store"], "memory");

      const secondReq = createMockRequest({
        method: "GET",
        originalUrl: "/auth/login",
        path: "/auth/login",
        ip: "10.10.10.10",
      });
      const secondRes = createMockResponse(secondReq);
      const secondNext = createNextSpy();

      await rateLimitMiddleware(secondReq, secondRes, secondNext.next);

      assert.equal(secondNext.wasCalled(), false);
      assert.equal(secondRes.statusCode, 429);
      assert.deepEqual(secondRes.body, {
        success: false,
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again in a moment.",
        retryAfterSeconds: 60,
      });
    } finally {
      await resetRateLimitStoreForTests();
      restoreEnv();
    }
  });

  it("reports degraded status when redis mode is enabled without REDIS_URL", async () => {
    process.env.API_RATE_LIMIT_ENABLED = "true";
    process.env.API_RATE_LIMIT_STORE = "redis";
    delete process.env.REDIS_URL;
    await resetRateLimitStoreForTests();

    try {
      const health = await getRateLimitServiceHealth();
      assert.equal(health.status, "degraded");
      assert.equal(health.details.mode, "redis");
      assert.equal(health.details.reason, "redis_url_missing");
    } finally {
      await resetRateLimitStoreForTests();
      restoreEnv();
    }
  });
});
