import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check if cookies exist in the request
  if (!req.cookies || Object.keys(req.cookies).length === 0) {
    return res.status(401).json({ error: 'No authentication cookies found' });
  }

  let user;
  try {
    const supabase = createClient(req, res);
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    user = data.user;

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!userData || ((userData.role as any) !== 'ADMIN' && (userData.role as any) !== 'SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
  } catch (authError) {
    console.error('Error in authentication:', authError);
    return res.status(401).json({ error: 'Authentication failed' });
  }

  // Handle POST request - Bulk create rosters
  if (req.method === 'POST') {
    try {
      const { userIds, workShiftId, startDate, endDate, repeatType, customDays } = req.body;

      if (!userIds || !Array.isArray(userIds) || !workShiftId || !startDate) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const rosters = await Promise.all(
        userIds.map(async (userId: string) => {
          return prisma.roster.create({
            data: {
              userId,
              workShiftId,
              startDate: new Date(startDate),
              endDate: endDate ? new Date(endDate) : null,
              isDaily: repeatType === 'DAILY',
              customDays: repeatType === 'CUSTOM' ? customDays : [],
            },
          });
        })
      );

      return res.status(201).json({ count: rosters.length, rosters });
    } catch (error: any) {
      console.error('Error bulk creating rosters:', error);
      return res.status(500).json({ error: 'Failed to create rosters', details: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
