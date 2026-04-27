-- Task and performance tracking module

DO $$
BEGIN
  CREATE TYPE "data_scrapper"."TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "data_scrapper"."TaskAuditAction" AS ENUM (
    'TASK_CREATED',
    'TASK_UPDATED',
    'TASK_ASSIGNED',
    'TASK_STARTED',
    'TASK_COMPLETED',
    'TASK_EXPIRED',
    'VERIFY_SUCCESS',
    'DUPLICATE_VERIFICATION_ATTEMPT',
    'VERIFY_REJECTED',
    'APPRECIATION_SENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "data_scrapper"."AppreciationBadge" AS ENUM (
    'STAR_PERFORMER',
    'CONSISTENT_EXECUTOR',
    'DEADLINE_CHAMPION',
    'QUALITY_CHAMPION',
    'TEAM_PLAYER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "data_scrapper"."NewTechPark"
  ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "verifiedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "data_scrapper"."Task" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "assignedTo" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "targetCount" INTEGER NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "status" "data_scrapper"."TaskStatus" NOT NULL DEFAULT 'PENDING',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "data_scrapper"."TaskProgress" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "techParkId" TEXT NOT NULL,
  "verifiedBy" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "data_scrapper"."TaskAudit" (
  "id" TEXT NOT NULL,
  "taskId" TEXT,
  "userId" TEXT,
  "techParkId" TEXT,
  "action" "data_scrapper"."TaskAuditAction" NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "data_scrapper"."Appreciation" (
  "id" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "sentByAdminId" TEXT NOT NULL,
  "taskId" TEXT,
  "badge" "data_scrapper"."AppreciationBadge" NOT NULL,
  "note" TEXT,
  "remark" TEXT,
  "monthPeriod" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Appreciation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "task_techpark_unique"
  ON "data_scrapper"."TaskProgress" ("taskId", "techParkId");

CREATE INDEX IF NOT EXISTS "NewTechPark_isVerified_idx" ON "data_scrapper"."NewTechPark" ("isVerified");
CREATE INDEX IF NOT EXISTS "NewTechPark_verifiedByUserId_idx" ON "data_scrapper"."NewTechPark" ("verifiedByUserId");
CREATE INDEX IF NOT EXISTS "NewTechPark_verifiedAt_idx" ON "data_scrapper"."NewTechPark" ("verifiedAt");

CREATE INDEX IF NOT EXISTS "Task_assignedTo_idx" ON "data_scrapper"."Task" ("assignedTo");
CREATE INDEX IF NOT EXISTS "Task_createdBy_idx" ON "data_scrapper"."Task" ("createdBy");
CREATE INDEX IF NOT EXISTS "Task_state_idx" ON "data_scrapper"."Task" ("state");
CREATE INDEX IF NOT EXISTS "Task_city_idx" ON "data_scrapper"."Task" ("city");
CREATE INDEX IF NOT EXISTS "Task_startDate_idx" ON "data_scrapper"."Task" ("startDate");
CREATE INDEX IF NOT EXISTS "Task_endDate_idx" ON "data_scrapper"."Task" ("endDate");
CREATE INDEX IF NOT EXISTS "Task_status_idx" ON "data_scrapper"."Task" ("status");
CREATE INDEX IF NOT EXISTS "Task_assignedTo_status_idx" ON "data_scrapper"."Task" ("assignedTo", "status");

CREATE INDEX IF NOT EXISTS "TaskProgress_taskId_idx" ON "data_scrapper"."TaskProgress" ("taskId");
CREATE INDEX IF NOT EXISTS "TaskProgress_techParkId_idx" ON "data_scrapper"."TaskProgress" ("techParkId");
CREATE INDEX IF NOT EXISTS "TaskProgress_verifiedBy_idx" ON "data_scrapper"."TaskProgress" ("verifiedBy");
CREATE INDEX IF NOT EXISTS "TaskProgress_verifiedAt_idx" ON "data_scrapper"."TaskProgress" ("verifiedAt");

CREATE INDEX IF NOT EXISTS "TaskAudit_taskId_idx" ON "data_scrapper"."TaskAudit" ("taskId");
CREATE INDEX IF NOT EXISTS "TaskAudit_userId_idx" ON "data_scrapper"."TaskAudit" ("userId");
CREATE INDEX IF NOT EXISTS "TaskAudit_techParkId_idx" ON "data_scrapper"."TaskAudit" ("techParkId");
CREATE INDEX IF NOT EXISTS "TaskAudit_action_idx" ON "data_scrapper"."TaskAudit" ("action");
CREATE INDEX IF NOT EXISTS "TaskAudit_createdAt_idx" ON "data_scrapper"."TaskAudit" ("createdAt");

CREATE INDEX IF NOT EXISTS "Appreciation_recipientUserId_idx" ON "data_scrapper"."Appreciation" ("recipientUserId");
CREATE INDEX IF NOT EXISTS "Appreciation_sentByAdminId_idx" ON "data_scrapper"."Appreciation" ("sentByAdminId");
CREATE INDEX IF NOT EXISTS "Appreciation_taskId_idx" ON "data_scrapper"."Appreciation" ("taskId");
CREATE INDEX IF NOT EXISTS "Appreciation_monthPeriod_idx" ON "data_scrapper"."Appreciation" ("monthPeriod");
CREATE INDEX IF NOT EXISTS "Appreciation_createdAt_idx" ON "data_scrapper"."Appreciation" ("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'NewTechPark_verifiedByUserId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."NewTechPark"
      ADD CONSTRAINT "NewTechPark_verifiedByUserId_fkey"
      FOREIGN KEY ("verifiedByUserId") REFERENCES "data_scrapper"."AdminUser"("id")
      ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'Task_assignedTo_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."Task"
      ADD CONSTRAINT "Task_assignedTo_fkey"
      FOREIGN KEY ("assignedTo") REFERENCES "data_scrapper"."AdminUser"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'Task_createdBy_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."Task"
      ADD CONSTRAINT "Task_createdBy_fkey"
      FOREIGN KEY ("createdBy") REFERENCES "data_scrapper"."AdminUser"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'TaskProgress_taskId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."TaskProgress"
      ADD CONSTRAINT "TaskProgress_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "data_scrapper"."Task"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'TaskProgress_techParkId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."TaskProgress"
      ADD CONSTRAINT "TaskProgress_techParkId_fkey"
      FOREIGN KEY ("techParkId") REFERENCES "data_scrapper"."NewTechPark"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'TaskProgress_verifiedBy_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."TaskProgress"
      ADD CONSTRAINT "TaskProgress_verifiedBy_fkey"
      FOREIGN KEY ("verifiedBy") REFERENCES "data_scrapper"."AdminUser"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'TaskAudit_taskId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."TaskAudit"
      ADD CONSTRAINT "TaskAudit_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "data_scrapper"."Task"("id")
      ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'TaskAudit_userId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."TaskAudit"
      ADD CONSTRAINT "TaskAudit_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "data_scrapper"."AdminUser"("id")
      ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'TaskAudit_techParkId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."TaskAudit"
      ADD CONSTRAINT "TaskAudit_techParkId_fkey"
      FOREIGN KEY ("techParkId") REFERENCES "data_scrapper"."NewTechPark"("id")
      ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'Appreciation_recipientUserId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."Appreciation"
      ADD CONSTRAINT "Appreciation_recipientUserId_fkey"
      FOREIGN KEY ("recipientUserId") REFERENCES "data_scrapper"."AdminUser"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'Appreciation_sentByAdminId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."Appreciation"
      ADD CONSTRAINT "Appreciation_sentByAdminId_fkey"
      FOREIGN KEY ("sentByAdminId") REFERENCES "data_scrapper"."AdminUser"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'Appreciation_taskId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."Appreciation"
      ADD CONSTRAINT "Appreciation_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "data_scrapper"."Task"("id")
      ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;
