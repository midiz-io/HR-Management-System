-- =================================================================
-- COMPANY DOCUMENTS & POLICIES SCHEMA SETUP
-- Categories: HR Policy (Tsf & Divron), Code of Conduct, Accommodation Code of Conduct
-- Features: View Online, Download, Gating Agreement ("I Agree & Continue"),
--           Scroll-to-bottom detection, Versioning & Audit Trail
-- =================================================================

-- 1. Create CompanyDocument Table safely (using TEXT for category to avoid postgres enum ownership issues)
CREATE TABLE IF NOT EXISTS "CompanyDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'HR_POLICY',
    "customCategory" TEXT,
    "companyScope" TEXT NOT NULL DEFAULT 'ALL',
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "fileType" TEXT DEFAULT 'application/pdf',
    "version" TEXT NOT NULL DEFAULT 'v1.0',
    "versionNotes" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyDocument_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CompanyDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Ensure column companyScope exists if table was created previously
ALTER TABLE "CompanyDocument" ADD COLUMN IF NOT EXISTS "companyScope" TEXT NOT NULL DEFAULT 'ALL';

-- Convert category column to text if it was created as enum earlier
DO $$ 
BEGIN
    ALTER TABLE "CompanyDocument" ALTER COLUMN "category" DROP DEFAULT;
    ALTER TABLE "CompanyDocument" ALTER COLUMN "category" TYPE text;
    ALTER TABLE "CompanyDocument" ALTER COLUMN "category" SET DEFAULT 'HR_POLICY';
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 2. Create DocumentAcknowledgement Table
CREATE TABLE IF NOT EXISTS "DocumentAcknowledgement" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "notes" TEXT,

    CONSTRAINT "DocumentAcknowledgement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DocumentAcknowledgement_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CompanyDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 3. Create Unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentAcknowledgement_doc_user_version_unique" 
ON "DocumentAcknowledgement"("documentId", "userId", "version");

-- 4. Create Indexes for High Performance Search & Lookups
CREATE INDEX IF NOT EXISTS "CompanyDocument_category_idx" ON "CompanyDocument"("category");
CREATE INDEX IF NOT EXISTS "CompanyDocument_isActive_idx" ON "CompanyDocument"("isActive");
CREATE INDEX IF NOT EXISTS "CompanyDocument_companyScope_idx" ON "CompanyDocument"("companyScope");
CREATE INDEX IF NOT EXISTS "CompanyDocument_createdAt_idx" ON "CompanyDocument"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "DocumentAcknowledgement_userId_idx" ON "DocumentAcknowledgement"("userId");
CREATE INDEX IF NOT EXISTS "DocumentAcknowledgement_documentId_idx" ON "DocumentAcknowledgement"("documentId");
