import { createClient } from '@supabase/supabase-js'

const FALLBACK_SUPABASE_URL = 'https://kvecywzxmudayezsvhie.supabase.co';
const FALLBACK_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2ZWN5d3p4bXVkYXllenN2aGllIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjY4Njk4MCwiZXhwIjoyMDYyMjYyOTgwfQ.gtXP8gPoX6VUXf4q3JNl6sLfiDBl5DcmL3A96EKVDuI';

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || FALLBACK_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase Admin credentials (URL or Service Role Key)');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
