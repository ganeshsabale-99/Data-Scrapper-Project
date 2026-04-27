CREATE TABLE IF NOT EXISTS "tech_park"."ExternalApiClient" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalApiClient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExternalApiClient_name_key"
  ON "tech_park"."ExternalApiClient" ("name");

CREATE TABLE IF NOT EXISTS "tech_park"."ExternalApiKey" (
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
  ON "tech_park"."ExternalApiKey" ("keyId");

CREATE UNIQUE INDEX IF NOT EXISTS "ExternalApiKey_keyHash_key"
  ON "tech_park"."ExternalApiKey" ("keyHash");

CREATE INDEX IF NOT EXISTS "ExternalApiKey_clientId_isActive_idx"
  ON "tech_park"."ExternalApiKey" ("clientId", "isActive");

CREATE INDEX IF NOT EXISTS "ExternalApiKey_expiresAt_idx"
  ON "tech_park"."ExternalApiKey" ("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'ExternalApiKey_clientId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."ExternalApiKey"
      ADD CONSTRAINT "ExternalApiKey_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "tech_park"."ExternalApiClient"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "tech_park"."ExternalApiScope" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalApiScope_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "external_api_client_scope_unique"
  ON "tech_park"."ExternalApiScope" ("clientId", "scope");

CREATE INDEX IF NOT EXISTS "ExternalApiScope_scope_idx"
  ON "tech_park"."ExternalApiScope" ("scope");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'ExternalApiScope_clientId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."ExternalApiScope"
      ADD CONSTRAINT "ExternalApiScope_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "tech_park"."ExternalApiClient"("id")
      ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "tech_park"."ExternalApiRequestLog" (
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
  ON "tech_park"."ExternalApiRequestLog" ("createdAt");

CREATE INDEX IF NOT EXISTS "ExternalApiRequestLog_apiKeyId_createdAt_idx"
  ON "tech_park"."ExternalApiRequestLog" ("apiKeyId", "createdAt");

CREATE INDEX IF NOT EXISTS "ExternalApiRequestLog_clientId_createdAt_idx"
  ON "tech_park"."ExternalApiRequestLog" ("clientId", "createdAt");

CREATE INDEX IF NOT EXISTS "ExternalApiRequestLog_path_createdAt_idx"
  ON "tech_park"."ExternalApiRequestLog" ("path", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'ExternalApiRequestLog_apiKeyId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."ExternalApiRequestLog"
      ADD CONSTRAINT "ExternalApiRequestLog_apiKeyId_fkey"
      FOREIGN KEY ("apiKeyId") REFERENCES "tech_park"."ExternalApiKey"("id")
      ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'tech_park' AND c.conname = 'ExternalApiRequestLog_clientId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "tech_park"."ExternalApiRequestLog"
      ADD CONSTRAINT "ExternalApiRequestLog_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "tech_park"."ExternalApiClient"("id")
      ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;
