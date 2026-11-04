-- BULK ROSTER AND LOCATION ASSOCIATION SCHEMA UPDATE
-- This script adds the necessary columns to the User and Roster tables
-- to support location filtering and custom repeating roster patterns.

-- 1. Add locationId to User table to associate employees with locations
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "locationId" TEXT;

-- 2. Add isDaily to Roster table to support everyday repeating patterns
ALTER TABLE "Roster" ADD COLUMN IF NOT EXISTS "isDaily" BOOLEAN DEFAULT FALSE;

-- 3. Add customDays to Roster table to support specific day-by-day patterns
ALTER TABLE "Roster" ADD COLUMN IF NOT EXISTS "customDays" TEXT[] DEFAULT '{}';

-- 4. (Optional) Create indexes for better performance on filtering
CREATE INDEX IF NOT EXISTS "idx_user_locationId" ON "User"("locationId");
CREATE INDEX IF NOT EXISTS "idx_roster_isDaily" ON "Roster"("isDaily");

-- 5. Add foreign key constraint for User location association
-- This ensures data integrity between Users and Locations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'User_locationId_fkey'
    ) THEN
        ALTER TABLE "User" 
        ADD CONSTRAINT "User_locationId_fkey" 
        FOREIGN KEY ("locationId") 
        REFERENCES "Location"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;
