import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import request from "supertest";

process.env.SESSION_SECRET = "test-session-secret";
process.env.OTP_SECRET = "test-otp-secret";
process.env.NODE_ENV = "test";
process.env.EXTERNAL_API_KEY_PEPPER = "external-api-test-pepper";
process.env.API_RATE_LIMIT_ENABLED = "false";
process.env.EXTERNAL_API_RATE_LIMIT_STORE = "memory";

import { app } from "../../app";
import { prismaInstance } from "@repo/db";
import { hashExternalApiKey } from "../../utils/externalApiKeyUtils";

const keyId = "testKey123";
const secret = "test_secret_key_value_123456";
const rawApiKey = `tpk_${keyId}.${secret}`;
const hashedApiKey = hashExternalApiKey(
  keyId,
  secret,
  process.env.EXTERNAL_API_KEY_PEPPER as string,
);

const mockAuthorizedApiKeyRecord = (scopes: string[]) => {
  (prismaInstance.externalApiKey.findUnique as unknown as ReturnType<typeof mock.fn>) = mock.fn(
    async () => ({
      id: "ext-key-id-1",
      keyId,
      keyHash: hashedApiKey,
      isActive: true,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      rateLimitPerMinute: 120,
      client: {
        id: "ext-client-1",
        name: "Partner A",
        isActive: true,
        scopes: scopes.map((scope) => ({ scope })),
      },
    }),
  );
};

describe("External Tech Park API", () => {
  beforeEach(() => {
    (prismaInstance.externalApiKey.findUnique as unknown as ReturnType<typeof mock.fn>) = mock.fn(
      async () => null,
    );
    (prismaInstance.externalApiKey.update as unknown as ReturnType<typeof mock.fn>) = mock.fn(
      async () => ({}),
    );
    (
      prismaInstance.externalApiRequestLog.create as unknown as ReturnType<typeof mock.fn>
    ) = mock.fn(async () => ({}));
  });

  it("returns 401 when x-api-key is missing", async () => {
    const response = await request(app).get("/v1/national-data");
    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
    assert.equal(response.body.code, "UNAUTHORIZED");
  });

  it("returns paginated national data for valid external API key", async () => {
    mockAuthorizedApiKeyRecord(["techpark:national:read"]);

    (prismaInstance.newTechPark.count as unknown as ReturnType<typeof mock.fn>) = mock.fn(
      async () => 1,
    );
    (prismaInstance.newTechPark.findMany as unknown as ReturnType<typeof mock.fn>) = mock.fn(
      async () => [
        {
          id: "park-1",
          name: "Tech Park One",
          city: "Pune",
          state: "Maharashtra",
          is_active: true,
          status: "CONTACTED",
          isVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    );

    const response = await request(app)
      .get("/v1/national-data")
      .set("x-api-key", rawApiKey)
      .query({
        state: "Maharashtra",
        page: 1,
        limit: 500,
        verified: "true",
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.pagination.limit, 200);
    assert.equal(response.body.pagination.totalItems, 1);
    assert.equal(response.body.data.length, 1);
  });

  it("returns 403 when scope is missing", async () => {
    mockAuthorizedApiKeyRecord(["techpark:summary:read"]);

    const response = await request(app)
      .get("/v1/national-data")
      .set("x-api-key", rawApiKey);

    assert.equal(response.status, 403);
    assert.equal(response.body.success, false);
    assert.equal(response.body.code, "FORBIDDEN");
  });

  it("returns tech park details by id", async () => {
    mockAuthorizedApiKeyRecord(["techpark:national:read"]);

    (prismaInstance.newTechPark.findFirst as unknown as ReturnType<typeof mock.fn>) = mock.fn(
      async () => ({
        id: "park-2",
        name: "Tech Park Two",
        city: "Bengaluru",
        state: "Karnataka",
        is_active: true,
        status: "NOT_CONTACTED",
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const response = await request(app)
      .get("/v1/techparks/park-2")
      .set("x-api-key", rawApiKey);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.id, "park-2");
  });
});
