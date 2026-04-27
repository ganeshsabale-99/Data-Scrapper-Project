import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createOTPVerificationData,
  verifyOTP,
} from "./hashOtpUtils";

const ORIGINAL_ENV = {
  OTP_SECRET: process.env.OTP_SECRET,
  SESSION_SECRET: process.env.SESSION_SECRET,
};

describe("hashOtpUtils", () => {
  it("returns false for malformed OTP hash without throwing", () => {
    process.env.OTP_SECRET = "test-otp-secret";
    process.env.SESSION_SECRET = "test-session-secret";

    const identifier = "9999999999";
    const otp = "123456";
    const data = createOTPVerificationData(identifier, otp, "phone");

    assert.equal(
      verifyOTP(identifier, otp, "not-a-hex-hash", data.timestamp, data.counter),
      false,
    );
  });

  it("validates OTP when hash is correct", () => {
    process.env.OTP_SECRET = "test-otp-secret";
    process.env.SESSION_SECRET = "test-session-secret";

    const identifier = "8888888888";
    const otp = "654321";
    const data = createOTPVerificationData(identifier, otp, "phone");

    assert.equal(verifyOTP(identifier, otp, data.hash, data.timestamp, data.counter), true);
  });
});

process.on("exit", () => {
  process.env.OTP_SECRET = ORIGINAL_ENV.OTP_SECRET;
  process.env.SESSION_SECRET = ORIGINAL_ENV.SESSION_SECRET;
});
