CREATE TABLE "Lead" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "companyName" TEXT,
    "communicationMethod" TEXT,
    "city" TEXT,
    "lookingFor" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TRIAL_7_DAY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Lead_type_createdAt_idx" ON "Lead"("type", "createdAt");
CREATE INDEX "Lead_email_idx" ON "Lead"("email");
