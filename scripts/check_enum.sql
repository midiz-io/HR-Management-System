
SELECT e.enumlabel
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace 
WHERE t.typname = 'LeaveStatus';
