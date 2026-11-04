
-- SQL Cleanup Script to remove non-standard leave types
-- Only 'Annual Leave', 'Casual Leave', 'Medical Leave', and 'No-Pay Leave' will remain.

BEGIN;

-- 1. Create temporary tables to store IDs to delete
-- This allows us to use these lists across multiple DELETE statements.

CREATE TEMP TABLE temp_non_standard_types AS
SELECT id FROM "LeaveType" 
WHERE name NOT IN ('Annual Leave', 'Casual Leave', 'Medical Leave', 'No-Pay Leave');

CREATE TEMP TABLE temp_non_standard_requests AS
SELECT id FROM "LeaveRequest"
WHERE "leaveTypeId" IN (SELECT id FROM temp_non_standard_types);

-- 2. Delete dependent records in LeaveDocument
DELETE FROM "LeaveDocument" 
WHERE "leaveRequestId" IN (SELECT id FROM temp_non_standard_requests);

-- 3. Delete records in LeaveRequest
DELETE FROM "LeaveRequest" 
WHERE id IN (SELECT id FROM temp_non_standard_requests);

-- 4. Delete records in LeaveBalance
DELETE FROM "LeaveBalance" 
WHERE "leaveTypeId" IN (SELECT id FROM temp_non_standard_types);

-- 5. Finally, delete the LeaveType records themselves
DELETE FROM "LeaveType" 
WHERE id IN (SELECT id FROM temp_non_standard_types);

-- 6. Ensure the standard leave types have the correct properties
UPDATE "LeaveType" SET "defaultAllocation" = 14, color = '#3b82f6', description = 'Annual paid leave entitlement' WHERE name = 'Annual Leave';
UPDATE "LeaveType" SET "defaultAllocation" = 7, color = '#10b981', description = 'Casual leave for personal matters' WHERE name = 'Casual Leave';
UPDATE "LeaveType" SET "defaultAllocation" = NULL, color = '#f59e0b', description = 'Medical leave as approved by management' WHERE name = 'Medical Leave';
UPDATE "LeaveType" SET "defaultAllocation" = NULL, color = '#ef4444', description = 'Unpaid leave with salary deduction' WHERE name = 'No-Pay Leave';

-- Drop temp tables (though they'd be dropped on session end anyway)
DROP TABLE temp_non_standard_requests;
DROP TABLE temp_non_standard_types;

COMMIT;

-- Verify results
SELECT name, "defaultAllocation", color FROM "LeaveType" ORDER BY name;
