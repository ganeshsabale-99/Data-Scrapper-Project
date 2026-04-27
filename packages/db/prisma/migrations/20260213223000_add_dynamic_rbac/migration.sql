-- Dynamic RBAC module: Organizations, Departments, Roles, Permissions

CREATE TABLE IF NOT EXISTS "tech_park"."Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_key"
  ON "tech_park"."Organization" ("slug");

CREATE TABLE IF NOT EXISTS "tech_park"."Department" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "department_org_normalized_unique"
  ON "tech_park"."Department" ("organizationId", "normalizedName");

CREATE INDEX IF NOT EXISTS "Department_organizationId_isActive_idx"
  ON "tech_park"."Department" ("organizationId", "isActive");

CREATE TABLE IF NOT EXISTS "tech_park"."AccessRole" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "legacyRole" "tech_park"."Role",
  "organizationId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccessRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "access_role_department_normalized_unique"
  ON "tech_park"."AccessRole" ("departmentId", "normalizedName");

CREATE INDEX IF NOT EXISTS "AccessRole_organizationId_isActive_idx"
  ON "tech_park"."AccessRole" ("organizationId", "isActive");

CREATE INDEX IF NOT EXISTS "AccessRole_legacyRole_idx"
  ON "tech_park"."AccessRole" ("legacyRole");

CREATE TABLE IF NOT EXISTS "tech_park"."AccessPermission" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "description" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccessPermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AccessPermission_key_key"
  ON "tech_park"."AccessPermission" ("key");

CREATE INDEX IF NOT EXISTS "AccessPermission_module_idx"
  ON "tech_park"."AccessPermission" ("module");

CREATE TABLE IF NOT EXISTS "tech_park"."AccessRolePermission" (
  "roleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccessRolePermission_pkey" PRIMARY KEY ("roleId", "permissionId")
);

CREATE INDEX IF NOT EXISTS "AccessRolePermission_permissionId_idx"
  ON "tech_park"."AccessRolePermission" ("permissionId");

CREATE TABLE IF NOT EXISTS "tech_park"."AdminUserAccessRole" (
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "assignedByUserId" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminUserAccessRole_pkey" PRIMARY KEY ("userId", "roleId")
);

CREATE INDEX IF NOT EXISTS "AdminUserAccessRole_roleId_idx"
  ON "tech_park"."AdminUserAccessRole" ("roleId");

CREATE INDEX IF NOT EXISTS "AdminUserAccessRole_assignedByUserId_idx"
  ON "tech_park"."AdminUserAccessRole" ("assignedByUserId");

ALTER TABLE "tech_park"."AdminUser"
  ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "tech_park"."AdminUser"
SET "organizationId" = 'org_default'
WHERE "organizationId" IS NULL;

ALTER TABLE "tech_park"."AdminUser"
  ALTER COLUMN "organizationId" SET DEFAULT 'org_default';

ALTER TABLE "tech_park"."AdminUser"
  ALTER COLUMN "organizationId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "AdminUser_organizationId_idx"
  ON "tech_park"."AdminUser" ("organizationId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'Department_organizationId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."Department"
      ADD CONSTRAINT "Department_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "tech_park"."Organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'AccessRole_organizationId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."AccessRole"
      ADD CONSTRAINT "AccessRole_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "tech_park"."Organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'AccessRole_departmentId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."AccessRole"
      ADD CONSTRAINT "AccessRole_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "tech_park"."Department"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'AccessRolePermission_roleId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."AccessRolePermission"
      ADD CONSTRAINT "AccessRolePermission_roleId_fkey"
      FOREIGN KEY ("roleId") REFERENCES "tech_park"."AccessRole"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'AccessRolePermission_permissionId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."AccessRolePermission"
      ADD CONSTRAINT "AccessRolePermission_permissionId_fkey"
      FOREIGN KEY ("permissionId") REFERENCES "tech_park"."AccessPermission"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'AdminUserAccessRole_userId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."AdminUserAccessRole"
      ADD CONSTRAINT "AdminUserAccessRole_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "tech_park"."AdminUser"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'AdminUserAccessRole_roleId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."AdminUserAccessRole"
      ADD CONSTRAINT "AdminUserAccessRole_roleId_fkey"
      FOREIGN KEY ("roleId") REFERENCES "tech_park"."AccessRole"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'AdminUserAccessRole_assignedByUserId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."AdminUserAccessRole"
      ADD CONSTRAINT "AdminUserAccessRole_assignedByUserId_fkey"
      FOREIGN KEY ("assignedByUserId") REFERENCES "tech_park"."AdminUser"("id")
      ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;

INSERT INTO "tech_park"."Organization" (
  "id", "name", "slug", "isActive", "createdAt", "updatedAt"
)
VALUES (
  'org_default',
  'Default Organization',
  'default-org',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE
SET "name" = EXCLUDED."name",
    "slug" = EXCLUDED."slug",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "tech_park"."Department" (
  "id", "name", "normalizedName", "organizationId", "isActive", "createdAt", "updatedAt"
)
VALUES (
  'dept_system',
  'System Access',
  'SYSTEM_ACCESS',
  'org_default',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE
SET "name" = EXCLUDED."name",
    "normalizedName" = EXCLUDED."normalizedName",
    "organizationId" = EXCLUDED."organizationId",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'AdminUser_organizationId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."AdminUser"
      ADD CONSTRAINT "AdminUser_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "tech_park"."Organization"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE';
  END IF;
END $$;

INSERT INTO "tech_park"."AccessPermission" (
  "id", "key", "name", "module", "description", "isSystem", "createdAt", "updatedAt"
)
VALUES
  ('perm_system_admin', 'SYSTEM.ADMIN', 'System Admin Access', 'SYSTEM', 'Grants admin-level override in middleware', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_system_super_admin', 'SYSTEM.SUPER_ADMIN', 'Super Admin Access', 'SYSTEM', 'Grants unrestricted super-admin access', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_scope_national_view', 'SCOPE.NATIONAL_VIEW', 'View National Dashboard', 'SCOPE', 'Can access national scope dashboards', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_scope_state_view', 'SCOPE.STATE_VIEW', 'View State Dashboard', 'SCOPE', 'Can access state-level dashboards', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_scope_city_view', 'SCOPE.CITY_VIEW', 'View City Dashboard', 'SCOPE', 'Can access city-level dashboards', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_users_view', 'USERS.VIEW', 'View Users', 'USERS', 'Can view users and profiles', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_users_manage', 'USERS.MANAGE', 'Manage Users', 'USERS', 'Can edit, approve, and deactivate users', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_analytics_view', 'ANALYTICS.VIEW', 'View Analytics', 'ANALYTICS', 'Can view analytics data', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_performance_view', 'PERFORMANCE.VIEW', 'View Performance', 'PERFORMANCE', 'Can access performance pages', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_performance_manage', 'PERFORMANCE.MANAGE', 'Manage Performance', 'PERFORMANCE', 'Can manage performance scoring/reports', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_tasks_create', 'TASKS.CREATE_TASK', 'Create Task', 'TASKS', 'Can create tasks', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_tasks_assign', 'TASKS.ASSIGN_TASK', 'Assign Task', 'TASKS', 'Can assign tasks to users', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_tasks_update', 'TASKS.UPDATE_TASK', 'Update Task', 'TASKS', 'Can update task workflow and details', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_tasks_verify', 'TASKS.VERIFY_TECHPARK', 'Verify Tech Park for Task', 'TASKS', 'Can verify task-linked tech parks', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_techparks_view', 'TECHPARKS.VIEW', 'View Tech Parks', 'TECHPARKS', 'Can view tech park records', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_techparks_manage', 'TECHPARKS.MANAGE', 'Manage Tech Parks', 'TECHPARKS', 'Can create/update/delete tech parks', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_techparks_verify', 'TECHPARKS.VERIFY', 'Verify Tech Park', 'TECHPARKS', 'Can verify/unverify tech parks', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_coworking_view', 'COWORKING.VIEW', 'View Coworking Spaces', 'COWORKING', 'Can view coworking spaces', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_coworking_manage', 'COWORKING.MANAGE', 'Manage Coworking Spaces', 'COWORKING', 'Can manage coworking spaces and companies', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_funding_news_view', 'FUNDING.NEWS_VIEW', 'View Funding News', 'FUNDING', 'Can view funding news pages', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_reports_view', 'REPORTS.VIEW', 'View Reports', 'REPORTS', 'Can view and generate reports', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_notifications_view', 'NOTIFICATIONS.VIEW', 'View Notifications', 'NOTIFICATIONS', 'Can view and update notifications', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_rbac_manage', 'RBAC.MANAGE', 'Manage RBAC', 'RBAC', 'Can manage departments, roles, and permissions', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE
SET "key" = EXCLUDED."key",
    "name" = EXCLUDED."name",
    "module" = EXCLUDED."module",
    "description" = EXCLUDED."description",
    "isSystem" = EXCLUDED."isSystem",
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "tech_park"."AccessRole" (
  "id", "name", "normalizedName", "legacyRole", "organizationId", "departmentId", "isSystem", "isActive", "createdAt", "updatedAt"
)
VALUES
  ('role_super_admin', 'Super Admin', 'SUPER_ADMIN', NULL, 'org_default', 'dept_system', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_admin', 'Admin', 'ADMIN', 'ADMIN'::"tech_park"."Role", 'org_default', 'dept_system', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_sales_manager', 'Sales Manager', 'SALES_MANAGER', 'SALES_MANAGER'::"tech_park"."Role", 'org_default', 'dept_system', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_sales_team', 'Sales Team', 'SALES_TEAM', 'SALES_TEAM'::"tech_park"."Role", 'org_default', 'dept_system', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_sales_executive', 'Sales Executive', 'SALES_EXECUTIVE', 'SALES_EXECUTIVE'::"tech_park"."Role", 'org_default', 'dept_system', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_user', 'User', 'USER', 'USER'::"tech_park"."Role", 'org_default', 'dept_system', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE
SET "name" = EXCLUDED."name",
    "normalizedName" = EXCLUDED."normalizedName",
    "legacyRole" = EXCLUDED."legacyRole",
    "organizationId" = EXCLUDED."organizationId",
    "departmentId" = EXCLUDED."departmentId",
    "isSystem" = EXCLUDED."isSystem",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "tech_park"."AccessRolePermission" ("roleId", "permissionId", "grantedAt")
VALUES
  -- Super Admin
  ('role_super_admin', 'perm_system_super_admin', CURRENT_TIMESTAMP),
  ('role_super_admin', 'perm_system_admin', CURRENT_TIMESTAMP),
  ('role_super_admin', 'perm_scope_national_view', CURRENT_TIMESTAMP),
  ('role_super_admin', 'perm_scope_state_view', CURRENT_TIMESTAMP),
  ('role_super_admin', 'perm_scope_city_view', CURRENT_TIMESTAMP),
  ('role_super_admin', 'perm_users_view', CURRENT_TIMESTAMP),
  ('role_super_admin', 'perm_users_manage', CURRENT_TIMESTAMP),
  ('role_super_admin', 'perm_analytics_view', CURRENT_TIMESTAMP),
  ('role_super_admin', 'perm_performance_view', CURRENT_TIMESTAMP),
  ('role_super_admin', 'perm_performance_manage', CURRENT_TIMESTAMP),
  ('role_super_admin', 'perm_tasks_create', CURRENT_TIMESTAMP),
  ('role_super_admin', 'perm_tasks_assign', CURRENT_TIMESTAMP),
  ('role_super_admin', 'perm_tasks_update', CURRENT_TIMESTAMP),
  ('role_super_admin', 'perm_tasks_verify', CURRENT_TIMESTAMP),
  ('role_super_admin', 'perm_techparks_view', CURRENT_TIMESTAMP),
  ('role_super_admin', 'perm_techparks_manage', CURRENT_TIMESTAMP),
  ('role_super_admin', 'perm_techparks_verify', CURRENT_TIMESTAMP),
  ('role_super_admin', 'perm_coworking_view', CURRENT_TIMESTAMP),
  ('role_super_admin', 'perm_coworking_manage', CURRENT_TIMESTAMP),
  ('role_super_admin', 'perm_funding_news_view', CURRENT_TIMESTAMP),
  ('role_super_admin', 'perm_reports_view', CURRENT_TIMESTAMP),
  ('role_super_admin', 'perm_notifications_view', CURRENT_TIMESTAMP),
  ('role_super_admin', 'perm_rbac_manage', CURRENT_TIMESTAMP),
  -- Admin
  ('role_admin', 'perm_system_admin', CURRENT_TIMESTAMP),
  ('role_admin', 'perm_scope_national_view', CURRENT_TIMESTAMP),
  ('role_admin', 'perm_scope_state_view', CURRENT_TIMESTAMP),
  ('role_admin', 'perm_scope_city_view', CURRENT_TIMESTAMP),
  ('role_admin', 'perm_users_view', CURRENT_TIMESTAMP),
  ('role_admin', 'perm_users_manage', CURRENT_TIMESTAMP),
  ('role_admin', 'perm_analytics_view', CURRENT_TIMESTAMP),
  ('role_admin', 'perm_performance_view', CURRENT_TIMESTAMP),
  ('role_admin', 'perm_performance_manage', CURRENT_TIMESTAMP),
  ('role_admin', 'perm_tasks_create', CURRENT_TIMESTAMP),
  ('role_admin', 'perm_tasks_assign', CURRENT_TIMESTAMP),
  ('role_admin', 'perm_tasks_update', CURRENT_TIMESTAMP),
  ('role_admin', 'perm_tasks_verify', CURRENT_TIMESTAMP),
  ('role_admin', 'perm_techparks_view', CURRENT_TIMESTAMP),
  ('role_admin', 'perm_techparks_manage', CURRENT_TIMESTAMP),
  ('role_admin', 'perm_techparks_verify', CURRENT_TIMESTAMP),
  ('role_admin', 'perm_coworking_view', CURRENT_TIMESTAMP),
  ('role_admin', 'perm_coworking_manage', CURRENT_TIMESTAMP),
  ('role_admin', 'perm_funding_news_view', CURRENT_TIMESTAMP),
  ('role_admin', 'perm_reports_view', CURRENT_TIMESTAMP),
  ('role_admin', 'perm_notifications_view', CURRENT_TIMESTAMP),
  ('role_admin', 'perm_rbac_manage', CURRENT_TIMESTAMP),
  -- Sales Manager
  ('role_sales_manager', 'perm_scope_state_view', CURRENT_TIMESTAMP),
  ('role_sales_manager', 'perm_scope_city_view', CURRENT_TIMESTAMP),
  ('role_sales_manager', 'perm_analytics_view', CURRENT_TIMESTAMP),
  ('role_sales_manager', 'perm_performance_view', CURRENT_TIMESTAMP),
  ('role_sales_manager', 'perm_performance_manage', CURRENT_TIMESTAMP),
  ('role_sales_manager', 'perm_tasks_create', CURRENT_TIMESTAMP),
  ('role_sales_manager', 'perm_tasks_assign', CURRENT_TIMESTAMP),
  ('role_sales_manager', 'perm_tasks_update', CURRENT_TIMESTAMP),
  ('role_sales_manager', 'perm_tasks_verify', CURRENT_TIMESTAMP),
  ('role_sales_manager', 'perm_techparks_view', CURRENT_TIMESTAMP),
  ('role_sales_manager', 'perm_techparks_manage', CURRENT_TIMESTAMP),
  ('role_sales_manager', 'perm_techparks_verify', CURRENT_TIMESTAMP),
  ('role_sales_manager', 'perm_coworking_view', CURRENT_TIMESTAMP),
  ('role_sales_manager', 'perm_coworking_manage', CURRENT_TIMESTAMP),
  ('role_sales_manager', 'perm_funding_news_view', CURRENT_TIMESTAMP),
  ('role_sales_manager', 'perm_reports_view', CURRENT_TIMESTAMP),
  ('role_sales_manager', 'perm_notifications_view', CURRENT_TIMESTAMP),
  -- Sales Team
  ('role_sales_team', 'perm_scope_city_view', CURRENT_TIMESTAMP),
  ('role_sales_team', 'perm_performance_view', CURRENT_TIMESTAMP),
  ('role_sales_team', 'perm_tasks_update', CURRENT_TIMESTAMP),
  ('role_sales_team', 'perm_tasks_verify', CURRENT_TIMESTAMP),
  ('role_sales_team', 'perm_techparks_view', CURRENT_TIMESTAMP),
  ('role_sales_team', 'perm_coworking_view', CURRENT_TIMESTAMP),
  ('role_sales_team', 'perm_coworking_manage', CURRENT_TIMESTAMP),
  ('role_sales_team', 'perm_funding_news_view', CURRENT_TIMESTAMP),
  ('role_sales_team', 'perm_notifications_view', CURRENT_TIMESTAMP),
  -- Sales Executive
  ('role_sales_executive', 'perm_scope_city_view', CURRENT_TIMESTAMP),
  ('role_sales_executive', 'perm_performance_view', CURRENT_TIMESTAMP),
  ('role_sales_executive', 'perm_tasks_update', CURRENT_TIMESTAMP),
  ('role_sales_executive', 'perm_tasks_verify', CURRENT_TIMESTAMP),
  ('role_sales_executive', 'perm_techparks_view', CURRENT_TIMESTAMP),
  ('role_sales_executive', 'perm_coworking_view', CURRENT_TIMESTAMP),
  ('role_sales_executive', 'perm_coworking_manage', CURRENT_TIMESTAMP),
  ('role_sales_executive', 'perm_funding_news_view', CURRENT_TIMESTAMP),
  ('role_sales_executive', 'perm_notifications_view', CURRENT_TIMESTAMP),
  -- User
  ('role_user', 'perm_notifications_view', CURRENT_TIMESTAMP)
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "tech_park"."AdminUserAccessRole" ("userId", "roleId", "assignedAt")
SELECT
  u."id",
  CASE u."role"
    WHEN 'ADMIN'::"tech_park"."Role" THEN 'role_admin'
    WHEN 'SALES_MANAGER'::"tech_park"."Role" THEN 'role_sales_manager'
    WHEN 'SALES_TEAM'::"tech_park"."Role" THEN 'role_sales_team'
    WHEN 'SALES_EXECUTIVE'::"tech_park"."Role" THEN 'role_sales_executive'
    WHEN 'USER'::"tech_park"."Role" THEN 'role_user'
    ELSE 'role_user'
  END AS "roleId",
  CURRENT_TIMESTAMP
FROM "tech_park"."AdminUser" u
ON CONFLICT ("userId", "roleId") DO NOTHING;
