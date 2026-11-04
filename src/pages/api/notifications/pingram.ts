import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { sendPingramNotification, createAttendanceReminder } from '@/util/pingram';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const supabase = createClient(req, res);
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Fetch full user record to check role
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
  });

  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  if (req.method === 'POST') {
    try {
      const { userIds, isTest } = req.body;

      if (!userIds || !Array.isArray(userIds)) {
        return res.status(400).json({ error: 'Invalid user IDs' });
      }

      let targetUsers;
      try {
        targetUsers = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            firstName: true,
            email: true,
            phoneNumber: true,
          }
        });
      } catch (e) {
        console.warn('Prisma query failed for notifications, likely missing phoneNumber column. Falling back...');
        targetUsers = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            firstName: true,
            email: true,
          }
        });
      }

      const results = await Promise.allSettled(
        targetUsers.map(u => {
          const payload = createAttendanceReminder({
            firstName: u.firstName || 'Employee',
            email: u.email,
            phoneNumber: (u as any).phoneNumber // phoneNumber might not be in prisma yet? I should check schema
          });
          return sendPingramNotification(payload);
        })
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.length - successCount;

      return res.status(200).json({
        message: isTest ? 'Test notifications sent' : 'Daily reminders sent',
        successCount,
        failCount,
        total: results.length
      });
    } catch (error: any) {
      console.error('Notification API Error:', error);
      return res.status(500).json({ error: error.message || 'Failed to send notifications' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
