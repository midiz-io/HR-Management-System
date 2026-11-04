import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const SRI_LANKA_TZ = 'Asia/Colombo';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify authenticated session
  const supabase = createClient(req, res);
  const { data: { user: sessionUser } } = await supabase.auth.getUser();

  if (!sessionUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check admin privileges
  const currentUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
  });

  if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  // GET: Fetch user info + today's check-in status
  if (req.method === 'GET') {
    try {
      const targetUser = await prisma.user.findUnique({
        where: { id },
        include: {
          assignedDepartment: true,
        },
      });

      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Calculate Sri Lanka date bounds for today
      const now = new Date();
      const slNow = toZonedTime(now, SRI_LANKA_TZ);
      const slStart = new Date(slNow);
      slStart.setHours(0, 0, 0, 0);
      const slEnd = new Date(slNow);
      slEnd.setHours(23, 59, 59, 999);

      const todayStart = fromZonedTime(slStart, SRI_LANKA_TZ);
      const todayEnd = fromZonedTime(slEnd, SRI_LANKA_TZ);

      // Find today's attendance record
      const todayAttendance = await prisma.attendance.findFirst({
        where: {
          userId: id,
          checkInTime: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
        include: {
          location: true,
        },
        orderBy: {
          checkInTime: 'desc',
        },
      });

      let checkInStatus = 'NOT_CHECKED_IN';
      let scheduledAutoCheckoutTime: Date | null = null;

      if (todayAttendance) {
        if (!todayAttendance.checkOutTime) {
          checkInStatus = 'IN_PROGRESS';
          // Calculate expected auto check-out time based on checkInTime + autoCheckoutHours
          const hours = targetUser.autoCheckoutHours || 8.0;
          scheduledAutoCheckoutTime = new Date(
            todayAttendance.checkInTime.getTime() + hours * 60 * 60 * 1000
          );
        } else {
          checkInStatus = 'CHECKED_OUT';
        }
      }

      return res.status(200).json({
        user: {
          id: targetUser.id,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName,
          email: targetUser.email,
          role: targetUser.role,
          position: targetUser.position,
          department: targetUser.assignedDepartment?.name || targetUser.department || 'Not Assigned',
          autoCheckoutEnabled: targetUser.autoCheckoutEnabled || false,
          autoCheckoutHours: targetUser.autoCheckoutHours || 8.0,
        },
        attendanceToday: todayAttendance
          ? {
              id: todayAttendance.id,
              checkInTime: todayAttendance.checkInTime,
              checkOutTime: todayAttendance.checkOutTime,
              status: todayAttendance.status,
              isAutoCheckedOut: todayAttendance.isAutoCheckedOut || false,
              locationName: todayAttendance.location?.name || 'Unknown',
            }
          : null,
        checkInStatus, // 'IN_PROGRESS' | 'CHECKED_OUT' | 'NOT_CHECKED_IN'
        scheduledAutoCheckoutTime,
      });
    } catch (error: any) {
      console.error('Error fetching auto-checkout info:', error);
      return res.status(500).json({ error: 'Failed to fetch auto-checkout settings', details: error.message });
    }
  }

  // POST or PATCH: Update user's auto check-out settings
  if (req.method === 'POST' || req.method === 'PATCH') {
    try {
      const { autoCheckoutEnabled, autoCheckoutHours } = req.body;

      const parsedHours = parseFloat(autoCheckoutHours);
      if (isNaN(parsedHours) || parsedHours <= 0 || parsedHours > 24) {
        return res.status(400).json({ error: 'Auto check-out hours must be a number between 0.5 and 24' });
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          autoCheckoutEnabled: Boolean(autoCheckoutEnabled),
          autoCheckoutHours: parsedHours,
        },
      });

      return res.status(200).json({
        message: 'Auto check-out schedule updated successfully',
        autoCheckoutEnabled: updatedUser.autoCheckoutEnabled,
        autoCheckoutHours: updatedUser.autoCheckoutHours,
      });
    } catch (error: any) {
      console.error('Error updating auto-checkout schedule:', error);
      return res.status(500).json({ error: 'Failed to update auto-checkout schedule', details: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
