/// <reference types="node" />
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
    DEFAULT_ORGANIZATION_ID,
    DEFAULT_ORGANIZATION_NAME,
    DEFAULT_ORGANIZATION_SLUG,
    DEFAULT_DEPARTMENT_ID,
    DEFAULT_DEPARTMENT_NAME,
    DEFAULT_DEPARTMENT_NORMALIZED,
    RBAC_PERMISSION_CATALOG,
    DEFAULT_SYSTEM_ROLE_TEMPLATES,
} from "../src/rbacCatalog";

const prisma = new PrismaClient();

const readEnv = (key: string): string => process.env[key]?.trim() || "";

const getSeedSuperAdminConfig = () => {
    const phone = readEnv("SEED_SUPER_ADMIN_PHONE") || "9999999999";
    const email = (readEnv("SEED_SUPER_ADMIN_EMAIL") || "admin@example.com").toLowerCase();
    const name = readEnv("SEED_SUPER_ADMIN_NAME") || "Super Admin";
    const password = readEnv("SEED_SUPER_ADMIN_PASSWORD");

    if (!password) {
        if (process.env.NODE_ENV === "production") {
            throw new Error(
                "SEED_SUPER_ADMIN_PASSWORD is required in production. Refusing to seed a predictable password.",
            );
        }
        console.warn(
            "SEED_SUPER_ADMIN_PASSWORD is not set. Using local fallback password for non-production seeding.",
        );
    }

    return {
        phone,
        email,
        name,
        password: password || "ChangeMe@123",
    };
};

async function main() {
    console.log("🌱 Starting Production Seeding...");

    // 1. Seed Organization
    console.log("   - Syncing Organization...");
    const org = await prisma.organization.upsert({
        where: { id: DEFAULT_ORGANIZATION_ID },
        update: {
            name: DEFAULT_ORGANIZATION_NAME,
            slug: DEFAULT_ORGANIZATION_SLUG,
            isActive: true,
        },
        create: {
            id: DEFAULT_ORGANIZATION_ID,
            name: DEFAULT_ORGANIZATION_NAME,
            slug: DEFAULT_ORGANIZATION_SLUG,
            isActive: true,
        },
    });

    // 2. Seed Department
    console.log("   - Syncing Department...");
    await prisma.department.upsert({
        where: { id: DEFAULT_DEPARTMENT_ID },
        update: {
            name: DEFAULT_DEPARTMENT_NAME,
            normalizedName: DEFAULT_DEPARTMENT_NORMALIZED,
            isActive: true,
        },
        create: {
            id: DEFAULT_DEPARTMENT_ID,
            name: DEFAULT_DEPARTMENT_NAME,
            normalizedName: DEFAULT_DEPARTMENT_NORMALIZED,
            organizationId: org.id,
            isActive: true,
        },
    });

    // 3. Seed Permissions
    console.log("   - Syncing Permissions...");
    for (const p of RBAC_PERMISSION_CATALOG) {
        await prisma.accessPermission.upsert({
            where: { key: p.key },
            update: {
                name: p.name,
                module: p.module,
                description: p.description,
                isSystem: p.isSystem ?? true,
            },
            create: {
                key: p.key,
                name: p.name,
                module: p.module,
                description: p.description,
                isSystem: p.isSystem ?? true,
            },
        });
    }

    // 4. Seed Roles and their Permission mappings
    console.log("   - Syncing System Roles...");
    const dbPermissions = await prisma.accessPermission.findMany();
    const permMap = new Map(dbPermissions.map((p) => [p.key, p.id]));

    for (const template of DEFAULT_SYSTEM_ROLE_TEMPLATES) {
        const role = await prisma.accessRole.upsert({
            where: { id: template.id },
            update: {
                name: template.name,
                normalizedName: template.normalizedName,
                isActive: true,
            },
            create: {
                id: template.id,
                name: template.name,
                normalizedName: template.normalizedName,
                organizationId: org.id,
                departmentId: DEFAULT_DEPARTMENT_ID,
                isSystem: true,
                isActive: true,
            },
        });

        // Sync permissions for this role
        const desiredPermIds = template.permissionKeys
            .map((key) => permMap.get(key))
            .filter((id): id is string => !!id);

        // Remove old permissions not in template, add new ones
        // For a cleaner 'production' seed, we ensure the mapping matches the template exactly
        await prisma.accessRolePermission.deleteMany({
            where: {
                roleId: role.id,
                permissionId: { notIn: desiredPermIds },
            },
        });

        for (const pId of desiredPermIds) {
            await prisma.accessRolePermission.upsert({
                where: {
                    roleId_permissionId: {
                        roleId: role.id,
                        permissionId: pId,
                    },
                },
                update: {},
                create: {
                    roleId: role.id,
                    permissionId: pId,
                },
            });
        }
    }

    // 5. Seed Super Admin User
    console.log("   - Creating Super Admin User...");
    const saConfig = getSeedSuperAdminConfig();

    const passwordHash = await bcrypt.hash(saConfig.password, 10);

    const superAdmin = await prisma.adminUser.upsert({
        where: { phoneNumber: saConfig.phone },
        update: {
            email: saConfig.email,
            name: saConfig.name,
            passwordHash: passwordHash,
            isActive: true,
            status: "ACTIVE", // From AdminUserStatus enum in schema
            isEmailVerified: true,
            isMobileVerified: true,
            isApprovedByAdmin: true,
        },
        create: {
            phoneNumber: saConfig.phone,
            email: saConfig.email,
            name: saConfig.name,
            passwordHash: passwordHash,
            isActive: true,
            status: "ACTIVE",
            isEmailVerified: true,
            isMobileVerified: true,
            isApprovedByAdmin: true,
            organizationId: org.id,
        },
    });

    // 6. Assign SUPER_ADMIN role to the user
    console.log("   - Mapping Super Admin Role...");
    await prisma.adminUserAccessRole.upsert({
        where: {
            userId_roleId: {
                userId: superAdmin.id,
                roleId: "role_super_admin",
            },
        },
        update: {},
        create: {
            userId: superAdmin.id,
            roleId: "role_super_admin",
        },
    });

    // 7. Seed City Catalog
    console.log("   - Syncing City Catalog...");
    await prisma.cityCatalog.upsert({
        where: { state_city_unique: { state: "Maharashtra", city: "Pune" } },
        update: { is_active: true },
        create: { state: "Maharashtra", city: "Pune", is_active: true },
    });

    // 8. Assign state/city to ganesh.s@mygupio.com
    console.log("   - Updating state/city for ganesh.s@mygupio.com...");
    await prisma.adminUser.updateMany({
        where: { email: "ganesh.s@mygupio.com" },
        data: { state: "Maharashtra", city: "Pune" },
    });

    console.log("✅ Seeding Completed Successfully.");
}

main()
    .catch((e) => {
        console.error("❌ Seeding Failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
