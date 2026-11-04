import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const supabase = createClient(req, res);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userData = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!userData || ((userData.role as any) !== 'ADMIN' && (userData.role as any) !== 'SUPER_ADMIN')) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  if (req.method === 'GET') {
    try {
      const settings = await prisma.systemSetting.findMany();
      // Convert array of objects to key-value pairs
      const settingsMap = settings.reduce((acc: any, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {});
      return res.status(200).json(settingsMap);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      return res.status(500).json({ error: 'Failed to fetch settings' });
    }
  } else if (req.method === 'POST') {
    try {
      const settings = req.body; // Expecting { key: value, key2: value2 }

      for (const [key, value] of Object.entries(settings)) {
        await prisma.systemSetting.upsert({
          where: { key: key },
          update: { value: String(value) },
          create: { key: key, value: String(value) },
        });
      }

      return res.status(200).json({ success: true, message: 'Settings updated successfully' });
    } catch (error) {
      console.error('Failed to update settings:', error);
      return res.status(500).json({ error: 'Failed to update settings' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
