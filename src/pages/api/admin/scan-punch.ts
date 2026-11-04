import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { calculateLateness } from '@/util/attendance-logic';
import { sendCheckInNotification, sendCheckOutNotification } from '@/util/notifications';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Allow only POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const gatePasscode = req.headers['x-gate-passcode'];
  const isPasscodeValid = gatePasscode === 'HR';

  let isAuthorized = false;

  if (isPasscodeValid) {
    isAuthorized = true;
  } else {
    // Get requesting user session to verify authorization
    const supabase = createClient(req, res);
    const { data: { session } } = await supabase.auth.getSession();
    const currentUser = session?.user || null;

    if (currentUser) {
      // Check if the current user is an admin, manager or super admin
      const adminUser = await prisma.user.findUnique({
        where: { id: currentUser.id },
      });

      if (
        adminUser &&
        (adminUser.role === 'ADMIN' ||
          adminUser.role === 'SUPER_ADMIN' ||
          adminUser.role === 'MANAGER')
      ) {
        isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    return res.status(403).json({ error: 'Forbidden: Valid passcode or Admin session required' });
  }

  try {
    const { userId, locationId } = req.body;

    if (!userId || !locationId) {
      return res.status(400).json({ error: 'Missing required parameters: userId and locationId' });
    }

    // Verify location exists
    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Verify target employee exists
    const employee = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const now = new Date();

    // Check if the employee has an active check-in (open attendance record)
    const openAttendance = await prisma.attendance.findFirst({
      where: {
        userId,
        checkOutTime: null,
      },
    });

    if (openAttendance) {
      // --- PERFORM CHECK-OUT ---
      const checkInTimeMs = new Date(openAttendance.checkInTime).getTime();
      const elapsedMinutes = (now.getTime() - checkInTimeMs) / (1000 * 60);

      if (elapsedMinutes < 15) {
        const remainingMins = Math.ceil(15 - elapsedMinutes);
        return res.status(400).json({
          error: `Employee checked in less than 15 minutes ago. Check-out unavailable for ${remainingMins} more minute(s).`,
          remainingMinutes: remainingMins,
        });
      }

      const checkoutNotes = openAttendance.notes
        ? `${openAttendance.notes} | Checked out via Gate Scanner`
        : 'Checked out via Gate Scanner';

      const updatedAttendance = await prisma.attendance.update({
        where: { id: openAttendance.id },
        data: {
          checkOutTime: now,
          checkOutLatitude: location.latitude,
          checkOutLongitude: location.longitude,
          notes: checkoutNotes,
        },
      });

      // Calculate duration in minutes
      const durationMinutes = Math.round(
        (now.getTime() - new Date(updatedAttendance.checkInTime).getTime()) / (1000 * 60)
      );

      // Trigger push notification in background
      sendCheckOutNotification(
        userId,
        location.name,
        now,
        durationMinutes
      ).catch((err) => console.error('Error sending scan check-out notification:', err));

      return res.status(200).json({
        success: true,
        action: 'checked-out',
        employee: {
          id: employee.id,
          name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email,
          email: employee.email,
          profileImage: employee.profileImage,
          position: employee.position,
          department: employee.department,
        },
        attendance: updatedAttendance,
        timestamp: now.toISOString(),
      });
    } else {
      // --- PERFORM CHECK-IN ---
      // Fetch user with their rosters for lateness calculation
      const employeeWithRosters = await prisma.user.findUnique({
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
              workShift: true,
            },
          },
        },
      });

      const latenessResult = calculateLateness(now, employeeWithRosters);
      const isLate = latenessResult.isLate;

      const attendance = await prisma.attendance.create({
        data: {
          userId,
          locationId,
          checkInTime: now,
          checkInLatitude: location.latitude,
          checkInLongitude: location.longitude,
          status: isLate ? 'LATE' : 'PRESENT',
          notes: latenessResult.rosterStartTime
            ? `Roster start: ${latenessResult.rosterStartTime} | Checked in via Gate Scanner`
            : 'Checked in via Gate Scanner',
        },
      });

      // Trigger push notification in background
      sendCheckInNotification(
        userId,
        location.name,
        now
      ).catch((err) => console.error('Error sending scan check-in notification:', err));

      return res.status(200).json({
        success: true,
        action: 'checked-in',
        employee: {
          id: employee.id,
          name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email,
          email: employee.email,
          profileImage: employee.profileImage,
          position: employee.position,
          department: employee.department,
        },
        attendance,
        timestamp: now.toISOString(),
      });
    }
  } catch (error: any) {
    console.error('Error in scan-punch api handler:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
