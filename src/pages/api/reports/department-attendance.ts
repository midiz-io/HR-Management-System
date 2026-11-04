import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';
import { calculateLateness } from '@/util/attendance-logic';

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
  const { data: { user: sessionUser } } = await supabase.auth.getUser();

  if (!sessionUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true },
  });

  if (!currentUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  try {
    const { date, departmentId } = req.query;

    const targetDateStr = typeof date === 'string' ? date : format(toZonedTime(new Date(), SRI_LANKA_TZ), 'yyyy-MM-dd');
    const parsedStartDate = fromZonedTime(`${targetDateStr} 00:00:00`, SRI_LANKA_TZ);
    const parsedEndDate = fromZonedTime(`${targetDateStr} 23:59:59`, SRI_LANKA_TZ);

    const departments = await prisma.department.findMany({
      include: {
        head: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            position: true,
          },
        },
        _count: {
          select: { employees: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    let deptFilter: any = {};
    if (departmentId && departmentId !== 'ALL') {
      const selectedDept = departments.find((d) => d.id === departmentId || d.name === departmentId);
      if (selectedDept) {
        deptFilter = {
          OR: [
            { departmentId: selectedDept.id },
            { department: selectedDept.name },
            { managedDepartment: { id: selectedDept.id } },
          ],
        };
      } else {
        deptFilter = { department: String(departmentId) };
      }
    }

    const users = await prisma.user.findMany({
      where: {
        isResigned: false,
        role: { notIn: ['SUPER_ADMIN', 'ADMIN'] },
        ...deptFilter,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        position: true,
        department: true,
        assignedDepartment: true,
        managedDepartment: true,
        rosters: {
          where: {
            AND: [
              { startDate: { lte: parsedEndDate } },
              { OR: [{ endDate: { gte: parsedStartDate } }, { endDate: null }] },
            ],
          },
          include: { workShift: true },
          orderBy: { startDate: 'desc' },
        },
        attendances: {
          where: {
            checkInTime: {
              gte: parsedStartDate,
              lte: parsedEndDate,
            },
          },
          include: { location: true },
          orderBy: { checkInTime: 'asc' },
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
          },
        },
      },
      orderBy: [{ firstName: 'asc' }, { email: 'asc' }],
    });

    const members = users.map((u) => {
      const isDeptHead = Boolean(u.managedDepartment) || u.position?.toLowerCase().includes('head');
      const rawAttendance = u.attendances && u.attendances.length > 0 ? u.attendances[0] : null;
      const attendance = rawAttendance && rawAttendance.status !== 'ABSENT' ? rawAttendance : null;
      const onLeave = isUserOnApprovedLeave(u.leaveRequests, targetDateStr);

      const latenessInfo = calculateLateness(attendance ? attendance.checkInTime : parsedStartDate, u);

      let status = 'OFF DAY';
      let statusLabel = 'OFF DAY';
      let lateMinutes = 0;
      let lateDurationFormatted = '0m';
      let isLate = false;

      if (attendance) {
        isLate = attendance.status === 'LATE' || latenessInfo.isLate;

        if (!attendance.checkOutTime) {
          status = 'Currently Not Checked Out';
          statusLabel = isLate ? 'Currently Not Checked Out (Late)' : 'Currently Not Checked Out';
        } else {
          status = 'COMPLETED';
          if (isLate) {
            statusLabel = 'COMPLETED (Late)';
          } else if ((attendance as any).isAutoCheckedOut) {
            statusLabel = 'COMPLETED (Auto Checked-Out)';
          } else {
            statusLabel = 'COMPLETED';
          }
        }

        if (isLate && latenessInfo.lateMinutes > 0) {
          lateMinutes = latenessInfo.lateMinutes;
          const hrs = Math.floor(lateMinutes / 60);
          const mins = lateMinutes % 60;
          lateDurationFormatted = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
        }
      } else if (onLeave) {
        status = 'ON LEAVE';
        statusLabel = 'ON LEAVE';
      } else {
        status = 'OFF DAY';
        statusLabel = 'OFF DAY';
      }

      return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        fullName: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
        email: u.email,
        position: u.position || (isDeptHead ? 'Department Head' : 'Employee'),
        role: isDeptHead ? 'SECTIONAL_HEAD' : 'EMPLOYEE',
        departmentName: u.assignedDepartment?.name || u.department || 'General',
        isDepartmentHead: isDeptHead,
        hasCheckedIn: Boolean(attendance),
        checkInTime: attendance ? format(toZonedTime(attendance.checkInTime, SRI_LANKA_TZ), 'hh:mm:ss a') : null,
        checkOutTime: attendance?.checkOutTime ? format(toZonedTime(attendance.checkOutTime, SRI_LANKA_TZ), 'hh:mm:ss a') : null,
        status,
        statusLabel,
        isLate,
        lateMinutes,
        lateDurationFormatted,
        rosterStartTime: latenessInfo.rosterStartTime || null,
        locationName: attendance?.location?.name || 'N/A',
      };
    });

    const totalStaff = members.length;
    const checkedInCount = members.filter((m) => m.hasCheckedIn).length;
    const onTimeCount = members.filter((m) => m.hasCheckedIn && !m.isLate).length;
    const lateCount = members.filter((m) => m.isLate).length;
    const absentCount = members.filter((m) => m.status === 'OFF DAY' || m.status === 'ON LEAVE').length;
    const onLeaveCount = members.filter((m) => m.status === 'ON LEAVE').length;
    const offDayCount = members.filter((m) => m.status === 'OFF DAY').length;

    return res.status(200).json({
      date: targetDateStr,
      departments,
      summary: {
        totalStaff,
        checkedInCount,
        onTimeCount,
        lateCount,
        absentCount,
        onLeaveCount,
        offDayCount,
      },
      members,
    });
  } catch (error: any) {
    console.error('Error fetching department attendance report:', error);
    return res.status(500).json({ error: 'Failed to fetch department attendance', details: error.message });
  }
}
