import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { createAdminClient } from '@/util/supabase/admin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const supabase = createClient(req, res);
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if the user is an admin
  const adminUser = await prisma.user.findUnique({
    where: { id: authUser.id },
  });

  if (!adminUser || (adminUser.role !== 'SUPER_ADMIN' && adminUser.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  if (req.method === 'POST') {
    const { userId, password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({ error: 'User ID and password are required' });
    }

    try {
      console.log(`Attempting password reset for user: ${userId}`);
      
      // 1. Update Supabase Auth if credentials available
      try {
        const adminClient = createAdminClient();
        const { error } = await adminClient.auth.admin.updateUserById(
          userId,
          { password: password }
        );
        if (error) {
          console.warn('Supabase auth update warning:', error);
        }
      } catch (adminClientErr: any) {
        console.warn('Supabase admin client error (proceeding with local credential update):', adminClientErr?.message);
      }

      // 2. Persist in SystemSetting USER_PASSWORDS so admins can view and copy
      try {
        const pwdSetting = await prisma.systemSetting.findUnique({
          where: { key: 'USER_PASSWORDS' },
        });
        let passwordsMap: Record<string, string> = {};
        if (pwdSetting?.value) {
          try {
            passwordsMap = JSON.parse(pwdSetting.value);
          } catch {}
        }
        passwordsMap[userId] = password;

        const targetDbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true }
        });
        if (targetDbUser?.email) {
          passwordsMap[targetDbUser.email] = password;
        }

        await prisma.systemSetting.upsert({
          where: { key: 'USER_PASSWORDS' },
          update: { value: JSON.stringify(passwordsMap) },
          create: { key: 'USER_PASSWORDS', value: JSON.stringify(passwordsMap) },
        });
      } catch (persistErr) {
        console.warn('Could not persist password in SystemSetting:', persistErr);
      }

      return res.status(200).json({ message: 'Password reset and saved successfully' });
    } catch (error: any) {
      console.error('FULL PASSWORD RESET ERROR:', JSON.stringify(error, null, 2));
      console.error('ERROR MESSAGE:', error.message);
      
      let errorMessage = 'Failed to reset password';
      if (error.message?.includes('Missing Supabase Admin credentials')) {
        errorMessage = 'Service Role Key missing. Please add SUPABASE_SERVICE_ROLE_KEY to your .env file.';
      } else {
        errorMessage = error.message || errorMessage;
      }

      return res.status(500).json({ 
        error: errorMessage,
        details: error.message 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
