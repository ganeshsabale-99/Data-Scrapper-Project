import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request } from "express";

import { getDataScopeFromRequest } from "./dataScope";

describe("dataScope", () => {
  it("denies all when role is missing", () => {
    const req = { user: undefined } as Request;
    const scope = getDataScopeFromRequest(req);

    assert.equal(scope.denyAll, true);
  });

  it("allows full access for user with SYSTEM.ADMIN permission", () => {
    const req = {
      user: {
        userId: "admin-1",
        identifier: "admin@example.com",
        type: "email",
        permissions: ["SYSTEM.ADMIN"],
      },
    } as Request;

    const scope = getDataScopeFromRequest(req);
    assert.equal(scope.denyAll, false);
  });
});
