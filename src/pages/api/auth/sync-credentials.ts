import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createAdminClient } from '@/util/supabase/admin';

function getCandidateDefaultPasswords(user: {
  role?: string | null;
  firstName?: string | null;
  email: string;
}): string[] {
  const candidates = new Set<string>();

  if (user.role === 'SUPER_ADMIN') {
    candidates.add('SuperAdmin@2026');
  }
  if (user.role === 'ADMIN' || user.role === 'SECTIONAL_HEAD') {
    candidates.add('Admin@2026');
    candidates.add('admin@2026');
    candidates.add('Admin@123');
    candidates.add('SectionalHead@2026');
  }
  if (user.role === 'MANAGER' || user.role === 'SECTIONAL_HEAD') {
    candidates.add('Manager@2026');
    candidates.add('manager@2026');
  }

  const firstPrefix = (user.firstName || '').replace(/[^a-zA-Z0-9]/g, '');
  if (firstPrefix) {
    candidates.add(`${firstPrefix}@123`);
    candidates.add(`${firstPrefix.toLowerCase()}@123`);
    candidates.add(`${firstPrefix.charAt(0).toUpperCase()}${firstPrefix.slice(1).toLowerCase()}@123`);
  }

  const emailPrefix = (user.email.split('@')[0] || '').replace(/[^a-zA-Z0-9]/g, '');
  if (emailPrefix) {
    candidates.add(`${emailPrefix}@123`);
    candidates.add(`${emailPrefix.toLowerCase()}@123`);
    candidates.add(`${emailPrefix.charAt(0).toUpperCase()}${emailPrefix.slice(1).toLowerCase()}@123`);
  }

  candidates.add('User@123');
  return Array.from(candidates);
}

export async function syncSupabaseAuthCredentials(
  userId: string,
  cleanEmail: string,
  password: string
): Promise<boolean> {
  let synced = false;

  // 1. Primary path: Supabase Admin API (uses service_role key with fallback)
  try {
    const adminClient = createAdminClient();
    const { data: updatedById, error: updateByIdErr } = await adminClient.auth.admin.updateUserById(
      userId,
      {
        email: cleanEmail,
        password,
        email_confirm: true,
      }
    );

    if (!updateByIdErr && updatedById?.user) {
      synced = true;
    } else {
      // User ID in public."User" might differ from auth.users.id or not exist in auth.users yet
      const { data: listData, error: listErr } = await adminClient.auth.admin.listUsers({
        perPage: 1000,
      });

      const existingAuthUser = !listErr
        ? listData?.users?.find((u) => (u.email || '').trim().toLowerCase() === cleanEmail)
        : undefined;

      if (existingAuthUser) {
        const { error: updateByEmailIdErr } = await adminClient.auth.admin.updateUserById(
          existingAuthUser.id,
          {
            email: cleanEmail,
            password,
            email_confirm: true,
          }
        );
        if (!updateByEmailIdErr) {
          synced = true;
        }
      } else {
        // Create missing auth.users account with matching UUID
        const { error: createWithIdErr } = await adminClient.auth.admin.createUser({
          id: userId,
          email: cleanEmail,
          password,
          email_confirm: true,
        } as any);

        if (!createWithIdErr) {
          synced = true;
        } else {
          const { error: createWithoutIdErr } = await adminClient.auth.admin.createUser({
            email: cleanEmail,
            password,
            email_confirm: true,
          });
          if (!createWithoutIdErr) {
            synced = true;
          }
        }
      }
    }
  } catch (adminErr) {
    console.warn('Supabase Admin API sync warning (falling back to direct SQL):', adminErr);
  }

  // 2. Secondary path: Direct PostgreSQL update on auth.users (using extensions.crypt for Supabase)
  try {
    try {
      await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    } catch {
      // Ignore if extension already exists in extensions schema or user lacks CREATE EXTENSION privilege
    }

    const authRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, email FROM auth.users WHERE id = $1::uuid OR lower(email) = lower($2)`,
      userId,
      cleanEmail
    );

    if (authRows && authRows.length > 0) {
      const targetAuthId = authRows[0].id;
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE auth.users
           SET encrypted_password = extensions.crypt($1, extensions.gen_salt('bf')),
               email = lower($2),
               email_confirmed_at = COALESCE(email_confirmed_at, now()),
               confirmation_token = COALESCE(confirmation_token, ''),
               recovery_token = COALESCE(recovery_token, ''),
               email_change_token_new = COALESCE(email_change_token_new, ''),
               email_change = COALESCE(email_change, ''),
               raw_app_meta_data = COALESCE(raw_app_meta_data, '{"provider":"email","providers":["email"]}'::jsonb),
               raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb),
               aud = COALESCE(NULLIF(aud, ''), 'authenticated'),
               role = COALESCE(NULLIF(role, ''), 'authenticated'),
               updated_at = now()
           WHERE id = $3::uuid OR lower(email) = lower($2)`,
          password,
          cleanEmail,
          targetAuthId
        );
        synced = true;
      } catch {
        await prisma.$executeRawUnsafe(
          `UPDATE auth.users
           SET encrypted_password = crypt($1, gen_salt('bf')),
               email = lower($2),
               email_confirmed_at = COALESCE(email_confirmed_at, now()),
               confirmation_token = COALESCE(confirmation_token, ''),
               recovery_token = COALESCE(recovery_token, ''),
               email_change_token_new = COALESCE(email_change_token_new, ''),
               email_change = COALESCE(email_change, ''),
               raw_app_meta_data = COALESCE(raw_app_meta_data, '{"provider":"email","providers":["email"]}'::jsonb),
               raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb),
               aud = COALESCE(NULLIF(aud, ''), 'authenticated'),
               role = COALESCE(NULLIF(role, ''), 'authenticated'),
               updated_at = now()
           WHERE id = $3::uuid OR lower(email) = lower($2)`,
          password,
          cleanEmail,
          targetAuthId
        );
        synced = true;
      }

      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO auth.identities (
             id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
           )
           SELECT
             gen_random_uuid(),
             $1::uuid,
             $1::text,
             jsonb_build_object('sub', $1::text, 'email', lower($2), 'email_verified', true, 'phone_verified', false),
             'email',
             now(),
             now(),
             now()
           WHERE NOT EXISTS (
             SELECT 1 FROM auth.identities WHERE user_id = $1::uuid AND provider = 'email'
           )`,
          targetAuthId,
          cleanEmail
        );
      } catch (identityErr) {
        console.warn('Notice ensuring auth.identities:', identityErr);
      }
    } else if (!synced) {
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO auth.users (
             instance_id, id, aud, role, email, encrypted_password,
             email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
             created_at, updated_at, confirmation_token, email_change,
             email_change_token_new, recovery_token, is_sso_user
           ) VALUES (
             '00000000-0000-0000-0000-000000000000',
             $1::uuid,
             'authenticated',
             'authenticated',
             lower($2),
             extensions.crypt($3, extensions.gen_salt('bf')),
             now(),
             '{"provider":"email","providers":["email"]}'::jsonb,
             '{}'::jsonb,
             now(),
             now(),
             '', '', '', '', false
           ) ON CONFLICT (id) DO UPDATE SET
             encrypted_password = extensions.crypt($3, extensions.gen_salt('bf')),
             email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
             updated_at = now()`,
          userId,
          cleanEmail,
          password
        );
        synced = true;
      } catch {
        await prisma.$executeRawUnsafe(
          `INSERT INTO auth.users (
             instance_id, id, aud, role, email, encrypted_password,
             email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
             created_at, updated_at, confirmation_token, email_change,
             email_change_token_new, recovery_token, is_sso_user
           ) VALUES (
             '00000000-0000-0000-0000-000000000000',
             $1::uuid,
             'authenticated',
             'authenticated',
             lower($2),
             crypt($3, gen_salt('bf')),
             now(),
             '{"provider":"email","providers":["email"]}'::jsonb,
             '{}'::jsonb,
             now(),
             now(),
             '', '', '', '', false
           ) ON CONFLICT (id) DO UPDATE SET
             encrypted_password = crypt($3, gen_salt('bf')),
             email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
             updated_at = now()`,
          userId,
          cleanEmail,
          password
        );
        synced = true;
      }
    }
  } catch (sqlErr) {
    console.warn('Direct SQL auth.users sync warning:', sqlErr);
  }

  return synced;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const cleanEmail = rawEmail.trim().toLowerCase();

    if (!cleanEmail || !password) {
      return res.status(400).json({ synced: false, error: 'Email and password are required' });
    }

    // 1. Find the user in public."User" (case-insensitive)
    const dbUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: cleanEmail,
          mode: 'insensitive',
        },
      },
    });

    if (!dbUser || dbUser.isResigned) {
      return res.status(200).json({ synced: false });
    }

    // 2. Load saved passwords from SystemSetting (USER_PASSWORDS)
    let passwordsMap: Record<string, string> = {};
    try {
      const pwdSetting = await prisma.systemSetting.findUnique({
        where: { key: 'USER_PASSWORDS' },
      });
      if (pwdSetting?.value) {
        passwordsMap = JSON.parse(pwdSetting.value);
      }
    } catch (e) {
      console.warn('Could not load USER_PASSWORDS setting during sync:', e);
    }

    let savedPassword =
      passwordsMap[dbUser.id] ||
      passwordsMap[dbUser.email] ||
      passwordsMap[cleanEmail];

    if (!savedPassword) {
      for (const [k, v] of Object.entries(passwordsMap)) {
        if (k.trim().toLowerCase() === cleanEmail && typeof v === 'string') {
          savedPassword = v;
          break;
        }
      }
    }

    const candidateDefaults = getCandidateDefaultPasswords(dbUser);

    let isAuthorizedPassword = false;
    if (savedPassword && (password === savedPassword || password.trim() === savedPassword.trim())) {
      isAuthorizedPassword = true;
    } else if (candidateDefaults.includes(password) || candidateDefaults.includes(password.trim())) {
      isAuthorizedPassword = true;
    }

    // Check if the password already matches in auth.users (e.g. only email_confirmed_at or token fields were null)
    if (!isAuthorizedPassword) {
      try {
        const existingMatch: any[] = await prisma.$queryRawUnsafe(
          `SELECT id FROM auth.users WHERE (id = $1::uuid OR lower(email) = lower($2)) AND encrypted_password = extensions.crypt($3, encrypted_password)`,
          dbUser.id,
          cleanEmail,
          password
        );
        if (existingMatch && existingMatch.length > 0) {
          isAuthorizedPassword = true;
        }
      } catch {
        try {
          const existingMatchFallback: any[] = await prisma.$queryRawUnsafe(
            `SELECT id FROM auth.users WHERE (id = $1::uuid OR lower(email) = lower($2)) AND encrypted_password = crypt($3, encrypted_password)`,
            dbUser.id,
            cleanEmail,
            password
          );
          if (existingMatchFallback && existingMatchFallback.length > 0) {
            isAuthorizedPassword = true;
          }
        } catch {
          // Ignore
        }
      }
    }

    if (!isAuthorizedPassword) {
      return res.status(200).json({ synced: false });
    }

    // 3. Synchronize Supabase Auth credentials via Admin API + Direct SQL fallback
    const synced = await syncSupabaseAuthCredentials(dbUser.id, cleanEmail, password);

    // 4. Persist the active password in USER_PASSWORDS so User Management displays it accurately
    try {
      passwordsMap[dbUser.id] = password;
      passwordsMap[dbUser.email] = password;
      passwordsMap[cleanEmail] = password;

      await prisma.systemSetting.upsert({
        where: { key: 'USER_PASSWORDS' },
        update: { value: JSON.stringify(passwordsMap) },
        create: { key: 'USER_PASSWORDS', value: JSON.stringify(passwordsMap) },
      });
    } catch (persistErr) {
      console.warn('Could not persist synced password in SystemSetting:', persistErr);
    }

    return res.status(200).json({ synced });
  } catch (error: any) {
    console.error('Error in /api/auth/sync-credentials:', error);
    return res.status(500).json({ synced: false, error: error?.message || 'Internal server error' });
  }
}
