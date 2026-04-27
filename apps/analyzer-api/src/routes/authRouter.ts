
import { Router, type Router as ExpressRouter } from "express";
import {
    generateOTP,
    createOTPVerificationData,
    verifyOTP,
    createSessionToken,
    isValidPhoneNumber,
    isValidEmail,
    getTokenExpirationInfo,
    createMfaToken,
    verifyMfaToken
} from "../libs/hashOtpUtils";

import { GmailSMSService, type SMSDispatchResult } from "../libs/smsService";
import { getEmailService } from "../libs/emailService";
import { prismaInstance } from "@repo/db";
import { hashPassword, verifyPassword } from "../libs/passwordUtils";
import { getQueryString } from "../utils/queryUtils";
import { getCityCatalogOptions } from "../controller/cityCatalogController";
import { upsertCityCatalogEntry } from "../utils/cityCatalog";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";
import { withDbRetry } from "../utils/dbRetry";
import { authenticateToken } from "../middleware/auth";
import {
    resolveUserAccessContext,
    toAccessResponse,
} from "../modules/rbac/accessControlService";

export const authRouter: ExpressRouter = Router()

const OTP_MAX_ATTEMPTS = 3;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const DUMMY_PASSWORD_HASH = "$2a$10$kIW7ZIRMN6isBfDZWQ69IeDZlRQZKJXo9w7yDENnPgWck6P/V.onu";
const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";
const INVALID_OR_EXPIRED_OTP_MESSAGE = "Invalid or expired OTP";
const INVALID_OR_EXPIRED_MFA_TOKEN_MESSAGE = "Invalid or expired MFA token";
const GENERIC_OTP_DISPATCH_MESSAGE =
    "If an account exists, an OTP has been sent to the registered contact.";

type OtpDispatchPurpose =
    | "LOGIN_SEND_OTP"
    | "SIGNUP_SEND_OTP"
    | "SIGNUP_RESEND_OTP"
    | "MFA_RESEND_OTP"
    | "FORGOT_PASSWORD_OTP";
const OTP_DELIVERY_MODE = "EMAIL_GMAIL";
const otpEmailService = new GmailSMSService();

const maskEmailAddress = (email: string): string => {
    const [localPartRaw = "", domainRaw = ""] = email.split("@");
    const localPart = localPartRaw.trim();
    const domain = domainRaw.trim();
    if (!localPart || !domain) return email;

    const maskedLocal =
        localPart.length <= 2
            ? `${localPart[0] || ""}*`
            : `${localPart.slice(0, 2)}${"*".repeat(Math.max(2, localPart.length - 2))}`;

    return `${maskedLocal}@${domain}`;
};

const maskPhoneNumber = (phoneNumber: string): string => {
    const normalized = phoneNumber.trim();
    if (!normalized) return "";
    if (normalized.length <= 4) return normalized;
    return `${normalized.slice(0, 2)}${"*".repeat(Math.max(2, normalized.length - 4))}${normalized.slice(-2)}`;
};

const buildMaskedContactHint = (email: string, phoneNumber: string): string =>
    email ? maskEmailAddress(email) : maskPhoneNumber(phoneNumber);

const buildEmailBackedPhoneNumber = (email: string): string =>
    `mail:${email.trim().toLowerCase()}`;

const toSmsDebugPayload = (dispatch: SMSDispatchResult) => ({
    provider: dispatch.provider,
    transactionId: dispatch.transactionId || null,
    state: dispatch.providerState || null,
    description: dispatch.providerDescription || dispatch.errorMessage || null,
});

const persistOtpDispatchLog = async (params: {
    requestId?: string;
    userId?: string | null;
    phoneNumber: string;
    purpose: OtpDispatchPurpose;
    dispatch: SMSDispatchResult;
    serviceMode?: string;
}) => {
    const { requestId, userId, phoneNumber, purpose, dispatch, serviceMode } = params;
    try {
        await prismaInstance.otpDispatchLog.create({
            data: {
                phoneNumber,
                purpose,
                provider: dispatch.provider,
                serviceMode: serviceMode || dispatch.provider,
                transactionId: dispatch.transactionId || null,
                providerState: dispatch.providerState || null,
                providerDescription:
                    dispatch.providerDescription || dispatch.errorMessage || null,
                accepted: dispatch.accepted,
                requestId: requestId || null,
                userId: userId || null,
            },
        });
    } catch (error) {
        console.error("[auth.otp.dispatchLog.persistFailed]", {
            requestId,
            userId,
            phoneNumber,
            purpose,
            provider: dispatch.provider,
            transactionId: dispatch.transactionId,
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};

const dispatchOtpToEmail = async (params: {
    email: string;
    otp: string;
    requestId?: string;
    userId?: string | null;
    phoneNumber: string;
    purpose: OtpDispatchPurpose;
}) => {
    const { email, otp, requestId, userId, phoneNumber, purpose } = params;
    const dispatchResult = await otpEmailService.sendOTP(email, otp);
    await persistOtpDispatchLog({
        requestId,
        userId,
        phoneNumber,
        purpose,
        dispatch: dispatchResult,
        serviceMode: OTP_DELIVERY_MODE,
    });
    return dispatchResult;
};

const normalizeRoleToken = (value: string) =>
    value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");

type RequestableAccessRole = {
    id: string;
    name: string;
    normalizedName: string;
};

const listRequestableAccessRoles = async (): Promise<RequestableAccessRole[]> => {
    return withDbRetry(
        () =>
            prismaInstance.accessRole.findMany({
                where: {
                    isActive: true,
                    // Exclude system-critical administrative roles from public signup
                    permissions: {
                        none: {
                            permission: {
                                key: {
                                    in: ["SYSTEM.ADMIN", "SYSTEM.SUPER_ADMIN"]
                                }
                            }
                        }
                    }
                },
                select: {
                    id: true,
                    name: true,
                    normalizedName: true,
                },
                orderBy: [{ isSystem: "asc" }, { name: "asc" }],
            }),
        { context: "auth.requestedRoles.list" },
    );
};

const resolveRequestedAccessRole = async (
    requestedRole: string | null | undefined,
): Promise<RequestableAccessRole | null> => {
    const token = typeof requestedRole === "string" ? requestedRole.trim() : "";
    if (!token) return null;

    const normalizedToken = normalizeRoleToken(token);

    // Check database for any active role matching the token
    const role = await withDbRetry(
        () =>
            prismaInstance.accessRole.findFirst({
                where: {
                    isActive: true,
                    OR: [
                        { id: token },
                        { normalizedName: normalizedToken },
                        { name: { equals: token, mode: 'insensitive' } }
                    ]
                },
                select: {
                    id: true,
                    name: true,
                    normalizedName: true
                }
            }),
        { context: "auth.requestedRoles.resolve" },
    );

    return role;
};

const getAuthAccessPayload = async (
    userId: string,
    fallbackRole: string,
    organizationId?: string | null,
) => {
    const resolved = await resolveUserAccessContext(
        userId,
        { role: fallbackRole, organizationId: organizationId || null },
        { allowLegacyFallback: true, fallbackReason: "auth.response" },
    );
    return toAccessResponse(resolved.access);
};

authRouter.get("/requested-roles/options", async (_req, res) => {
    try {
        const roles = await listRequestableAccessRoles();
        return res.json({
            success: true,
            data: roles.map((role) => ({
                id: role.id,
                value: role.id,
                label: role.name,
            })),
        });
    } catch (error) {
        return sendSafeErrorResponse(
            res,
            error,
            "auth.requestedRoles.options",
            "Unable to load role options right now. Please try again.",
        );
    }
});

authRouter.post("/send-otp", async (req, res) => {
    const { email, phoneNumber } = req.body as { email?: string; phoneNumber?: string };
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedPhone = typeof phoneNumber === "string" ? phoneNumber.trim() : "";

    if (!normalizedEmail && !normalizedPhone) {
        return res.status(400).json({
            success: false,
            message: "Email or phone number is required"
        });
    }

    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
        return res.status(400).json({
            success: false,
            message: "Invalid email format"
        });
    }

    if (!normalizedEmail && normalizedPhone && !isValidPhoneNumber(normalizedPhone)) {
        return res.status(400).json({
            success: false,
            message: "Invalid phone number format"
        });
    }

    try {
        const user = normalizedEmail
            ? await prismaInstance.adminUser.findUnique({
                where: { email: normalizedEmail }
            })
            : await prismaInstance.adminUser.findUnique({
                where: { phoneNumber: normalizedPhone }
            });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        if (!user.email) {
            return res.status(400).json({
                success: false,
                message: "Email is unavailable"
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                code: 'ACCOUNT_INACTIVE',
                message: 'Your account is inactive. Please contact the admin.'
            });
        }

        if (user.status === 'REJECTED') {
            return res.status(403).json({
                success: false,
                code: 'ACCOUNT_REJECTED',
                message: 'Your registration was rejected. Please contact support.'
            });
        }

        const hasOtpVerified = Boolean(user.isEmailVerified || user.isMobileVerified);
        if (!hasOtpVerified || user.status === 'OTP_PENDING') {
            return res.status(403).json({
                success: false,
                code: 'OTP_NOT_VERIFIED',
                message: 'Please verify your email before logging in.'
            });
        }

        if (!user.isApprovedByAdmin || user.status === 'ADMIN_APPROVAL_PENDING') {
            return res.status(403).json({
                success: false,
                code: 'ADMIN_APPROVAL_PENDING',
                message: 'Your account is awaiting admin approval.'
            });
        }

        if (user.status !== 'ACTIVE') {
            return res.status(403).json({
                success: false,
                code: 'ACCOUNT_NOT_ACTIVE',
                message: 'Your account is not active.'
            });
        }

        const otp = generateOTP();
        const verificationData = createOTPVerificationData(user.email, otp, 'email');

        const dispatchResult = await dispatchOtpToEmail({
            email: user.email,
            otp,
            requestId: req.requestId,
            userId: user.id,
            phoneNumber: user.phoneNumber,
            purpose: "LOGIN_SEND_OTP",
        });

        if (!dispatchResult.accepted) {
            return res.status(503).json({
                success: false,
                code: "OTP_DELIVERY_UNAVAILABLE",
                message: "OTP email service is temporarily unavailable. Please try again.",
                ...(process.env.NODE_ENV === "development"
                    ? { sms: toSmsDebugPayload(dispatchResult) }
                    : {}),
            });
        }

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully to your registered email.",
            verificationData,
            otp: process.env.NODE_ENV === 'development' ? otp : undefined,
            deliveryChannel: "EMAIL",
            deliveryAddress: maskEmailAddress(user.email),
            ...(process.env.NODE_ENV === "development"
                ? { sms: toSmsDebugPayload(dispatchResult) }
                : {}),
        });

    } catch (error) {
        return sendSafeErrorResponse(
            res,
            error,
            "auth.sendOtp",
            "Unable to send OTP right now. Please try again."
        );
    }
})

authRouter.post("/login", async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || !password) {
        return res.status(400).json({
            success: false,
            message: "Email and password are required"
        });
    }

    if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({
            success: false,
            message: "Invalid email format"
        });
    }

    try {
        const loginStartedAt = Date.now();
        const slowThresholdMs = Number.parseInt(
            process.env.LOGIN_SLOW_THRESHOLD_MS || "700",
            10,
        );

        const dbQueryStartedAt = Date.now();
        const user = await withDbRetry(
            () =>
                prismaInstance.adminUser.findUnique({
                    where: { email: normalizedEmail },
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        email: true,
                        city: true,
                        state: true,
                        organizationId: true,
                        passwordHash: true,
                        isActive: true,
                        status: true,
                        isEmailVerified: true,
                        isMobileVerified: true,
                        isApprovedByAdmin: true,
                    }
                }),
            { context: "auth.login.findUser" },
        );
        const dbQueryMs = Date.now() - dbQueryStartedAt;

        const passwordHashForComparison = user?.passwordHash || DUMMY_PASSWORD_HASH;
        const passwordCheckStartedAt = Date.now();
        const isPasswordValid = await verifyPassword(password, passwordHashForComparison);
        const passwordCheckMs = Date.now() - passwordCheckStartedAt;
        const totalLoginMs = Date.now() - loginStartedAt;

        if (totalLoginMs >= slowThresholdMs) {
            console.warn("[auth.login.slow]", {
                email: normalizedEmail,
                totalMs: totalLoginMs,
                dbQueryMs,
                passwordCheckMs,
                thresholdMs: slowThresholdMs,
            });
        }

        if (!user || !user.passwordHash || !isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: INVALID_CREDENTIALS_MESSAGE,
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                code: 'ACCOUNT_INACTIVE',
                message: 'Your account is not active yet. Please contact the admin to activate your access.'
            });
        }

        if (user.status === 'REJECTED') {
            return res.status(403).json({
                success: false,
                code: 'ACCOUNT_REJECTED',
                message: 'Your registration was rejected. Please contact support.'
            });
        }

        const hasOtpVerified = Boolean(user.isEmailVerified || user.isMobileVerified);
        if (!hasOtpVerified || user.status === 'OTP_PENDING') {
            return res.status(403).json({
                success: false,
                code: 'OTP_NOT_VERIFIED',
                message: 'Please verify your email before logging in.'
            });
        }

        if (!user.isApprovedByAdmin || user.status === 'ADMIN_APPROVAL_PENDING') {
            return res.status(403).json({
                success: false,
                code: 'ADMIN_APPROVAL_PENDING',
                message: 'Your account is awaiting admin approval.'
            });
        }

        if (user.status !== 'ACTIVE') {
            return res.status(403).json({
                success: false,
                code: 'ACCOUNT_NOT_ACTIVE',
                message: 'Your account is not active.'
            });
        }

        const fallbackRole = "USER";
        const access = await withDbRetry(
            () =>
                getAuthAccessPayload(
                    user.id,
                    fallbackRole,
                    user.organizationId || null,
                ),
            { context: "auth.login.resolveAccess" },
        );
        const sessionToken = createSessionToken(user.id, user.email, 'email');
        return res.status(200).json({
            success: true,
            message: "Login successful",
            user: {
                id: user.id,
                name: user.name,
                phoneNumber: user.phoneNumber,
                email: user.email,
                role: access.effectiveRole,
                city: user.city,
                state: user.state,
                permissions: access.permissions,
                accessFlags: access.flags,
            },
            access,
            sessionToken
        });
    } catch (error) {
        return sendSafeErrorResponse(
            res,
            error,
            "auth.login",
            "Unable to process login request right now. Please try again."
        );
    }
});

authRouter.post("/verify-otp", async (req, res) => {
    const { verificationData, otp, email, phoneNumber, mfaToken } = req.body as {
        verificationData?: { hash: string; timestamp: number; counter: number };
        otp?: string;
        email?: string;
        phoneNumber?: string;
        mfaToken?: string;
    };

    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedPhone = typeof phoneNumber === "string" ? phoneNumber.trim() : "";
    const otpIdentifier = normalizedEmail || normalizedPhone;

    if (!verificationData || !otp || !otpIdentifier) {
        return res.status(400).json({
            success: false,
            message: "Verification data, OTP, and email or phone number are required"
        });
    }

    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
        return res.status(400).json({
            success: false,
            message: "Invalid email format"
        });
    }

    if (!normalizedEmail && normalizedPhone && !isValidPhoneNumber(normalizedPhone)) {
        return res.status(400).json({
            success: false,
            message: "Invalid phone number format"
        });
    }

    try {
        if (mfaToken) {
            const mfaPayload = verifyMfaToken(mfaToken);
            if (!mfaPayload || mfaPayload.identifier !== otpIdentifier) {
                return res.status(401).json({
                    success: false,
                    message: INVALID_OR_EXPIRED_MFA_TOKEN_MESSAGE,
                });
            }

            const user = await prismaInstance.adminUser.findUnique({
                where: { id: mfaPayload.userId }
            });

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: INVALID_OR_EXPIRED_MFA_TOKEN_MESSAGE,
                });
            }

            if (normalizedEmail && user.email !== normalizedEmail) {
                return res.status(401).json({
                    success: false,
                    message: INVALID_OR_EXPIRED_MFA_TOKEN_MESSAGE,
                });
            }

            if (!normalizedEmail && normalizedPhone && user.phoneNumber !== normalizedPhone) {
                return res.status(401).json({
                    success: false,
                    message: INVALID_OR_EXPIRED_MFA_TOKEN_MESSAGE,
                });
            }

            if (!user.email) {
                return res.status(400).json({
                    success: false,
                    message: "User email not found"
                });
            }

            const { hash, timestamp, counter } = verificationData;
            const verificationIdentifier = normalizedEmail || user.email || normalizedPhone;
            const isValid = verifyOTP(verificationIdentifier, otp, hash, timestamp, counter);

            if (!isValid) {
                return res.status(400).json({
                    success: false,
                    message: INVALID_OR_EXPIRED_OTP_MESSAGE,
                });
            }

            if (!user.isActive) {
                return res.status(403).json({
                    success: false,
                    code: 'ACCOUNT_INACTIVE',
                    message: 'Your account is inactive. Please contact the admin.'
                });
            }

            const fallbackRole = "USER";
            const access = await getAuthAccessPayload(
                user.id,
                fallbackRole,
                user.organizationId || null,
            );
            const sessionToken = createSessionToken(user.id, user.email, 'email');

            return res.status(200).json({
                success: true,
                message: "OTP verified successfully",
                user: {
                    id: user.id,
                    name: user.name,
                    phoneNumber: user.phoneNumber,
                    email: user.email,
                    role: access.effectiveRole,
                    city: user.city,
                    state: user.state,
                    permissions: access.permissions,
                    accessFlags: access.flags,

                },
                access,
                sessionToken
            });
        }

        const user = normalizedEmail
            ? await prismaInstance.adminUser.findUnique({
                where: { email: normalizedEmail }
            })
            : await prismaInstance.adminUser.findUnique({
                where: { phoneNumber: normalizedPhone }
            });

        if (!user) {
            return res.status(200).json({
                success: true,
                message: "If an account exists for this email, an OTP has been sent."
            });
        }

        if (user.status === 'REJECTED') {
            return res.status(403).json({
                success: false,
                code: 'ACCOUNT_REJECTED',
                message: 'Your registration was rejected. Please contact support.'
            });
        }

        const hasOtpVerified = Boolean(user.isEmailVerified || user.isMobileVerified);
        if (hasOtpVerified && user.status !== 'OTP_PENDING') {
            return res.status(409).json({
                success: false,
                message: "Email already verified"
            });
        }

        if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
            return res.status(429).json({
                success: false,
                code: 'OTP_ATTEMPTS_EXCEEDED',
                message: "Too many OTP attempts. Please resend OTP."
            });
        }

        const { hash, timestamp, counter } = verificationData;
        const verificationIdentifier = normalizedEmail || user.email || normalizedPhone;
        const isValid = verifyOTP(verificationIdentifier, otp, hash, timestamp, counter);

        if (!isValid) {
            const attempts = user.otpAttempts + 1;
            await prismaInstance.adminUser.update({
                where: { id: user.id },
                data: { otpAttempts: attempts }
            });

            return res.status(400).json({
                success: false,
                code: 'OTP_INVALID',
                message: "Invalid or expired OTP",
                attemptsRemaining: Math.max(0, OTP_MAX_ATTEMPTS - attempts)
            });
        }

        await prismaInstance.adminUser.update({
            where: { id: user.id },
            data: {
                isEmailVerified: true,
                // Keep legacy field in sync to avoid blocking older checks/clients.
                isMobileVerified: true,
                status: 'ADMIN_APPROVAL_PENDING',
                otpVerifiedAt: new Date(),
                otpAttempts: 0
            }
        });

        return res.status(200).json({
            success: true,
            message: "OTP verified. Your account is pending admin approval."
        });

    } catch (error) {
        return sendSafeErrorResponse(
            res,
            error,
            "auth.verifyOtp",
            "Unable to verify OTP right now. Please try again."
        );
    }
})

authRouter.post("/resend-otp", async (req, res) => {
    const { email, phoneNumber } = req.body as { email?: string; phoneNumber?: string };
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedPhone = typeof phoneNumber === "string" ? phoneNumber.trim() : "";

    if (!normalizedEmail && !normalizedPhone) {
        return res.status(400).json({
            success: false,
            message: "Email or phone number is required"
        });
    }

    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
        return res.status(400).json({
            success: false,
            message: "Invalid email format"
        });
    }

    if (!normalizedEmail && normalizedPhone && !isValidPhoneNumber(normalizedPhone)) {
        return res.status(400).json({
            success: false,
            message: "Invalid phone number format"
        });
    }

    try {
        const user = normalizedEmail
            ? await prismaInstance.adminUser.findUnique({
                where: { email: normalizedEmail }
            })
            : await prismaInstance.adminUser.findUnique({
                where: { phoneNumber: normalizedPhone }
            });

        if (!user) {
            const otpIdentifier = normalizedEmail || normalizedPhone;
            const placeholderOtp = generateOTP();
            const verificationData = createOTPVerificationData(
                otpIdentifier,
                placeholderOtp,
                normalizedEmail ? "email" : "phone",
            );

            return res.status(200).json({
                success: true,
                message: GENERIC_OTP_DISPATCH_MESSAGE,
                verificationData,
                otp: process.env.NODE_ENV === "development" ? placeholderOtp : undefined,
                deliveryChannel: normalizedEmail ? "EMAIL" : "SMS",
                deliveryAddress: buildMaskedContactHint(normalizedEmail, normalizedPhone),
            });
        }

        if (user.status === 'REJECTED') {
            return res.status(403).json({
                success: false,
                code: 'ACCOUNT_REJECTED',
                message: 'Your registration was rejected. Please contact support.'
            });
        }

        const hasOtpVerified = Boolean(user.isEmailVerified || user.isMobileVerified);
        if (hasOtpVerified && user.status !== 'OTP_PENDING') {
            return res.status(409).json({
                success: false,
                message: "Email already verified"
            });
        }

        if (user.status !== 'OTP_PENDING') {
            return res.status(400).json({
                success: false,
                message: "OTP resend is only available for pending registrations."
            });
        }

        if (!user.email) {
            return res.status(400).json({
                success: false,
                message: "Email is unavailable for OTP delivery."
            });
        }

        if (user.otpLastSentAt) {
            const elapsed = Date.now() - new Date(user.otpLastSentAt).getTime();
            if (elapsed < OTP_RESEND_COOLDOWN_MS) {
                return res.status(429).json({
                    success: false,
                    code: 'OTP_RESEND_COOLDOWN',
                    message: "Please wait before requesting another OTP.",
                    retryAfterMs: OTP_RESEND_COOLDOWN_MS - elapsed
                });
            }
        }

        const otp = generateOTP();
        const verificationData = createOTPVerificationData(user.email, otp, 'email');

        const dispatchResult = await dispatchOtpToEmail({
            email: user.email,
            otp,
            requestId: req.requestId,
            userId: user.id,
            phoneNumber: user.phoneNumber,
            purpose: "SIGNUP_RESEND_OTP",
        });

        if (!dispatchResult.accepted) {
            return res.status(503).json({
                success: false,
                code: "OTP_DELIVERY_UNAVAILABLE",
                message: "OTP email service is temporarily unavailable. Please try again.",
                ...(process.env.NODE_ENV === "development"
                    ? { sms: toSmsDebugPayload(dispatchResult) }
                    : {}),
            });
        }

        await prismaInstance.adminUser.update({
            where: { id: user.id },
            data: { otpLastSentAt: new Date(), otpAttempts: 0 }
        });

        return res.status(200).json({
            success: true,
            message: GENERIC_OTP_DISPATCH_MESSAGE,
            verificationData,
            otp: process.env.NODE_ENV === 'development' ? otp : undefined,
            deliveryChannel: "EMAIL",
            deliveryAddress: maskEmailAddress(user.email),
            ...(process.env.NODE_ENV === "development"
                ? { sms: toSmsDebugPayload(dispatchResult) }
                : {}),
        });
    } catch (error) {
        return sendSafeErrorResponse(
            res,
            error,
            "auth.resendOtp",
            "Unable to resend OTP right now. Please try again."
        );
    }
});

authRouter.post("/resend-mfa-otp", async (req, res) => {
    const { email, phoneNumber, mfaToken } = req.body as {
        email?: string;
        phoneNumber?: string;
        mfaToken?: string;
    };
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedPhone = typeof phoneNumber === "string" ? phoneNumber.trim() : "";
    const otpIdentifier = normalizedEmail || normalizedPhone;

    if (!otpIdentifier || !mfaToken) {
        return res.status(400).json({
            success: false,
            message: "Email and MFA token are required"
        });
    }

    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
        return res.status(400).json({
            success: false,
            message: "Invalid email format"
        });
    }

    if (!normalizedEmail && normalizedPhone && !isValidPhoneNumber(normalizedPhone)) {
        return res.status(400).json({
            success: false,
            message: "Invalid phone number format"
        });
    }

    try {
        const mfaPayload = verifyMfaToken(mfaToken);
        if (!mfaPayload || mfaPayload.identifier !== otpIdentifier) {
            return res.status(401).json({
                success: false,
                message: INVALID_OR_EXPIRED_MFA_TOKEN_MESSAGE,
            });
        }

        const user = await prismaInstance.adminUser.findUnique({
            where: { id: mfaPayload.userId },
            select: { id: true, phoneNumber: true, email: true },
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: INVALID_OR_EXPIRED_MFA_TOKEN_MESSAGE,
            });
        }

        if (normalizedEmail && user.email !== normalizedEmail) {
            return res.status(401).json({
                success: false,
                message: INVALID_OR_EXPIRED_MFA_TOKEN_MESSAGE,
            });
        }

        if (!normalizedEmail && normalizedPhone && user.phoneNumber !== normalizedPhone) {
            return res.status(401).json({
                success: false,
                message: INVALID_OR_EXPIRED_MFA_TOKEN_MESSAGE,
            });
        }

        if (!user.email) {
            return res.status(400).json({
                success: false,
                message: "Email is unavailable for OTP delivery."
            });
        }

        const otp = generateOTP();
        const verificationData = createOTPVerificationData(user.email, otp, 'email');

        const dispatchResult = await dispatchOtpToEmail({
            email: user.email,
            otp,
            requestId: req.requestId,
            userId: user.id,
            phoneNumber: user.phoneNumber,
            purpose: "MFA_RESEND_OTP",
        });

        if (!dispatchResult.accepted) {
            return res.status(503).json({
                success: false,
                code: "OTP_DELIVERY_UNAVAILABLE",
                message: "OTP email service is temporarily unavailable. Please try again.",
                ...(process.env.NODE_ENV === "development"
                    ? { sms: toSmsDebugPayload(dispatchResult) }
                    : {}),
            });
        }

        return res.status(200).json({
            success: true,
            message: "OTP resent successfully",
            verificationData,
            otp: process.env.NODE_ENV === 'development' ? otp : undefined,
            deliveryChannel: "EMAIL",
            deliveryAddress: maskEmailAddress(user.email),
            ...(process.env.NODE_ENV === "development"
                ? { sms: toSmsDebugPayload(dispatchResult) }
                : {}),
        });
    } catch (error) {
        return sendSafeErrorResponse(
            res,
            error,
            "auth.resendMfaOtp",
            "Unable to resend OTP right now. Please try again."
        );
    }
});


async function handleSignup(req: any, res: any) {
    const { phoneNumber, name, email, password, state, city, requestedRole } = req.body as {
        phoneNumber?: string;
        name?: string;
        email?: string;
        password?: string;
        state?: string | null;
        city?: string | null;
        requestedRole?: string | null;
    };
    try {
        const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
        const normalizedPhoneInput = typeof phoneNumber === "string" ? phoneNumber.trim() : "";

        if (!name || typeof name !== "string" || name.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: "Full name is required"
            });
        }
        if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email address"
            });
        }
        if (!password || typeof password !== "string" || password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters"
            });
        }
        if (
            normalizedPhoneInput &&
            !isValidPhoneNumber(normalizedPhoneInput) &&
            !normalizedPhoneInput.includes("@")
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid phone number format"
            });
        }

        const resolvedPhoneNumber = isValidPhoneNumber(normalizedPhoneInput)
            ? normalizedPhoneInput
            : buildEmailBackedPhoneNumber(normalizedEmail);

        const selectedRequestedRole = await resolveRequestedAccessRole(requestedRole);
        if (!selectedRequestedRole) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid requested role."
            });
        }

        const normalizedStateInput = typeof state === "string" ? state.trim() : "";
        const normalizedCityInput = typeof city === "string" ? city.trim() : "";
        const hasState = normalizedStateInput.length > 0;
        const hasCity = normalizedCityInput.length > 0;

        if (!hasState || !hasCity) {
            return res.status(400).json({
                success: false,
                message: "State and city are required."
            });
        }

        if (normalizedCityInput.length < 2) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid city."
            });
        }

        let normalizedState: string | null = null;
        let normalizedCity: string | null = null;
        const upsertedLocation = await upsertCityCatalogEntry(
            normalizedStateInput,
            normalizedCityInput,
        );
        normalizedState = upsertedLocation?.state ?? normalizedStateInput;
        normalizedCity = upsertedLocation?.city ?? normalizedCityInput;

        const isUserAlreadyExist = await prismaInstance.adminUser.findFirst({
            where: {
                OR: [
                    { phoneNumber: resolvedPhoneNumber },
                    { email: normalizedEmail }
                ]
            }
        })

        if (isUserAlreadyExist) {
            return res.status(400).json({
                success: false,
                message: "User already exists with this email"
            })
        }

        const passwordHash = await hashPassword(password);

        const user = await prismaInstance.adminUser.create({
            data: {
                phoneNumber: resolvedPhoneNumber,
                name,
                email: normalizedEmail,
                passwordHash,
                status: 'OTP_PENDING',
                isEmailVerified: false,
                isMobileVerified: false,
                isApprovedByAdmin: false,
                isActive: false,
                city: normalizedCity,
                state: normalizedState,
                requestedRole: selectedRequestedRole.id,
                companyName: null,
                companyDetails: null
            }
        })

        const otp = generateOTP();
        const verificationData = createOTPVerificationData(user.email, otp, 'email');

        const dispatchResult = await dispatchOtpToEmail({
            email: user.email,
            otp,
            requestId: req.requestId,
            userId: user.id,
            phoneNumber: resolvedPhoneNumber,
            purpose: "SIGNUP_SEND_OTP",
        });

        if (!dispatchResult.accepted) {
            return res.status(503).json({
                success: false,
                code: "OTP_DELIVERY_UNAVAILABLE",
                message: "Registration is created, but OTP email service is temporarily unavailable. Please resend OTP.",
                ...(process.env.NODE_ENV === "development"
                    ? { sms: toSmsDebugPayload(dispatchResult) }
                    : {}),
            });
        }

        await prismaInstance.adminUser.update({
            where: { id: user.id },
            data: { otpLastSentAt: new Date(), otpAttempts: 0 }
        });

        return res.status(201).json({
            success: true,
            message: "Registration created. OTP sent to your email.",
            verificationData,
            otp: process.env.NODE_ENV === 'development' ? otp : undefined,
            deliveryChannel: "EMAIL",
            deliveryAddress: maskEmailAddress(user.email),
            ...(process.env.NODE_ENV === "development"
                ? { sms: toSmsDebugPayload(dispatchResult) }
                : {}),
        });
    } catch (error) {
        const code =
            typeof error === "object" &&
                error !== null &&
                "code" in error &&
                typeof (error as { code?: unknown }).code === "string"
                ? ((error as { code: string }).code || "").toUpperCase()
                : "";

        if (code === "P2002") {
            return res.status(409).json({
                success: false,
                code: "USER_ALREADY_EXISTS",
                message: "User already exists with this email"
            });
        }

        return sendSafeErrorResponse(
            res,
            error,
            "auth.signup",
            "Unable to complete signup right now. Please try again."
        );
    }
}

authRouter.post("/signup", handleSignup);
authRouter.post("/register", handleSignup);
authRouter.get("/city-catalog/options", getCityCatalogOptions);
authRouter.get("/access", authenticateToken, async (req, res) => {
    try {
        if (!req.user?.userId || !req.user.role) {
            return res.status(401).json({
                success: false,
                code: "AUTH_REQUIRED",
                message: "Authentication required",
            });
        }

        const access = toAccessResponse({
            userId: req.user.userId,
            organizationId: req.user.organizationId || "org_default",
            effectiveRole: req.user.role,
            permissions: req.user.permissions || [],
            permissionSet: new Set(req.user.permissions || []),
            roleIds: req.user.roleIds || [],
            roleNames: req.user.roleNames || [req.user.role],
            departments: req.user.departments || [],
            hasSuperAdmin: Boolean(req.user.hasSuperAdmin),
        });

        return res.status(200).json({
            success: true,
            data: {
                userId: req.user.userId,
                city: req.user.city || null,
                state: req.user.state || null,
                ...access,
            },
        });
    } catch (error) {
        return sendSafeErrorResponse(
            res,
            error,
            "auth.access",
            "Unable to load your access profile right now. Please try again.",
        );
    }
});

authRouter.post("/forgot-password", async (req, res) => {
    const { email, phoneNumber } = req.body as { email?: string; phoneNumber?: string };

    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedPhone = typeof phoneNumber === "string" ? phoneNumber.trim() : "";

    if (!normalizedEmail && !normalizedPhone) {
        return res.status(400).json({
            success: false,
            message: "Email is required"
        });
    }

    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
        return res.status(400).json({
            success: false,
            message: "Invalid email format"
        });
    }

    if (!normalizedEmail && normalizedPhone && !isValidPhoneNumber(normalizedPhone)) {
        return res.status(400).json({
            success: false,
            message: "Invalid phone number format"
        });
    }

    try {
        const user = normalizedEmail
            ? await prismaInstance.adminUser.findUnique({
                where: { email: normalizedEmail }
            })
            : await prismaInstance.adminUser.findUnique({
                where: { phoneNumber: normalizedPhone }
            });

        if (!user) {
            const otpIdentifier = normalizedEmail || normalizedPhone;
            const placeholderOtp = generateOTP();
            const verificationData = createOTPVerificationData(
                otpIdentifier,
                placeholderOtp,
                normalizedEmail ? "email" : "phone",
            );

            return res.status(200).json({
                success: true,
                message: GENERIC_OTP_DISPATCH_MESSAGE,
                verificationData,
                otp: process.env.NODE_ENV === "development" ? placeholderOtp : undefined,
                deliveryChannel: normalizedEmail ? "EMAIL" : "SMS",
                deliveryAddress: buildMaskedContactHint(normalizedEmail, normalizedPhone),
            });
        }

        // Basic rate limiting for OTP resend
        if (user.otpLastSentAt) {
            const diffMs = Date.now() - new Date(user.otpLastSentAt).getTime();
            if (diffMs < OTP_RESEND_COOLDOWN_MS) {
                return res.status(429).json({
                    success: false,
                    code: "OTP_RESEND_TOO_SOON",
                    message: "Please wait before requesting another OTP."
                });
            }
        }

        const otp = generateOTP();
        const otpIdentifier = normalizedEmail || user.phoneNumber;
        const verificationData = createOTPVerificationData(
            otpIdentifier,
            otp,
            normalizedEmail ? 'email' : 'phone',
        );

        const dispatchResult = await dispatchOtpToEmail({
            email: user.email,
            otp,
            requestId: req.requestId,
            userId: user.id,
            phoneNumber: user.phoneNumber,
            purpose: "FORGOT_PASSWORD_OTP",
        });

        if (!dispatchResult.accepted) {
            return res.status(503).json({
                success: false,
                code: "OTP_DELIVERY_UNAVAILABLE",
                message: "OTP email service is temporarily unavailable. Please try again.",
                ...(process.env.NODE_ENV === "development"
                    ? { sms: toSmsDebugPayload(dispatchResult) }
                    : {}),
            });
        }

        await prismaInstance.adminUser.update({
            where: { id: user.id },
            data: { otpLastSentAt: new Date(), otpAttempts: 0 }
        });

        return res.status(200).json({
            success: true,
            message: GENERIC_OTP_DISPATCH_MESSAGE,
            verificationData,
            otp: process.env.NODE_ENV === 'development' ? otp : undefined,
            deliveryChannel: "EMAIL",
            deliveryAddress: maskEmailAddress(user.email),
            ...(process.env.NODE_ENV === "development"
                ? { sms: toSmsDebugPayload(dispatchResult) }
                : {}),
        });
    } catch (error) {
        return sendSafeErrorResponse(
            res,
            error,
            "auth.forgotPassword",
            "Unable to process forgot password request right now. Please try again."
        );
    }
});

authRouter.post("/reset-password", async (req, res) => {
    const { email, phoneNumber, otp, verificationData, newPassword } = req.body as {
        email?: string;
        phoneNumber?: string;
        otp?: string;
        verificationData?: { hash: string; timestamp: number; counter: number };
        newPassword?: string;
    };

    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedPhone = typeof phoneNumber === "string" ? phoneNumber.trim() : "";

    if ((!normalizedEmail && !normalizedPhone) || !otp || !verificationData || !newPassword) {
        return res.status(400).json({
            success: false,
            message: "Email or phone number, OTP, verification data, and new password are required"
        });
    }

    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
        return res.status(400).json({
            success: false,
            message: "Invalid email format"
        });
    }

    if (!normalizedEmail && normalizedPhone && !isValidPhoneNumber(normalizedPhone)) {
        return res.status(400).json({
            success: false,
            message: "Invalid phone number format"
        });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({
            success: false,
            message: "Password must be at least 8 characters"
        });
    }

    try {
        const user = normalizedEmail
            ? await prismaInstance.adminUser.findUnique({
                where: { email: normalizedEmail }
            })
            : await prismaInstance.adminUser.findUnique({
                where: { phoneNumber: normalizedPhone }
            });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: INVALID_OR_EXPIRED_OTP_MESSAGE,
            });
        }

        if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
            return res.status(429).json({
                success: false,
                code: 'OTP_ATTEMPTS_EXCEEDED',
                message: "Too many OTP attempts. Please request a new OTP."
            });
        }

        const { hash, timestamp, counter } = verificationData;
        const otpIdentifier = normalizedEmail || user.phoneNumber;
        const isValid = verifyOTP(otpIdentifier, otp, hash, timestamp, counter);

        if (!isValid) {
            await prismaInstance.adminUser.update({
                where: { id: user.id },
                data: { otpAttempts: user.otpAttempts + 1 }
            });
            return res.status(400).json({
                success: false,
                message: INVALID_OR_EXPIRED_OTP_MESSAGE,
            });
        }

        const passwordHash = await hashPassword(newPassword);
        await prismaInstance.adminUser.update({
            where: { id: user.id },
            data: { passwordHash, otpAttempts: 0 }
        });

        return res.status(200).json({
            success: true,
            message: "Password reset successfully"
        });
    } catch (error) {
        return sendSafeErrorResponse(
            res,
            error,
            "auth.resetPassword",
            "Unable to reset password right now. Please try again."
        );
    }
});


authRouter.get("/token-status", (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'No token provided',
            code: 'TOKEN_MISSING'
        });
    }

    try {
        const expirationInfo = getTokenExpirationInfo(token);

        if (!expirationInfo) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token format',
                code: 'TOKEN_INVALID'
            });
        }

        if (expirationInfo.isExpired) {
            return res.status(401).json({
                success: false,
                message: 'Session expired. Please login again.',
                code: 'TOKEN_EXPIRED',
                details: {
                    expiredAt: expirationInfo.expiresAt.toISOString(),
                    message: 'Your session has expired after 24 hours. Please login again.'
                }
            });
        }

        const hoursRemaining = Math.floor(expirationInfo.timeRemaining / (60 * 60 * 1000));
        const minutesRemaining = Math.floor((expirationInfo.timeRemaining % (60 * 60 * 1000)) / (60 * 1000));

        return res.status(200).json({
            success: true,
            message: 'Token is valid',
            data: {
                isValid: true,
                expiresAt: expirationInfo.expiresAt.toISOString(),
                timeRemaining: expirationInfo.timeRemaining,
                timeRemainingFormatted: `${hoursRemaining}h ${minutesRemaining}m`,
                isExpired: false
            }
        });

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid token',
            code: 'TOKEN_INVALID'
        });
    }
});

// ─── Update Profile ─────────────────────────────────────────────────────────
const updateProfileHandler = async (req: any, res: any) => {
    const user = (req as any).user;
    const userId: string = user?.userId || user?.id;
    const { name, email, city, state } = req.body as {
        name?: string; email?: string; city?: string; state?: string;
    };

    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    try {
        const updateData: Record<string, string | null> = {};
        if (name?.trim()) updateData.name = name.trim();
        if (email?.trim()) {
            if (!isValidEmail(email.trim())) {
                return res.status(400).json({ success: false, message: "Invalid email address" });
            }
            updateData.email = email.trim();
        }
        if (city?.trim()) updateData.city = city.trim();
        if (state?.trim()) updateData.state = state.trim();

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ success: false, message: "Nothing to update" });
        }

        const updated = await prismaInstance.adminUser.update({
            where: { id: userId },
            data: updateData,
            select: { id: true, name: true, email: true, city: true, state: true, phoneNumber: true },
        });

        return res.json({ success: true, message: "Profile updated", user: updated });
    } catch (error) {
        return sendSafeErrorResponse(
            res,
            error,
            "auth.updateProfile",
            "Unable to update profile right now. Please try again."
        );
    }
};

authRouter.patch("/profile", authenticateToken, updateProfileHandler);
authRouter.put("/profile", authenticateToken, updateProfileHandler);

// ─── Change Password ─────────────────────────────────────────────────────────
authRouter.post("/change-password", authenticateToken, async (req, res) => {
    const user = (req as any).user;
    const userId: string = user?.userId || user?.id;
    const { currentPassword, newPassword } = req.body as {
        currentPassword?: string; newPassword?: string;
    };

    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: "Current and new password are required" });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
    }

    try {
        const dbUser = await prismaInstance.adminUser.findUnique({
            where: { id: userId },
            select: { passwordHash: true },
        });

        if (!dbUser?.passwordHash) {
            return res.status(400).json({ success: false, message: "No password set on this account" });
        }

        const isValid = await verifyPassword(currentPassword, dbUser.passwordHash);
        if (!isValid) {
            return res.status(401).json({ success: false, message: "Current password is incorrect" });
        }

        const newHash = await hashPassword(newPassword);
        await prismaInstance.adminUser.update({
            where: { id: userId },
            data: { passwordHash: newHash },
        });

        return res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
        return sendSafeErrorResponse(res, error, "auth.changePassword", "Failed to change password");
    }
});

// ─── Avatar Upload ───────────────────────────────────────────────────────────
import multer from "multer";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getS3BucketName } from "../libs/s3";

const avatarUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Only image files are allowed"));
        }
        cb(null, true);
    },
});

authRouter.post(
    "/avatar",
    authenticateToken,
    avatarUpload.single("avatar"),
    async (req, res) => {
        const user = (req as any).user;
        const userId: string = user?.userId || user?.id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
        if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

        try {
            const bucket = getS3BucketName();
            const s3 = getS3Client();
            const ext = req.file.originalname.split(".").pop() || "jpg";
            const key = `avatars/${userId}-${Date.now()}.${ext}`;

            await s3.send(new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: req.file.buffer,
                ContentType: req.file.mimetype,
            }));

            const region = process.env.AWS_REGION || "ap-south-1";
            const avatarUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

            // Delete old avatar from S3 if present
            const existing = await prismaInstance.adminUser.findUnique({
                where: { id: userId },
                select: { avatarUrl: true },
            });
            if (existing?.avatarUrl) {
                try {
                    const oldKey = new URL(existing.avatarUrl).pathname.slice(1);
                    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: oldKey }));
                } catch { /* ignore old deletion errors */ }
            }

            await prismaInstance.adminUser.update({
                where: { id: userId },
                data: { avatarUrl },
            });

            return res.json({ success: true, avatarUrl });
        } catch (error) {
            return sendSafeErrorResponse(res, error, "auth.avatar.upload", "Failed to upload avatar");
        }
    }
);

authRouter.delete("/avatar", authenticateToken, async (req, res) => {
    const user = (req as any).user;
    const userId: string = user?.userId || user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    try {
        const existing = await prismaInstance.adminUser.findUnique({
            where: { id: userId },
            select: { avatarUrl: true },
        });

        if (existing?.avatarUrl) {
            try {
                const s3 = getS3Client();
                const bucket = getS3BucketName();
                const oldKey = new URL(existing.avatarUrl).pathname.slice(1);
                await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: oldKey }));
            } catch { /* ignore */ }
        }

        await prismaInstance.adminUser.update({
            where: { id: userId },
            data: { avatarUrl: null },
        });

        return res.json({ success: true, message: "Avatar removed" });
    } catch (error) {
        return sendSafeErrorResponse(res, error, "auth.avatar.remove", "Failed to remove avatar");
    }
});
