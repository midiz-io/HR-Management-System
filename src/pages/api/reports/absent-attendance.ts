import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { format, eachDayOfInterval } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const SRI_LANKA_TZ = 'Asia/Colombo';

function isUserOnApprovedLeave(leaveRequests: any[] | undefined, targetDateStr: string): boolean {
  if (!leaveRequests || leaveRequests.length === 0) return false;
  return leaveRequests.some((leave) => {
    if (leave.status !== 'APPROVED') return false;
    const slStart = format(toZonedTime(new Date(leave.startDate), SRI_LANKA_TZ), 'yyyy-MM-dd');
    const slEnd = format(toZonedTime(new Date(leave.endDate), SRI_LANKA_TZ), 'yyyy-MM-dd');
    const utcStart = new Date(leave.startDate).toISOString().slice(0, 10);
    const utcEnd = new Date(leave.endDate).toISOString().slice(0, 10);
    return (
      (targetDateStr >= slStart && targetDateStr <= slEnd) ||
      (targetDateStr >= utcStart && targetDateStr <= utcEnd)
    );
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const supabase = createClient(req, res);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let userData: any = null;
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, email, role::text as role, department FROM "User" WHERE id = $1::uuid LIMIT 1`,
      user.id
    );
    userData = rows && rows[0] ? rows[0] : null;
  } catch {
    userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, department: true },
    });
  }

  if (!userData) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (req.method === 'GET') {
    try {
      const { startDate, endDate, department, locationId, userId } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required' });
      }

      const parseDateSafely = (dateInput: any, timeSuffix: string) => {
        if (!dateInput) return undefined;
        const d = new Date(dateInput);
        if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
          return fromZonedTime(`${dateInput} ${timeSuffix}`, SRI_LANKA_TZ);
        }
        if (isNaN(d.getTime())) {
          if (typeof dateInput === 'string') {
            const isoMatch = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (isoMatch) {
              return fromZonedTime(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]} ${timeSuffix}`, SRI_LANKA_TZ);
            }
          }
          return undefined;
        }
        return d;
      };

      const parsedStartDate = parseDateSafely(startDate, '00:00:00');
      const parsedEndDate = parseDateSafely(endDate, '23:59:59');

      if (!parsedStartDate || !parsedEndDate) {
        return res.status(400).json({ error: 'Invalid start date or end date format' });
      }

      const nowSL = toZonedTime(new Date(), SRI_LANKA_TZ);
      const todayStrSL = format(nowSL, 'yyyy-MM-dd');
      const startSL = toZonedTime(parsedStartDate, SRI_LANKA_TZ);
      const rawEndSL = toZonedTime(parsedEndDate, SRI_LANKA_TZ);
      const effectiveEndSL = format(rawEndSL, 'yyyy-MM-dd') > todayStrSL ? nowSL : rawEndSL;

      const daysInRange = format(startSL, 'yyyy-MM-dd') <= format(effectiveEndSL, 'yyyy-MM-dd')
        ? eachDayOfInterval({ start: startSL, end: effectiveEndSL })
        : [];

      const allUsersRaw = await prisma.user.findMany({
        where: {
          isResigned: false,
          role: { notIn: ['SUPER_ADMIN', 'ADMIN'] },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          position: true,
          department: true,
          departmentId: true,
          locationId: true,
          rosters: {
            include: { workShift: true }
          },
          leaveRequests: {
            where: { status: 'APPROVED' },
            select: {
              id: true,
              startDate: true,
              endDate: true,
              status: true,
            }
          }
        }
      });

      const allUsers = allUsersRaw.filter((u: any) => {
        const matchesUser = !userId || userId === 'ALL' || u.id === userId;
        const matchesLocation = !locationId || locationId === 'ALL' || u.locationId === locationId;
        const matchesDept = !department || department === 'ALL' || u.department === department || u.departmentId === department;
        return matchesUser && matchesLocation && matchesDept;
      });

      const allAttendances = await prisma.attendance.findMany({
        where: {
          checkInTime: { gte: parsedStartDate, lte: parsedEndDate }
        }
      });

      const absentRecords: any[] = [];

      daysInRange.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');

        allUsers.forEach(emp => {
          // Check if user had a real check-in on this day (status !== 'ABSENT')
          const userPresentOnDay = allAttendances.some(att => {
            const attDayStr = format(toZonedTime(att.checkInTime, SRI_LANKA_TZ), 'yyyy-MM-dd');
            return att.userId === emp.id && attDayStr === dateStr && att.status !== 'ABSENT';
          });

          if (userPresentOnDay) return;

          // Check if user has an APPROVED LeaveRequest on this day
          const isOnLeave = isUserOnApprovedLeave(emp.leaveRequests, dateStr);

          absentRecords.push({
            id: `${emp.id}-${dateStr}`,
            userId: emp.id,
            employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email,
            email: emp.email,
            position: emp.position || 'N/A',
            date: dateStr,
            status: isOnLeave ? 'ON LEAVE' : 'OFF DAY',
          });
        });
      });

      const finalData = absentRecords.sort((a, b) => b.date.localeCompare(a.date) || a.employeeName.localeCompare(b.employeeName));

      return res.status(200).json({
        success: true,
        data: finalData,
        summary: {
          totalAbsences: finalData.length,
          onLeaveCount: finalData.filter(a => a.status === 'ON LEAVE').length,
          offDayCount: finalData.filter(a => a.status === 'OFF DAY').length,
          uniqueEmployees: new Set(finalData.map(a => a.email)).size,
        },
        period: {
          startDate: format(toZonedTime(parsedStartDate, SRI_LANKA_TZ), 'MMM d, yyyy'),
          endDate: format(toZonedTime(parsedEndDate, SRI_LANKA_TZ), 'MMM d, yyyy'),
        },
      });
    } catch (error) {
      console.error('Error fetching absent attendance report:', error);
      return res.status(500).json({ error: 'Failed to fetch absent attendance report' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
