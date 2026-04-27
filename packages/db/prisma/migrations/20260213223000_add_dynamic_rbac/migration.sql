-- Dynamic RBAC module: Organizations, Departments, Roles, Permissions

CREATE TABLE IF NOT EXISTS "data_scrapper"."Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_key"
  ON "data_scrapper"."Organization" ("slug");

CREATE TABLE IF NOT EXISTS "data_scrapper"."Department" (
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
  ON "data_scrapper"."Department" ("organizationId", "normalizedName");

CREATE INDEX IF NOT EXISTS "Department_organizationId_isActive_idx"
  ON "data_scrapper"."Department" ("organizationId", "isActive");

CREATE TABLE IF NOT EXISTS "data_scrapper"."AccessRole" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccessRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "access_role_department_normalized_unique"
  ON "data_scrapper"."AccessRole" ("departmentId", "normalizedName");

CREATE INDEX IF NOT EXISTS "AccessRole_organizationId_isActive_idx"
  ON "data_scrapper"."AccessRole" ("organizationId", "isActive");

CREATE TABLE IF NOT EXISTS "data_scrapper"."AccessPermission" (
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
  ON "data_scrapper"."AccessPermission" ("key");

CREATE INDEX IF NOT EXISTS "AccessPermission_module_idx"
  ON "data_scrapper"."AccessPermission" ("module");

CREATE TABLE IF NOT EXISTS "data_scrapper"."AccessRolePermission" (
  "roleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccessRolePermission_pkey" PRIMARY KEY ("roleId", "permissionId")
);

CREATE INDEX IF NOT EXISTS "AccessRolePermission_permissionId_idx"
  ON "data_scrapper"."AccessRolePermission" ("permissionId");

CREATE TABLE IF NOT EXISTS "data_scrapper"."AdminUserAccessRole" (
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "assignedByUserId" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminUserAccessRole_pkey" PRIMARY KEY ("userId", "roleId")
);

CREATE INDEX IF NOT EXISTS "AdminUserAccessRole_roleId_idx"
  ON "data_scrapper"."AdminUserAccessRole" ("roleId");

CREATE INDEX IF NOT EXISTS "AdminUserAccessRole_assignedByUserId_idx"
  ON "data_scrapper"."AdminUserAccessRole" ("assignedByUserId");

ALTER TABLE "data_scrapper"."AdminUser"
  ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "data_scrapper"."AdminUser"
SET "organizationId" = 'org_default'
WHERE "organizationId" IS NULL;

ALTER TABLE "data_scrapper"."AdminUser"
  ALTER COLUMN "organizationId" SET DEFAULT 'org_default';

ALTER TABLE "data_scrapper"."AdminUser"
  ALTER COLUMN "organizationId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "AdminUser_organizationId_idx"
  ON "data_scrapper"."AdminUser" ("organizationId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'Department_organizationId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."Department"
      ADD CONSTRAINT "Department_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "data_scrapper"."Organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'AccessRole_organizationId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."AccessRole"
      ADD CONSTRAINT "AccessRole_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "data_scrapper"."Organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'AccessRole_departmentId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."AccessRole"
      ADD CONSTRAINT "AccessRole_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "data_scrapper"."Department"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'AccessRolePermission_roleId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."AccessRolePermission"
      ADD CONSTRAINT "AccessRolePermission_roleId_fkey"
      FOREIGN KEY ("roleId") REFERENCES "data_scrapper"."AccessRole"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'AccessRolePermission_permissionId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."AccessRolePermission"
      ADD CONSTRAINT "AccessRolePermission_permissionId_fkey"
      FOREIGN KEY ("permissionId") REFERENCES "data_scrapper"."AccessPermission"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'AdminUserAccessRole_userId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."AdminUserAccessRole"
      ADD CONSTRAINT "AdminUserAccessRole_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "data_scrapper"."AdminUser"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'AdminUserAccessRole_roleId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."AdminUserAccessRole"
      ADD CONSTRAINT "AdminUserAccessRole_roleId_fkey"
      FOREIGN KEY ("roleId") REFERENCES "data_scrapper"."AccessRole"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'AdminUserAccessRole_assignedByUserId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."AdminUserAccessRole"
      ADD CONSTRAINT "AdminUserAccessRole_assignedByUserId_fkey"
      FOREIGN KEY ("assignedByUserId") REFERENCES "data_scrapper"."AdminUser"("id")
      ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;

INSERT INTO "data_scrapper"."Organization" (
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

INSERT INTO "data_scrapper"."Department" (
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
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'AdminUser_organizationId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."AdminUser"
      ADD CONSTRAINT "AdminUser_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "data_scrapper"."Organization"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE';
  END IF;
END $$;

INSERT INTO "data_scrapper"."AccessPermission" (
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

INSERT INTO "data_scrapper"."AccessRole" (
  "id", "name", "normalizedName", "organizationId", "departmentId", "isSystem", "isActive", "createdAt", "updatedAt"
)
VALUES
  ('role_super_admin', 'Super Admin', 'SUPER_ADMIN', 'org_default', 'dept_system', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_admin', 'Admin', 'ADMIN', 'org_default', 'dept_system', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_sales_manager', 'Sales Manager', 'SALES_MANAGER', 'org_default', 'dept_system', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_sales_team', 'Sales Team', 'SALES_TEAM', 'org_default', 'dept_system', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_sales_executive', 'Sales Executive', 'SALES_EXECUTIVE', 'org_default', 'dept_system', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_user', 'User', 'USER', 'org_default', 'dept_system', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE
SET "name" = EXCLUDED."name",
    "normalizedName" = EXCLUDED."normalizedName",
    "organizationId" = EXCLUDED."organizationId",
    "departmentId" = EXCLUDED."departmentId",
    "isSystem" = EXCLUDED."isSystem",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "data_scrapper"."AccessRolePermission" ("roleId", "permissionId", "grantedAt")
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
