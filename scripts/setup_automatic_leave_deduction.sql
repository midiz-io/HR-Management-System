
-- SQL Script to implement Automatic Leave Balance Deduction
-- This script creates a database trigger that automatically updates LeaveBalance
-- whenever a LeaveRequest is inserted, updated, or deleted.

BEGIN;

-- 1. Create or replace the function to recalculate balances
CREATE OR REPLACE FUNCTION recalculate_leave_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_userId UUID;
    v_leaveTypeId TEXT;
    v_year INT;
BEGIN
    -- Determine the target user, leave type, and year
    IF (TG_OP = 'DELETE') THEN
        v_userId := OLD."userId";
        v_leaveTypeId := OLD."leaveTypeId";
        v_year := EXTRACT(YEAR FROM OLD."startDate");
    ELSE
        v_userId := NEW."userId";
        v_leaveTypeId := NEW."leaveTypeId";
        v_year := EXTRACT(YEAR FROM NEW."startDate");
    END IF;

    -- Ensure a balance record exists for this year (if it doesn't, we can't update it)
    -- This assumes balances are initialized separately, but we could add an INSERT here if needed.

    -- Update the LeaveBalance table for the specified combination
    UPDATE "LeaveBalance"
    SET 
        "usedDays" = (
            SELECT COALESCE(SUM("totalDays"), 0)
            FROM "LeaveRequest"
            WHERE "userId" = v_userId 
            AND "leaveTypeId" = v_leaveTypeId
            AND EXTRACT(YEAR FROM "startDate") = v_year
            AND status::TEXT = 'APPROVED'
        ),
        "pendingDays" = (
            SELECT COALESCE(SUM("totalDays"), 0)
            FROM "LeaveRequest"
            WHERE "userId" = v_userId 
            AND "leaveTypeId" = v_leaveTypeId
            AND EXTRACT(YEAR FROM "startDate") = v_year
            AND status::TEXT IN ('PENDING', 'VERIFIED')
        ),
        "updatedAt" = NOW()
    WHERE "userId" = v_userId 
    AND "leaveTypeId" = v_leaveTypeId
    AND year = v_year;

    -- Handle case where user changes LeaveType or dates (year) in an UPDATE
    IF (TG_OP = 'UPDATE') THEN
        IF (OLD."leaveTypeId" <> NEW."leaveTypeId" OR EXTRACT(YEAR FROM OLD."startDate") <> EXTRACT(YEAR FROM NEW."startDate")) THEN
            -- Recalculate for the OLD combination as well
            UPDATE "LeaveBalance"
            SET 
                "usedDays" = (
                    SELECT COALESCE(SUM("totalDays"), 0)
                    FROM "LeaveRequest"
                    WHERE "userId" = OLD."userId" 
                    AND "leaveTypeId" = OLD."leaveTypeId"
                    AND EXTRACT(YEAR FROM "startDate") = EXTRACT(YEAR FROM OLD."startDate")
                    AND status::TEXT = 'APPROVED'
                ),
                "pendingDays" = (
                    SELECT COALESCE(SUM("totalDays"), 0)
                    FROM "LeaveRequest"
                    WHERE "userId" = OLD."userId" 
                    AND "leaveTypeId" = OLD."leaveTypeId"
                    AND EXTRACT(YEAR FROM "startDate") = EXTRACT(YEAR FROM OLD."startDate")
                    AND status::TEXT IN ('PENDING', 'VERIFIED')
                ),
                "updatedAt" = NOW()
            WHERE "userId" = OLD."userId" 
            AND "leaveTypeId" = OLD."leaveTypeId"
            AND year = EXTRACT(YEAR FROM OLD."startDate");
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS trig_update_leave_balance ON "LeaveRequest";
CREATE TRIGGER trig_update_leave_balance
AFTER INSERT OR UPDATE OR DELETE ON "LeaveRequest"
FOR EACH ROW EXECUTE FUNCTION recalculate_leave_balance();

-- 3. Perform a one-time synchronization for all existing balances
UPDATE "LeaveBalance" lb
SET 
    "usedDays" = (
        SELECT COALESCE(SUM("totalDays"), 0)
        FROM "LeaveRequest" lr
        WHERE lr."userId" = lb."userId" 
        AND lr."leaveTypeId" = lb."leaveTypeId"
        AND EXTRACT(YEAR FROM lr."startDate") = lb.year
        AND lr.status::TEXT = 'APPROVED'
    ),
    "pendingDays" = (
        SELECT COALESCE(SUM("totalDays"), 0)
        FROM "LeaveRequest" lr
        WHERE lr."userId" = lb."userId" 
        AND lr."leaveTypeId" = lb."leaveTypeId"
        AND EXTRACT(YEAR FROM lr."startDate") = lb.year
        AND lr.status::TEXT IN ('PENDING', 'VERIFIED')
    ),
    "updatedAt" = NOW();

COMMIT;

-- Verify results
SELECT u.email, lt.name, lb."totalDays", lb."usedDays", lb."pendingDays", lb.year
FROM "LeaveBalance" lb
JOIN "User" u ON lb."userId" = u.id
JOIN "LeaveType" lt ON lb."leaveTypeId" = lt.id
ORDER BY u.email, lt.name;
