import { PrismaClient } from "@prisma/client";

export const prismaInstance = new PrismaClient();

// Alias for convenience
export const db = prismaInstance;

// Export Prisma types for use in other packages
export type {
    PrismaClient,
    CoworkingSpace,
    CoworkingCompany,
} from "@prisma/client";

// Export Prisma enums/namespace for downstream modules without direct dependency.
export {
    Prisma,
    type AdminUser,
    ActivityEntityType,
    ActivityAction,
    AdminUserStatus,
} from "@prisma/client";

// Export RBAC Catalog and related types/utilities
export * from "./rbacCatalog";
