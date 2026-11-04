-- ====================================================================
-- SUPABASE PASSWORD RESET UTILITY (SQL)
-- ====================================================================
-- Use this script in your Supabase SQL Editor to manually reset 
-- a user's password if the UI or API is unavailable.
-- ====================================================================

-- 1. Ensure the pgcrypto extension is active
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. RESET QUERY
-- Replace 'PASTE_USER_UUID_HERE' with the actual user ID from the Users table
-- Replace 'PASTE_NEW_PASSWORD_HERE' with the new password
UPDATE auth.users 
SET encrypted_password = crypt('PASTE_NEW_PASSWORD_HERE', gen_salt('bf')),
    updated_at = now(),
    email_confirmed_at = COALESCE(email_confirmed_at, now()) -- Ensure user is confirmed
WHERE id = 'PASTE_USER_UUID_HERE'::uuid;


/* 
  DIRECTIONS:
  1. Go to Supabase Dashboard -> Authentication -> Users.
  2. Copy the "User ID" (UUID) of the target user.
  3. Go to Supabase Dashboard -> SQL Editor.
  4. Paste this script, replace the placeholders, and click RUN.
*/
