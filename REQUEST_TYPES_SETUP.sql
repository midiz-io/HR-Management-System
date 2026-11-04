-- SQL to create new Request tables (SalaryAdvance, GatePass, ShortLeave)

-- Create Enums (Safely)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RequestStatus') THEN
        CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GatePassStatus') THEN
        CREATE TYPE "GatePassStatus" AS ENUM ('PENDING_SECTIONAL_HEAD', 'PENDING_HR', 'APPROVED', 'REJECTED', 'CANCELLED', 'RETURNED', 'NOT_RETURNED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShortLeaveType') THEN
        CREATE TYPE "ShortLeaveType" AS ENUM ('MORNING', 'EVENING');
    END IF;
END $$;

-- Ensure all enum values exist if the type was already created
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TYPE "GatePassStatus" ADD VALUE IF NOT EXISTS 'PENDING_SECTIONAL_HEAD';
ALTER TYPE "GatePassStatus" ADD VALUE IF NOT EXISTS 'PENDING_HR';
ALTER TYPE "GatePassStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "GatePassStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "GatePassStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "GatePassStatus" ADD VALUE IF NOT EXISTS 'RETURNED';
ALTER TYPE "GatePassStatus" ADD VALUE IF NOT EXISTS 'NOT_RETURNED';

ALTER TYPE "ShortLeaveType" ADD VALUE IF NOT EXISTS 'MORNING';
ALTER TYPE "ShortLeaveType" ADD VALUE IF NOT EXISTS 'EVENING';

COMMIT;

-- CreateTable SalaryAdvanceRequest
CREATE TABLE IF NOT EXISTS "SalaryAdvanceRequest" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "requestDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "transferDate" TIMESTAMP(3),
    "reason" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryAdvanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable GatePassRequest
CREATE TABLE IF NOT EXISTS "GatePassRequest" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "timeOut" TEXT NOT NULL,
    "expectedTimeIn" TEXT,
    "purpose" TEXT NOT NULL,
    "status" "GatePassStatus" NOT NULL DEFAULT 'PENDING_SECTIONAL_HEAD',
    "reviewerId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "returnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GatePassRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable ShortLeaveRequest
CREATE TABLE IF NOT EXISTS "ShortLeaveRequest" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "leaveType" "ShortLeaveType" NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShortLeaveRequest_pkey" PRIMARY KEY ("id")
);

-- Add Foreign Keys (Safely)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalaryAdvanceRequest_userId_fkey') THEN
        ALTER TABLE "SalaryAdvanceRequest" ADD CONSTRAINT "SalaryAdvanceRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalaryAdvanceRequest_reviewerId_fkey') THEN
        ALTER TABLE "SalaryAdvanceRequest" ADD CONSTRAINT "SalaryAdvanceRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GatePassRequest_userId_fkey') THEN
        ALTER TABLE "GatePassRequest" ADD CONSTRAINT "GatePassRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GatePassRequest_reviewerId_fkey') THEN
        ALTER TABLE "GatePassRequest" ADD CONSTRAINT "GatePassRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShortLeaveRequest_userId_fkey') THEN
        ALTER TABLE "ShortLeaveRequest" ADD CONSTRAINT "ShortLeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShortLeaveRequest_reviewerId_fkey') THEN
        ALTER TABLE "ShortLeaveRequest" ADD CONSTRAINT "ShortLeaveRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
