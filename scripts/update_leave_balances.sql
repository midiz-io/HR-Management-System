
-- SQL Script to initialize/update leave balances for 2026
-- Targets all users for the four standard leave types.

BEGIN;

-- Create a temporary mapping of standard leave types and their allocations
CREATE TEMP TABLE standard_allocations (
    name TEXT,
    days FLOAT
);

INSERT INTO standard_allocations (name, days) VALUES 
('Annual Leave', 14),
('Casual Leave', 7),
('Medical Leave', 0),
('No-Pay Leave', 0);

-- CTE to handle the upsert logic for all users and target leave types
WITH user_leave_combinations AS (
    SELECT 
        u.id as user_id,
        lt.id as leave_type_id,
        sa.days as total_days,
        2026 as target_year
    FROM "User" u
    CROSS JOIN "LeaveType" lt
    JOIN standard_allocations sa ON lt.name = sa.name
)
INSERT INTO "LeaveBalance" (id, "userId", "leaveTypeId", year, "totalDays", "usedDays", "pendingDays", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text, -- Generate a new ID as string
    ulc.user_id,
    ulc.leave_type_id,
    ulc.target_year,
    ulc.total_days,
    0, -- default usedDays
    0, -- default pendingDays
    NOW(),
    NOW()
FROM user_leave_combinations ulc
ON CONFLICT ("userId", "leaveTypeId", year) 
DO UPDATE SET 
    "totalDays" = EXCLUDED."totalDays",
    "updatedAt" = NOW();

DROP TABLE standard_allocations;

COMMIT;

-- Verify the balances for a sample (or count them)
SELECT u.email, lt.name, lb."totalDays", lb.year
FROM "LeaveBalance" lb
JOIN "User" u ON lb."userId" = u.id
JOIN "LeaveType" lt ON lb."leaveTypeId" = lt.id
WHERE lb.year = 2026
LIMIT 20;
