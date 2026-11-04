-- Drop the deprecated manual LeaveRestriction feature
-- (UI/API enforcement removed; this cleans up the DB table)

DROP TABLE IF EXISTS "LeaveRestriction";

