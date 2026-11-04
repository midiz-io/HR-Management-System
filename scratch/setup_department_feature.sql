-- Create Department table
CREATE TABLE IF NOT EXISTS "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "headId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- Create OTRequest table
CREATE TABLE IF NOT EXISTS "OTRequest" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "totalHours" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewerId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OTRequest_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint to Department name
CREATE UNIQUE INDEX IF NOT EXISTS "Department_name_key" ON "Department"("name");

-- Add unique constraint to Department headId
CREATE UNIQUE INDEX IF NOT EXISTS "Department_headId_key" ON "Department"("headId");

-- Add departmentId to User table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='User' AND column_name='departmentId') THEN
        ALTER TABLE "User" ADD COLUMN "departmentId" TEXT;
    END IF;
END $$;

-- Add foreign key constraints
-- Using DO blocks to avoid errors if constraints already exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Department_headId_fkey') THEN
        ALTER TABLE "Department" ADD CONSTRAINT "Department_headId_fkey" FOREIGN KEY ("headId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_departmentId_fkey') THEN
        ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OTRequest_userId_fkey') THEN
        ALTER TABLE "OTRequest" ADD CONSTRAINT "OTRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OTRequest_reviewerId_fkey') THEN
        ALTER TABLE "OTRequest" ADD CONSTRAINT "OTRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
