-- Add sequentialId column with autoincrement to User table
-- This depends on the DB provider. For PostgreSQL:
CREATE SEQUENCE IF NOT EXISTS user_sequential_id_seq;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sequentialId" INTEGER DEFAULT nextval('user_sequential_id_seq');

-- Update existing users with sequential IDs
DO $$
DECLARE
    r RECORD;
    i INTEGER := 1;
BEGIN
    FOR r IN SELECT id FROM "User" ORDER BY "createdAt" LOOP
        UPDATE "User" SET "sequentialId" = i WHERE id = r.id;
        i := i + 1;
    END LOOP;
END $$;
