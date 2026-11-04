import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import {
  format,
  eachDayOfInterval,
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { calculateLateness } from '@/util/attendance-logic';

const SRI_LANKA_TZ = 'Asia/Colombo';

const formatToSriLankanTime = (date: Date | string, formatString: string = 'MMM d, yyyy HH:mm:ss'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const zonedDate = toZonedTime(dateObj, SRI_LANKA_TZ);
  return format(zonedDate, formatString);
};

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
      `SELECT id, email, "firstName", "lastName", role::text as role FROM "User" WHERE id = $1::uuid LIMIT 1`,
      user.id
    );
    userData = rows && rows[0] ? rows[0] : null;
  } catch {
    userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
  }

  if (!userData) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (req.method === 'POST') {
    try {
      const { userId, startDate, endDate, includeDetails, locationId, status, departmentId } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const role = (userData.role || 'ADMIN') as string;
      if (
        userId &&
        userId !== 'ALL' &&
        role !== 'ADMIN' &&
        role !== 'SUPER_ADMIN' &&
        role !== 'MANAGER' &&
        role !== 'SECTIONAL_HEAD' &&
        userId !== user.id
      ) {
        return res.status(403).json({ error: 'Forbidden: You can only access your own attendance records' });
      }

      const startDateStr = typeof startDate === 'string' && startDate.includes('T') ? startDate.split('T')[0] : startDate;
      const endDateStr = typeof endDate === 'string' && endDate.includes('T') ? endDate.split('T')[0] : endDate;
      const parsedStartDate = fromZonedTime(`${startDateStr} 00:00:00`, SRI_LANKA_TZ);
      const parsedEndDate = fromZonedTime(`${endDateStr} 23:59:59`, SRI_LANKA_TZ);

      const nowSL = toZonedTime(new Date(), SRI_LANKA_TZ);
      const todayStrSL = format(nowSL, 'yyyy-MM-dd');
      const startSL = toZonedTime(parsedStartDate, SRI_LANKA_TZ);
      const rawEndSL = toZonedTime(parsedEndDate, SRI_LANKA_TZ);
      const effectiveEndSL = format(rawEndSL, 'yyyy-MM-dd') > todayStrSL ? nowSL : rawEndSL;

      const daysInRange = format(startSL, 'yyyy-MM-dd') <= format(effectiveEndSL, 'yyyy-MM-dd')
        ? eachDayOfInterval({ start: startSL, end: effectiveEndSL })
        : [];

      let finalAttendances: any[] = [];
      let reportTitle = 'Attendance Report';

      const usersWhere: any = {
        isResigned: false,
      };
      if (userId && userId !== 'ALL') {
        usersWhere.id = userId;
      }

      let deptNameFilter = '';
      if (departmentId && departmentId !== 'ALL') {
        deptNameFilter = departmentId;
        try {
          const deptObj = await prisma.department.findUnique({
            where: { id: departmentId }
          });
          if (deptObj) deptNameFilter = deptObj.name;
        } catch {
          // departmentId might already be a name string
        }

        usersWhere.OR = [
          { departmentId: departmentId },
          { department: deptNameFilter }
        ];
      }

      const allUsers = await prisma.user.findMany({
        where: usersWhere,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          department: true,
          position: true,
          rosters: {
            where: {
              AND: [
                { startDate: { lte: parsedEndDate } },
                { OR: [{ endDate: { gte: parsedStartDate } }, { endDate: null }] }
              ]
            },
            include: { workShift: true },
            orderBy: { startDate: 'desc' }
          },
          leaveRequests: {
            where: {
              status: 'APPROVED',
            },
            select: {
              id: true,
              startDate: true,
              endDate: true,
              status: true,
            }
          }
        }
      });

      const attWhere: any = {
        checkInTime: { gte: parsedStartDate, lte: parsedEndDate }
      };
      if (locationId && locationId !== 'ALL') attWhere.locationId = locationId;
      if (userId && userId !== 'ALL') attWhere.userId = userId;
      if (status === 'IN PROGRESS' || status === 'ACTIVE' || status === 'Currently Not Checked Out' || status === 'CURRENTLY NOT CHECKED OUT') {
        attWhere.checkOutTime = null;
        attWhere.status = { not: 'ABSENT' };
      } else if (status === 'COMPLETED' || status === 'PRESENT') {
        attWhere.checkOutTime = { not: null };
        attWhere.status = { not: 'ABSENT' };
      } else if (
        status &&
        status !== 'ALL' &&
        status !== 'ABSENT' &&
        status !== 'ON LEAVE' &&
        status !== 'OFF DAY' &&
        status !== 'LATE'
      ) {
        if (['PRESENT', 'LATE', 'ABSENT', 'OVERTIME'].includes(status)) attWhere.status = status;
      }
      if (departmentId && departmentId !== 'ALL') {
        attWhere.user = {
          OR: [
            { departmentId: departmentId },
            { department: deptNameFilter }
          ]
        };
      }

      const baseAttendances = await prisma.attendance.findMany({
        where: attWhere,
        include: {
          location: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, department: true, position: true }
          }
        },
        orderBy: { checkInTime: 'asc' }
      });

      // Build approvedLeavesByEmployee map for Excel Grid Tracker ("MMM d, yyyy" dates)
      const approvedLeavesByEmployee: Record<string, string[]> = {};
      allUsers.forEach(u => {
        const empName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
        approvedLeavesByEmployee[empName] = [];
        daysInRange.forEach(d => {
          const dStr = format(d, 'yyyy-MM-dd');
          if (isUserOnApprovedLeave(u.leaveRequests, dStr)) {
            approvedLeavesByEmployee[empName].push(format(d, 'MMM d, yyyy'));
          }
        });
      });

      if (status === 'ABSENT' || status === 'ON LEAVE' || status === 'OFF DAY') {
        reportTitle = status === 'ON LEAVE'
          ? 'On Leave Employees Report'
          : status === 'OFF DAY'
            ? 'Off Day (Absent) Employees Report'
            : 'Absent (On Leave & Off Day) Report';

        daysInRange.forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd');

          allUsers.forEach(u => {
            const hasAtt = baseAttendances.some(att => {
              const attDayStr = format(toZonedTime(att.checkInTime, SRI_LANKA_TZ), 'yyyy-MM-dd');
              return att.userId === u.id && attDayStr === dateStr && att.status !== 'ABSENT';
            });
            if (hasAtt) return;

            const onLeave = isUserOnApprovedLeave(u.leaveRequests, dateStr);
            const derivedStatus = onLeave ? 'ON LEAVE' : 'OFF DAY';

            if (status === 'ON LEAVE' && derivedStatus !== 'ON LEAVE') return;
            if (status === 'OFF DAY' && derivedStatus !== 'OFF DAY') return;

            finalAttendances.push({
              employee: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
              location: 'N/A',
              checkIn: format(day, 'MMM d, yyyy'),
              checkOut: '-',
              duration: '-',
              status: derivedStatus,
              date: dateStr
            });
          });
        });
      } else if (status === 'LATE') {
        reportTitle = 'Late Attendance Report';

        baseAttendances.forEach(att => {
          const userObj = allUsers.find(u => u.id === att.userId);
          const result = calculateLateness(att.checkInTime, userObj);

          if (result.status === 'LATE' || att.status === 'LATE') {
            finalAttendances.push({
              employee: `${att.user.firstName || ''} ${att.user.lastName || ''}`.trim() || att.user.email,
              location: att.location?.name || 'N/A',
              date: formatToSriLankanTime(att.checkInTime, 'yyyy-MM-dd'),
              scheduled: result.rosterStartTime || 'N/A',
              checkIn: formatToSriLankanTime(att.checkInTime, 'HH:mm:ss'),
              lateness: `${result.lateMinutes > 0 ? result.lateMinutes : 0} mins`,
              status: 'LATE'
            });
          }
        });
      } else {
        // Standard report (COMPLETED, IN PROGRESS, ALL, etc.)
        finalAttendances = baseAttendances.map(att => {
          const userObj = allUsers.find(u => u.id === att.userId);
          const attDateStr = format(toZonedTime(att.checkInTime, SRI_LANKA_TZ), 'yyyy-MM-dd');
          const onApprovedLeave = isUserOnApprovedLeave(userObj?.leaveRequests, attDateStr);

          let statusText: string = att.status;
          if (att.status === 'ABSENT') {
            statusText = onApprovedLeave ? 'ON LEAVE' : 'OFF DAY';
          } else if (!att.checkOutTime) {
            statusText = 'Currently Not Checked Out';
          } else {
            statusText = 'COMPLETED';
          }

          return {
            employee: `${att.user.firstName || ''} ${att.user.lastName || ''}`.trim() || att.user.email,
            location: att.location?.name || 'N/A',
            checkIn: att.status === 'ABSENT' ? format(toZonedTime(att.checkInTime, SRI_LANKA_TZ), 'MMM d, yyyy') : formatToSriLankanTime(att.checkInTime),
            checkOut: att.status === 'ABSENT' ? '-' : !att.checkOutTime ? 'Currently Not Checked Out' : formatToSriLankanTime(att.checkOutTime),
            duration: (att.status === 'ABSENT' || !att.checkOutTime) ? '-' : calculateDuration(att.checkInTime, att.checkOutTime),
            status: statusText,
            notes: att.notes || '',
            isPresentRecord: att.status !== 'ABSENT',
          };
        });
      }

      const totalDays = daysInRange.length;
      const presentCount = status === 'ABSENT' || status === 'ON LEAVE' || status === 'OFF DAY'
        ? 0
        : new Set(
            baseAttendances
              .filter(a => a.status !== 'ABSENT')
              .map(a => format(toZonedTime(a.checkInTime, SRI_LANKA_TZ), 'yyyy-MM-dd'))
          ).size;
      const lateCount = finalAttendances.filter(a => a.status === 'LATE').length;
      const absentCount = status === 'ABSENT' || status === 'ON LEAVE' || status === 'OFF DAY'
        ? finalAttendances.length
        : Math.max(0, totalDays - presentCount);

      const pdfData = {
        reportTitle,
        employeeInfo: {
          name: userId && userId !== 'ALL' ? finalAttendances[0]?.employee || 'N/A' : 'All Employees',
          email: 'N/A',
          department: 'N/A',
          position: 'N/A',
        },
        summary: {
          totalDays,
          presentDays: presentCount,
          lateDays: lateCount,
          absentDays: absentCount,
          attendanceRate: totalDays > 0 ? ((presentCount / totalDays) * 100).toFixed(2) : '0',
          punctualityRate: presentCount > 0 ? (((presentCount - lateCount) / presentCount) * 100).toFixed(2) : '0',
          averageWorkHours: 'N/A',
          period: `${formatToSriLankanTime(parsedStartDate, 'MMM d, yyyy')} to ${formatToSriLankanTime(parsedEndDate, 'MMM d, yyyy')}`,
        },
        attendances: includeDetails ? finalAttendances : [],
        approvedLeavesByEmployee,
        generatedAt: formatToSriLankanTime(new Date()),
        generatedBy: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email,
        companyInfo: {
          name: 'Employee Management System',
          contact: 'shellogtsf@gmail.com',
          website: 'www.hrsystemsolutions.site'
        }
      };

      return res.status(200).json(pdfData);
    } catch (error: any) {
      console.error('PDF Generation Error:', error);
      return res.status(500).json({ error: 'Failed to generate PDF data', message: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

function calculateDuration(checkIn: string | Date, checkOut: string | Date): string {
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hrs}h ${mins}m`;
}
