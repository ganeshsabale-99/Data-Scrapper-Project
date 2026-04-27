CREATE TABLE IF NOT EXISTS "data_scrapper"."ExternalApiClient" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalApiClient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExternalApiClient_name_key"
  ON "data_scrapper"."ExternalApiClient" ("name");

CREATE TABLE IF NOT EXISTS "data_scrapper"."ExternalApiKey" (
  "id" TEXT NOT NULL,
  "keyId" TEXT NOT NULL,
  "keyPrefix" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 120,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "clientId" TEXT NOT NULL,
  CONSTRAINT "ExternalApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExternalApiKey_keyId_key"
  ON "data_scrapper"."ExternalApiKey" ("keyId");

CREATE UNIQUE INDEX IF NOT EXISTS "ExternalApiKey_keyHash_key"
  ON "data_scrapper"."ExternalApiKey" ("keyHash");

CREATE INDEX IF NOT EXISTS "ExternalApiKey_clientId_isActive_idx"
  ON "data_scrapper"."ExternalApiKey" ("clientId", "isActive");

CREATE INDEX IF NOT EXISTS "ExternalApiKey_expiresAt_idx"
  ON "data_scrapper"."ExternalApiKey" ("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'ExternalApiKey_clientId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."ExternalApiKey"
      ADD CONSTRAINT "ExternalApiKey_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "data_scrapper"."ExternalApiClient"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "data_scrapper"."ExternalApiScope" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalApiScope_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "external_api_client_scope_unique"
  ON "data_scrapper"."ExternalApiScope" ("clientId", "scope");

CREATE INDEX IF NOT EXISTS "ExternalApiScope_scope_idx"
  ON "data_scrapper"."ExternalApiScope" ("scope");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'ExternalApiScope_clientId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."ExternalApiScope"
      ADD CONSTRAINT "ExternalApiScope_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "data_scrapper"."ExternalApiClient"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "data_scrapper"."ExternalApiRequestLog" (
  "id" BIGSERIAL NOT NULL,
  "requestId" TEXT,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "latencyMs" INTEGER NOT NULL,
  "ip" TEXT,
  "userAgent" TEXT,
  "query" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "apiKeyId" TEXT,
  "clientId" TEXT,
  CONSTRAINT "ExternalApiRequestLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ExternalApiRequestLog_createdAt_idx"
  ON "data_scrapper"."ExternalApiRequestLog" ("createdAt");

CREATE INDEX IF NOT EXISTS "ExternalApiRequestLog_apiKeyId_createdAt_idx"
  ON "data_scrapper"."ExternalApiRequestLog" ("apiKeyId", "createdAt");

CREATE INDEX IF NOT EXISTS "ExternalApiRequestLog_clientId_createdAt_idx"
  ON "data_scrapper"."ExternalApiRequestLog" ("clientId", "createdAt");

CREATE INDEX IF NOT EXISTS "ExternalApiRequestLog_path_createdAt_idx"
  ON "data_scrapper"."ExternalApiRequestLog" ("path", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'ExternalApiRequestLog_apiKeyId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."ExternalApiRequestLog"
      ADD CONSTRAINT "ExternalApiRequestLog_apiKeyId_fkey"
      FOREIGN KEY ("apiKeyId") REFERENCES "data_scrapper"."ExternalApiKey"("id")
      ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'data_scrapper' AND c.conname = 'ExternalApiRequestLog_clientId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "data_scrapper"."ExternalApiRequestLog"
      ADD CONSTRAINT "ExternalApiRequestLog_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "data_scrapper"."ExternalApiClient"("id")
      ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;
