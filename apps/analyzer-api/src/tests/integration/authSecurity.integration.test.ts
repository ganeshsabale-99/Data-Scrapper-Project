import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import request from "supertest";

process.env.SESSION_SECRET = "test-session-secret";
process.env.OTP_SECRET = "test-otp-secret";
process.env.NODE_ENV = "test";

import { app } from "../../app";
import { prismaInstance } from "@repo/db";
import {
  createMfaToken,
  createOTPVerificationData,
} from "../../libs/hashOtpUtils";

describe("Auth Security Responses", () => {
  beforeEach(() => {
    (prismaInstance.adminUser.findUnique as unknown as ReturnType<typeof mock.fn>) =
      mock.fn(async () => null);
  });

  it("returns generic invalid credentials on login when account does not exist", async () => {
    const response = await request(app).post("/auth/login").send({
      email: "missing-user@example.com",
      password: "SomePassword@123",
    });

    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
    assert.equal(response.body.message, "Invalid email or password");
    assert.equal(
      /user not found/i.test(String(response.body.message)),
      false,
    );
  });

  it("returns generic success for forgot-password when account does not exist", async () => {
    const response = await request(app).post("/auth/forgot-password").send({
      email: "missing-user@example.com",
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(
      response.body.message,
      "If an account exists, an OTP has been sent to the registered contact.",
    );
    assert.equal(
      /user not found/i.test(String(response.body.message)),
      false,
    );
    assert.equal(typeof response.body.verificationData?.hash, "string");
  });

  it("returns generic OTP error for reset-password when account does not exist", async () => {
    const otp = "123456";
    const verificationData = createOTPVerificationData(
      "missing-user@example.com",
      otp,
      "email",
    );

    const response = await request(app).post("/auth/reset-password").send({
      email: "missing-user@example.com",
      otp,
      verificationData,
      newPassword: "AnotherPassword@123",
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(response.body.message, "Invalid or expired OTP");
    assert.equal(
      /user not found/i.test(String(response.body.message)),
      false,
    );
  });

  it("returns generic MFA token error instead of account lookup details", async () => {
    const validMfaTokenForDifferentIdentifier = createMfaToken(
      "missing-user-id",
      "someone-else@example.com",
      "email",
    );
    const verificationData = createOTPVerificationData(
      "missing-user@example.com",
      "123456",
      "email",
    );

    const response = await request(app).post("/auth/resend-mfa-otp").send({
      email: "missing-user@example.com",
      mfaToken: validMfaTokenForDifferentIdentifier,
      verificationData,
    });

    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
    assert.equal(response.body.message, "Invalid or expired MFA token");
    assert.equal(
      /user not found/i.test(String(response.body.message)),
      false,
    );
  });
});
