-- Script to fix duplicate departments in the database
-- This script will standardize department names and remove duplicates

-- Step 1: Find all duplicate/similar department names
-- This query shows which departments might be duplicates
SELECT department, COUNT(*) as count
FROM "User"
WHERE department IS NOT NULL
GROUP BY department
ORDER BY count DESC, department;

-- Step 2: Update department names to remove leading/trailing whitespace
UPDATE "User"
SET department = TRIM(department)
WHERE department IS NOT NULL;

-- Step 3: Standardize department names (Title Case)
-- This will ensure consistent casing across all departments
UPDATE "User"
SET department = INITCAP(TRIM(department))
WHERE department IS NOT NULL;

-- Step 4: Find and display any remaining duplicates
SELECT department, COUNT(*) as user_count
FROM "User"
WHERE department IS NOT NULL
GROUP BY department
HAVING COUNT(*) > 0
ORDER BY department;

-- Note: After running this script, you may need to manually review and consolidate
-- departments with similar names (e.g., "IT Department" vs "IT" vs "Information Technology")
