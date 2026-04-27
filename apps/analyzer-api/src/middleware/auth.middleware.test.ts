import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { authenticateToken, checkPermission } from "./auth";
import {
  createMockRequest,
  createMockResponse,
  createNextSpy,
} from "../test-utils/httpTestUtils";

describe("auth middleware", () => {
  it("returns TOKEN_MISSING when access token is not provided", async () => {
    const req = createMockRequest({
      method: "GET",
      originalUrl: "/task-tracking/tasks",
    });
    const res = createMockResponse(req);
    const nextSpy = createNextSpy();

    await authenticateToken(req, res, nextSpy.next);

    assert.equal(nextSpy.wasCalled(), false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, {
      success: false,
      message: "Access token required. Please login to continue.",
      code: "TOKEN_MISSING",
    });
  });

  it("returns AUTH_REQUIRED when permission guard is used without authenticated user", async () => {
    const permissionMiddleware = checkPermission(["SYSTEM.ADMIN"]);
    const req = createMockRequest({
      method: "GET",
      originalUrl: "/task-tracking/admin/summary",
    });
    const res = createMockResponse(req);
    const nextSpy = createNextSpy();

    await permissionMiddleware(req, res, nextSpy.next);

    assert.equal(nextSpy.wasCalled(), false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, {
      success: false,
      message: "Authentication required",
      code: "AUTH_REQUIRED",
    });
  });
});
