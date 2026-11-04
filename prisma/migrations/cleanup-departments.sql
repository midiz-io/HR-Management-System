-- Migration: Clean up duplicate departments
-- File: cleanup-departments.sql
-- Date: 2026-02-02

BEGIN;

-- Step 1: Update department names to remove leading/trailing whitespace
UPDATE "User"
SET department = TRIM(department)
WHERE department IS NOT NULL 
  AND department != TRIM(department);

-- Step 2: Find users with empty departments after trimming and set to NULL
UPDATE "User"
SET department = NULL
WHERE department IS NOT NULL 
  AND TRIM(department) = '';

-- Step 3: List all unique departments (for verification)
-- Uncomment to see the result:
-- SELECT DISTINCT department 
-- FROM "User" 
-- WHERE department IS NOT NULL 
-- ORDER BY department;

COMMIT;

-- After running this migration, refresh your application to see the changes
