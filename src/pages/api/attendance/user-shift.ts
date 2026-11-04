import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { getUserActiveShiftInfo } from '@/util/attendance-logic';
import { toZonedTime } from 'date-fns-tz';

const SRI_LANKA_TZ = 'Asia/Colombo';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = session.user.id;
    const now = new Date();
    const slNow = toZonedTime(now, SRI_LANKA_TZ);
    const todayStart = new Date(slNow);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(slNow);
    todayEnd.setHours(23, 59, 59, 999);

    // Fetch user with active rosters and OT requests
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        rosters: {
          where: {
            AND: [
              { startDate: { lte: now } },
              {
                OR: [
                  { endDate: { gte: now } },
                  { endDate: null }
                ]
              }
            ]
          },
          include: {
            workShift: true
          }
        },
        otRequests: {
          where: {
            status: 'APPROVED',
            date: {
              gte: todayStart,
              lte: todayEnd
            }
          }
        }
      }
    });

    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    const shiftInfo = getUserActiveShiftInfo(now, userData);
    const hasApprovedOT = userData.otRequests && userData.otRequests.length > 0;
    const approvedOTDetails = hasApprovedOT ? userData.otRequests[0] : null;

    return res.status(200).json({
      hasShift: shiftInfo.hasShift,
      shiftName: shiftInfo.shiftName,
      rosterStartTime: shiftInfo.rosterStartTime,
      rosterEndTime: shiftInfo.rosterEndTime,
      shiftStartDateTime: shiftInfo.shiftStartDateTime,
      shiftEndDateTime: shiftInfo.shiftEndDateTime,
      isShiftEnded: shiftInfo.isShiftEnded,
      remainingSeconds: shiftInfo.remainingSeconds,
      hasApprovedOT,
      approvedOTDetails
    });
  } catch (error: any) {
    console.error('Error fetching user shift info:', error);
    return res.status(500).json({ error: 'Failed to fetch user shift info' });
  }
}
