import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { sendCheckOutNotification } from '@/util/notifications';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Validate request method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get the user from the request
  const supabase = createClient(req, res);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Check if the user is an admin or super admin
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!userData || (userData.role !== 'ADMIN' && userData.role !== 'SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    const { attendanceIds, notes } = req.body;

    if (!attendanceIds || !Array.isArray(attendanceIds) || attendanceIds.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid attendanceIds array' });
    }

    const now = new Date();
    let updatedCount = 0;

    // Process each attendance record force checkout
    for (const id of attendanceIds) {
      const attendance = await prisma.attendance.findUnique({
        where: { id },
        include: { location: true }
      });

      if (attendance && attendance.checkOutTime === null) {
        const checkoutNote = notes
          ? (attendance.notes ? `${attendance.notes} | ${notes}` : notes)
          : (attendance.notes ? `${attendance.notes} | Force checked-out by Admin` : 'Force checked-out by Admin');

        const updatedAttendance = await prisma.attendance.update({
          where: { id },
          data: {
            checkOutTime: now,
            checkOutLatitude: attendance.checkInLatitude,
            checkOutLongitude: attendance.checkInLongitude,
            notes: checkoutNote,
          },
        });

        updatedCount++;

        // Calculate duration in minutes for notification
        const durationMinutes = Math.round(
          (now.getTime() - new Date(attendance.checkInTime).getTime()) / (1000 * 60)
        );

        // Send check-out notification in background
        sendCheckOutNotification(
          attendance.userId,
          attendance.location.name,
          now,
          durationMinutes
        ).catch(err => console.error(`Error sending checkout notification for user ${attendance.userId}:`, err));
      }
    }

    return res.status(200).json({
      success: true,
      message: `Successfully checked out ${updatedCount} employees.`,
      count: updatedCount
    });

  } catch (error: any) {
    console.error('Error in force checkout endpoint:', error);
    return res.status(500).json({ error: 'Failed to process force checkout', details: error.message });
  }
}
