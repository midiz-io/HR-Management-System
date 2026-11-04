import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { sendCheckInNotification, sendCheckOutNotification } from '@/util/notifications';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const supabase = createClient(req, res);
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user || null;

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is admin
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true }
    });

    if (!userData || ((userData.role as any) !== 'ADMIN' && (userData.role as any) !== 'SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    const { attendanceId, type } = req.body;

    if (!attendanceId || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get attendance record
    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        user: true,
        location: true,
      },
    });

    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    let result;

    // Send appropriate notification based on type
    if (type === 'check-in') {
      result = await sendCheckInNotification(
        attendance.userId,
        attendance.location.name,
        attendance.checkInTime
      );
    } else if (type === 'check-out') {
      if (!attendance.checkOutTime) {
        return res.status(400).json({ error: 'Attendance record has no check-out time' });
      }

      const durationMinutes = Math.round(
        (attendance.checkOutTime.getTime() - attendance.checkInTime.getTime()) / (1000 * 60)
      );

      result = await sendCheckOutNotification(
        attendance.userId,
        attendance.location.name,
        attendance.checkOutTime,
        durationMinutes
      );
    } else {
      return res.status(400).json({ error: 'Invalid notification type' });
    }

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error sending attendance notification:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}