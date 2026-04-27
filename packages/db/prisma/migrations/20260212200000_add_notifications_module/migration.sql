-- Notifications module for task and system alerts

DO $$
BEGIN
  CREATE TYPE "data_scrapper"."NotificationType" AS ENUM (
    'TASK_ASSIGNED',
    'TASK_UPDATED',
    'TASK_PROGRESS',
    'TASK_COMPLETED',
    'APPRECIATION_RECEIVED',
    'SYSTEM'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "data_scrapper"."Notification" (
  "id" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "type" "data_scrapper"."NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "metadata" JSONB,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_recipientUserId_isRead_createdAt_idx"
  ON "data_scrapper"."Notification" ("recipientUserId", "isRead", "createdAt");

CREATE INDEX IF NOT EXISTS "Notification_recipientUserId_createdAt_idx"
  ON "data_scrapper"."Notification" ("recipientUserId", "createdAt");

CREATE INDEX IF NOT EXISTS "Notification_type_idx"
  ON "data_scrapper"."Notification" ("type");

CREATE INDEX IF NOT EXISTS "Notification_entityType_entityId_idx"
  ON "data_scrapper"."Notification" ("entityType", "entityId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'Notification_recipientUserId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."Notification"
      ADD CONSTRAINT "Notification_recipientUserId_fkey"
      FOREIGN KEY ("recipientUserId") REFERENCES "data_scrapper"."AdminUser"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'Notification_createdByUserId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."Notification"
      ADD CONSTRAINT "Notification_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "data_scrapper"."AdminUser"("id")
      ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;
