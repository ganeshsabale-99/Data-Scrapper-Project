-- Task and performance tracking module

DO $$
BEGIN
  CREATE TYPE "tech_park"."TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "tech_park"."TaskAuditAction" AS ENUM (
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
  CREATE TYPE "tech_park"."AppreciationBadge" AS ENUM (
    'STAR_PERFORMER',
    'CONSISTENT_EXECUTOR',
    'DEADLINE_CHAMPION',
    'QUALITY_CHAMPION',
    'TEAM_PLAYER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "tech_park"."NewTechPark"
  ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "verifiedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "tech_park"."Task" (
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
  "status" "tech_park"."TaskStatus" NOT NULL DEFAULT 'PENDING',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tech_park"."TaskProgress" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "techParkId" TEXT NOT NULL,
  "verifiedBy" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tech_park"."TaskAudit" (
  "id" TEXT NOT NULL,
  "taskId" TEXT,
  "userId" TEXT,
  "techParkId" TEXT,
  "action" "tech_park"."TaskAuditAction" NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tech_park"."Appreciation" (
  "id" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "sentByAdminId" TEXT NOT NULL,
  "taskId" TEXT,
  "badge" "tech_park"."AppreciationBadge" NOT NULL,
  "note" TEXT,
  "remark" TEXT,
  "monthPeriod" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Appreciation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "task_techpark_unique"
  ON "tech_park"."TaskProgress" ("taskId", "techParkId");

CREATE INDEX IF NOT EXISTS "NewTechPark_isVerified_idx" ON "tech_park"."NewTechPark" ("isVerified");
CREATE INDEX IF NOT EXISTS "NewTechPark_verifiedByUserId_idx" ON "tech_park"."NewTechPark" ("verifiedByUserId");
CREATE INDEX IF NOT EXISTS "NewTechPark_verifiedAt_idx" ON "tech_park"."NewTechPark" ("verifiedAt");

CREATE INDEX IF NOT EXISTS "Task_assignedTo_idx" ON "tech_park"."Task" ("assignedTo");
CREATE INDEX IF NOT EXISTS "Task_createdBy_idx" ON "tech_park"."Task" ("createdBy");
CREATE INDEX IF NOT EXISTS "Task_state_idx" ON "tech_park"."Task" ("state");
CREATE INDEX IF NOT EXISTS "Task_city_idx" ON "tech_park"."Task" ("city");
CREATE INDEX IF NOT EXISTS "Task_startDate_idx" ON "tech_park"."Task" ("startDate");
CREATE INDEX IF NOT EXISTS "Task_endDate_idx" ON "tech_park"."Task" ("endDate");
CREATE INDEX IF NOT EXISTS "Task_status_idx" ON "tech_park"."Task" ("status");
CREATE INDEX IF NOT EXISTS "Task_assignedTo_status_idx" ON "tech_park"."Task" ("assignedTo", "status");

CREATE INDEX IF NOT EXISTS "TaskProgress_taskId_idx" ON "tech_park"."TaskProgress" ("taskId");
CREATE INDEX IF NOT EXISTS "TaskProgress_techParkId_idx" ON "tech_park"."TaskProgress" ("techParkId");
CREATE INDEX IF NOT EXISTS "TaskProgress_verifiedBy_idx" ON "tech_park"."TaskProgress" ("verifiedBy");
CREATE INDEX IF NOT EXISTS "TaskProgress_verifiedAt_idx" ON "tech_park"."TaskProgress" ("verifiedAt");

CREATE INDEX IF NOT EXISTS "TaskAudit_taskId_idx" ON "tech_park"."TaskAudit" ("taskId");
CREATE INDEX IF NOT EXISTS "TaskAudit_userId_idx" ON "tech_park"."TaskAudit" ("userId");
CREATE INDEX IF NOT EXISTS "TaskAudit_techParkId_idx" ON "tech_park"."TaskAudit" ("techParkId");
CREATE INDEX IF NOT EXISTS "TaskAudit_action_idx" ON "tech_park"."TaskAudit" ("action");
CREATE INDEX IF NOT EXISTS "TaskAudit_createdAt_idx" ON "tech_park"."TaskAudit" ("createdAt");

CREATE INDEX IF NOT EXISTS "Appreciation_recipientUserId_idx" ON "tech_park"."Appreciation" ("recipientUserId");
CREATE INDEX IF NOT EXISTS "Appreciation_sentByAdminId_idx" ON "tech_park"."Appreciation" ("sentByAdminId");
CREATE INDEX IF NOT EXISTS "Appreciation_taskId_idx" ON "tech_park"."Appreciation" ("taskId");
CREATE INDEX IF NOT EXISTS "Appreciation_monthPeriod_idx" ON "tech_park"."Appreciation" ("monthPeriod");
CREATE INDEX IF NOT EXISTS "Appreciation_createdAt_idx" ON "tech_park"."Appreciation" ("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'NewTechPark_verifiedByUserId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."NewTechPark"
      ADD CONSTRAINT "NewTechPark_verifiedByUserId_fkey"
      FOREIGN KEY ("verifiedByUserId") REFERENCES "tech_park"."AdminUser"("id")
      ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'Task_assignedTo_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."Task"
      ADD CONSTRAINT "Task_assignedTo_fkey"
      FOREIGN KEY ("assignedTo") REFERENCES "tech_park"."AdminUser"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'Task_createdBy_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."Task"
      ADD CONSTRAINT "Task_createdBy_fkey"
      FOREIGN KEY ("createdBy") REFERENCES "tech_park"."AdminUser"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'TaskProgress_taskId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."TaskProgress"
      ADD CONSTRAINT "TaskProgress_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "tech_park"."Task"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'TaskProgress_techParkId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."TaskProgress"
      ADD CONSTRAINT "TaskProgress_techParkId_fkey"
      FOREIGN KEY ("techParkId") REFERENCES "tech_park"."NewTechPark"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'TaskProgress_verifiedBy_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."TaskProgress"
      ADD CONSTRAINT "TaskProgress_verifiedBy_fkey"
      FOREIGN KEY ("verifiedBy") REFERENCES "tech_park"."AdminUser"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'TaskAudit_taskId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."TaskAudit"
      ADD CONSTRAINT "TaskAudit_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "tech_park"."Task"("id")
      ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'TaskAudit_userId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."TaskAudit"
      ADD CONSTRAINT "TaskAudit_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "tech_park"."AdminUser"("id")
      ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'TaskAudit_techParkId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."TaskAudit"
      ADD CONSTRAINT "TaskAudit_techParkId_fkey"
      FOREIGN KEY ("techParkId") REFERENCES "tech_park"."NewTechPark"("id")
      ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'Appreciation_recipientUserId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."Appreciation"
      ADD CONSTRAINT "Appreciation_recipientUserId_fkey"
      FOREIGN KEY ("recipientUserId") REFERENCES "tech_park"."AdminUser"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'Appreciation_sentByAdminId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."Appreciation"
      ADD CONSTRAINT "Appreciation_sentByAdminId_fkey"
      FOREIGN KEY ("sentByAdminId") REFERENCES "tech_park"."AdminUser"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'Appreciation_taskId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."Appreciation"
      ADD CONSTRAINT "Appreciation_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "tech_park"."Task"("id")
      ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;
