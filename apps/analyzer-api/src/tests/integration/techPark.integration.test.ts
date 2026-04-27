import assert from "node:assert/strict";
import { describe, it, mock, before } from "node:test";
import request from "supertest";

// Set env vars BEFORE importing app or libs
process.env.SESSION_SECRET = "test-session-secret";
process.env.OTP_SECRET = "test-otp-secret";
process.env.NODE_ENV = "test";

import { app } from "../../app";
import { prismaInstance } from "@repo/db";
import { createSessionToken } from "../../libs/hashOtpUtils";

describe("Tech Park Integration Flows", () => {
    const testAdmin = {
        userId: "test-admin-id",
        identifier: "admin@test.com",
        type: "email" as const,
    };

    let testToken: string;

    before(() => {
        testToken = createSessionToken(testAdmin.userId, testAdmin.identifier, testAdmin.type);

        // Mock prisma adminUser findUnique for BOTH authentication and RBAC
        (prismaInstance.adminUser.findUnique as any) = mock.fn(async (args: any) => {
            const baseUser = {
                id: testAdmin.userId,
                status: "ACTIVE",
                isActive: true,
                isApprovedByAdmin: true,
                isEmailVerified: true,
                isMobileVerified: true,
                city: "Pune",
                state: "Maharashtra",
                organizationId: "test-org",
            };

            if (args.select?.accessRoles) {
                return {
                    ...baseUser,
                    accessRoles: [
                        {
                            role: {
                                id: "role-admin",
                                name: "Admin",
                                normalizedName: "ADMIN",
                                permissions: [
                                    { permission: { key: "TECHPARKS.VIEW" } },
                                    { permission: { key: "TECHPARKS.MANAGE" } },
                                    { permission: { key: "TECHPARKS.VERIFY" } },
                                    { permission: { key: "SCOPE.NATIONAL_VIEW" } },
                                ],
                                department: { name: "Management" }
                            }
                        }
                    ]
                };
            }
            return baseUser;
        });

        // Mock duplication check count
        (prismaInstance.newTechPark.count as any) = mock.fn(async () => 0);
    });

    describe("POST /new-techparks/city-wise-overview/:state/:city/add-tech-park", () => {
        it("successfully adds a new tech park with valid data", async () => {
            const payload = {
                name: "Integration Test Park",
                address: "123 Tech Street",
                website: "https://testpark.com",
                builder_name: "Test Builder",
                parking_floors: 2,
                total_floors: 10,
                basement_levels: 1,
                seating_capacity: 500,
                lat: 18.5204,
                lng: 73.8567,
                security_agency_name: "Test Agency",
                property_manager_name: "Test Manager",
                property_manager_email: "test@manager.com",
                property_manager_phone: "1234567890",
                spoc_name: "Test SPOC",
                spoc_phone: "0987654321",
                challenges: "Test Challenges",
                exterior_media_urls: ["https://example.com/image.jpg"],
            };

            (prismaInstance.newTechPark.create as any) = mock.fn(async () => {
                return { id: "new-park-id", ...payload };
            });

            const response = await request(app)
                .post("/new-techparks/city-wise-overview/Maharashtra/Pune/add-tech-park")
                .set("Authorization", `Bearer ${testToken}`)
                .send(payload);

            if (response.status !== 201) console.error(response.body);

            assert.strictEqual(response.status, 201);
            assert.strictEqual(response.body.message, "Tech park created successfully.");
            assert.ok(response.body.data !== undefined);
        });

        it("fails when required fields are missing", async () => {
            const payload = {
                address: "Missing Name Street",
            };

            const response = await request(app)
                .post("/new-techparks/city-wise-overview/Maharashtra/Pune/add-tech-park")
                .set("Authorization", `Bearer ${testToken}`)
                .send(payload);

            assert.strictEqual(response.status, 400);
            assert.ok(response.body.error !== undefined);
        });
    });

    describe("POST /new-techparks/:id/verify", () => {
        it("successfully verifies a tech park", async () => {
            const parkId = "park-to-verify";

            // Re-mocking findUnique for THIS specific test call
            // We use the tracker to see if it's called
            const findFirstMock = (prismaInstance.newTechPark.findFirst as any) = mock.fn(async () => {
                return {
                    id: parkId,
                    name: "Existing Park",
                    city: "Pune",
                    state: "Maharashtra",
                    isVerified: false,
                    reviewStatus: "PENDING_REVIEW",
                    verifiedByUserId: null,
                    verifiedAt: null,
                    security_agency_name: "Test Agency",
                    property_manager_name: "Test Manager",
                    property_manager_phone: "1234567890",
                    property_manager_email: "test@test.com",
                    parking_floors: 1,
                    total_floors: 5,
                    basement_levels: 1,
                    spoc_name: "Test Spoc",
                    spoc_phone: "0987654321",
                    seating_capacity: 100,
                    challenges: "None",
                    lat: 18.5204,
                    lng: 73.8567,
                    is_active: true
                };
            });

            (prismaInstance.newTechPark.update as any) = mock.fn(async () => {
                return { id: parkId, isVerified: true, reviewStatus: "APPROVED" };
            });

            (prismaInstance.activityLog.create as any) = mock.fn(async () => ({}));

            const response = await request(app)
                .post(`/new-techparks/${parkId}/verify`)
                .set("Authorization", `Bearer ${testToken}`)
                .send();

            assert.strictEqual(response.status, 200);
            assert.strictEqual(response.body.success, true);
        });
    });
});
