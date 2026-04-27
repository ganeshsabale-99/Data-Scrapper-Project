import { z } from "zod";

export const mobileNumberSchema = z.object({
  mobileNumber: z
    .string()
    .min(1, "Mobile number is required")
    .regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit mobile number")
    .length(10, "Mobile number must be exactly 10 digits"),
});

export const otpSchema = z.object({
  otp: z
    .string()
    .min(1, "OTP is required")
    .regex(/^\d{6}$/, "OTP must be exactly 6 digits")
    .length(6, "OTP must be exactly 6 digits"),
});

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters");

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: passwordSchema,
});

export type MobileNumberFormData = z.infer<typeof mobileNumberSchema>;
export type OTPFormData = z.infer<typeof otpSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
