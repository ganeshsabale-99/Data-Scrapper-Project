CREATE TABLE IF NOT EXISTS "data_scrapper"."OtpDispatchLog" (
  "id" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "serviceMode" TEXT,
  "transactionId" TEXT,
  "providerState" TEXT,
  "providerDescription" TEXT,
  "accepted" BOOLEAN NOT NULL,
  "requestId" TEXT,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OtpDispatchLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OtpDispatchLog_phoneNumber_createdAt_idx"
  ON "data_scrapper"."OtpDispatchLog" ("phoneNumber", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "OtpDispatchLog_transactionId_idx"
  ON "data_scrapper"."OtpDispatchLog" ("transactionId");

CREATE INDEX IF NOT EXISTS "OtpDispatchLog_requestId_idx"
  ON "data_scrapper"."OtpDispatchLog" ("requestId");

CREATE INDEX IF NOT EXISTS "OtpDispatchLog_userId_createdAt_idx"
  ON "data_scrapper"."OtpDispatchLog" ("userId", "createdAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'OtpDispatchLog_userId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."OtpDispatchLog"
      ADD CONSTRAINT "OtpDispatchLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "data_scrapper"."AdminUser"("id")
      ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;
