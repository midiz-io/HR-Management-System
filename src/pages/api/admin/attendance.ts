import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { eachDayOfInterval, format } from 'date-fns';
import { getSectionalHeadContext } from '@/lib/sectionalHeadDb';

const SRI_LANKA_TZ = 'Asia/Colombo';
const VALID_DB_ATTENDANCE_STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'OVERTIME'];

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

  let context: any = null;
  try {
    context = await getSectionalHeadContext(user.id);
  } catch (ctxErr) {
    console.error('Error getting sectional head context:', ctxErr);
  }

  let userData: any = context?.user || null;
  if (!userData) {
    try {
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, email, "firstName", "lastName", role::text as role, department, "departmentId", position FROM "User" WHERE id = $1::uuid LIMIT 1`,
        user.id
      );
      userData = rows && rows[0] ? rows[0] : null;
    } catch {
      userData = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          department: true,
          departmentId: true,
          position: true,
        },
      });
    }
  }

  const isSuperAdminOrHR =
    context?.isSuperAdminOrHR ||
    (userData?.role as any) === 'SUPER_ADMIN' ||
    (userData?.department && String(userData.department).toUpperCase() === 'HR');
  const isGlobalAdmin =
    (userData?.role as any) === 'ADMIN' ||
    (userData?.role as any) === 'MANAGER' ||
    isSuperAdminOrHR;
  const isSectionalHead = (userData?.role as any) === 'SECTIONAL_HEAD' || context?.isSectionalHead;

  if (!userData || (!isGlobalAdmin && !isSectionalHead)) {
    return res.status(403).json({ error: 'Forbidden: Admin or Sectional Head access required' });
  }

  // Handle GET request - Get all attendance records
  if (req.method === 'GET') {
    try {
      const { userId, locationId, status, startDate, endDate, department } = req.query;

      let where: any = {};

      if (userId && typeof userId === 'string' && userId !== 'ALL') {
        where.userId = userId;
      }

      if (locationId && typeof locationId === 'string' && locationId !== 'ALL') {
        where.locationId = locationId;
      }

      if (status && typeof status === 'string') {
        if (status === 'ACTIVE' || status === 'IN PROGRESS' || status === 'Currently Not Checked Out' || status === 'CURRENTLY NOT CHECKED OUT') {
          where.checkOutTime = null;
          where.status = { not: 'ABSENT' };
        } else if (status === 'COMPLETED' || status === 'PRESENT') {
          where.checkOutTime = { not: null };
          where.status = { not: 'ABSENT' };
        } else if (
          status !== 'ALL' &&
          status !== 'ABSENT' &&
          status !== 'ON LEAVE' &&
          status !== 'OFF DAY' &&
          VALID_DB_ATTENDANCE_STATUSES.includes(status)
        ) {
          where.status = status;
        }
      }

      let userScopeFilter: any = {};
      if (isSectionalHead && !isGlobalAdmin && context?.managedDepartment) {
        userScopeFilter = {
          OR: [
            { departmentId: context.managedDepartment.id },
            { department: context.managedDepartment.name },
          ],
        };
        where.user = { ...where.user, ...userScopeFilter };
      } else if (department && typeof department === 'string' && department !== 'ALL') {
        let deptName = department;
        try {
          const deptObj = await prisma.department.findUnique({ where: { id: department } });
          if (deptObj) deptName = deptObj.name;
        } catch {
          // Ignore if department is already a name
        }
        userScopeFilter = {
          OR: [
            { departmentId: department },
            { department: deptName },
          ],
        };
        where.user = { ...where.user, ...userScopeFilter };
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

      const parsedStartDate = startDate && typeof startDate === 'string'
        ? parseDateSafely(startDate, '00:00:00')
        : undefined;
      const parsedEndDate = endDate && typeof endDate === 'string'
        ? parseDateSafely(endDate, '23:59:59')
        : undefined;

      if (parsedStartDate) {
        where.checkInTime = { ...where.checkInTime, gte: parsedStartDate };
      }
      if (parsedEndDate) {
        where.checkInTime = { ...where.checkInTime, lte: parsedEndDate };
      }

      const attendances = await prisma.attendance.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              department: true,
              position: true,
              rosters: {
                include: {
                  workShift: true,
                },
              },
            },
          },
          location: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { checkInTime: 'desc' },
      });

      // Fetch approved leaves separately in a single fast query and index by userId
      const leavesByUserId = new Map<string, any[]>();
      try {
        const approvedLeaves = await prisma.leaveRequest.findMany({
          where: { status: 'APPROVED' },
          select: {
            id: true,
            userId: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        });
        for (const lv of approvedLeaves) {
          const list = leavesByUserId.get(lv.userId) || [];
          list.push(lv);
          leavesByUserId.set(lv.userId, list);
        }
      } catch (leaveErr) {
        console.error('Error fetching approved leaves:', leaveErr);
      }

      // Map statuses:
      // - ABSENT -> "ON LEAVE" (if approved leave exists) or "OFF DAY"
      // - Checked In without Check Out -> "IN PROGRESS"
      // - Checked In and Checked Out -> "COMPLETED"
      const mappedAttendances: any[] = attendances.map((att) => {
        if (att.status === 'ABSENT') {
          const attDateStr = format(toZonedTime(att.checkInTime, SRI_LANKA_TZ), 'yyyy-MM-dd');
          const userLeaves = leavesByUserId.get(att.userId);
          const onApprovedLeave = isUserOnApprovedLeave(userLeaves, attDateStr);
          return {
            ...att,
            originalStatus: att.status,
            status: onApprovedLeave ? 'ON LEAVE' : 'OFF DAY',
          };
        }
        return {
          ...att,
          originalStatus: att.status,
          status: att.checkOutTime ? 'COMPLETED' : 'Currently Not Checked Out',
        };
      });

      // Generate daily "ON LEAVE" / "OFF DAY" records for employees who did not check in
      const shouldIncludeAbsentRows =
        !status ||
        status === 'ALL' ||
        status === 'ABSENT' ||
        status === 'ON LEAVE' ||
        status === 'OFF DAY';

      if (shouldIncludeAbsentRows) {
        try {
          const nowSL = toZonedTime(new Date(), SRI_LANKA_TZ);
          const todayStrSL = format(nowSL, 'yyyy-MM-dd');

          const rangeStartSL = parsedStartDate
            ? toZonedTime(parsedStartDate, SRI_LANKA_TZ)
            : nowSL;
          const rawRangeEndSL = parsedEndDate
            ? toZonedTime(parsedEndDate, SRI_LANKA_TZ)
            : nowSL;

          const effectiveEndSL = format(rawRangeEndSL, 'yyyy-MM-dd') > todayStrSL ? nowSL : rawRangeEndSL;

          if (format(rangeStartSL, 'yyyy-MM-dd') <= format(effectiveEndSL, 'yyyy-MM-dd')) {
            const allDays = eachDayOfInterval({
              start: rangeStartSL,
              end: effectiveEndSL,
            });
            const daysToProcess = allDays.slice(-31);

            const usersFilter: any = {
              isResigned: false,
              role: { notIn: ['SUPER_ADMIN', 'ADMIN'] },
              ...userScopeFilter,
            };
            if (userId && typeof userId === 'string' && userId !== 'ALL') {
              usersFilter.id = userId;
            }
            if (locationId && typeof locationId === 'string' && locationId !== 'ALL') {
              usersFilter.locationId = locationId;
            }

            const allEmployees = await prisma.user.findMany({
              where: usersFilter,
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                department: true,
                position: true,
                location: {
                  select: { id: true, name: true },
                },
                rosters: {
                  include: { workShift: true },
                },
              },
            });

            const existingUserDaySet = new Set<string>();
            mappedAttendances.forEach((att) => {
              const dStr = format(toZonedTime(new Date(att.checkInTime), SRI_LANKA_TZ), 'yyyy-MM-dd');
              existingUserDaySet.add(`${att.userId}_${dStr}`);
            });

            for (const day of daysToProcess) {
              const dateStr = format(day, 'yyyy-MM-dd');
              const virtualCheckInUTC = fromZonedTime(`${dateStr} 09:00:00`, SRI_LANKA_TZ).toISOString();

              for (const emp of allEmployees) {
                const key = `${emp.id}_${dateStr}`;
                if (existingUserDaySet.has(key)) continue;

                const userLeaves = leavesByUserId.get(emp.id);
                const onApprovedLeave = isUserOnApprovedLeave(userLeaves, dateStr);
                const derivedStatus = onApprovedLeave ? 'ON LEAVE' : 'OFF DAY';

                mappedAttendances.push({
                  id: `virtual-${emp.id}-${dateStr}`,
                  userId: emp.id,
                  user: {
                    id: emp.id,
                    email: emp.email,
                    firstName: emp.firstName,
                    lastName: emp.lastName,
                    department: emp.department,
                    position: emp.position,
                    rosters: emp.rosters,
                  },
                  locationId: emp.location?.id || 'unassigned',
                  location: {
                    id: emp.location?.id || 'unassigned',
                    name: emp.location?.name || 'Not Assigned',
                  },
                  checkInTime: virtualCheckInUTC,
                  checkOutTime: null,
                  originalStatus: 'ABSENT',
                  status: derivedStatus,
                  notes: onApprovedLeave ? 'Approved Leave Request' : 'Absent (No Approved Leave)',
                  createdAt: virtualCheckInUTC,
                  isVirtualAbsent: true,
                });
              }
            }
          }
        } catch (virtualErr) {
          console.error('Error generating virtual absent rows:', virtualErr);
        }
      }

      // Apply final status filter if specialized
      const filteredResult = mappedAttendances
        .filter((att) => {
          if (!status || status === 'ALL') return true;
          if (status === 'ACTIVE' || status === 'IN PROGRESS' || status === 'Currently Not Checked Out' || status === 'CURRENTLY NOT CHECKED OUT') {
            return att.status === 'Currently Not Checked Out' || att.status === 'IN PROGRESS';
          }
          if (status === 'COMPLETED' || status === 'PRESENT') {
            return att.status === 'COMPLETED';
          }
          if (status === 'ABSENT') {
            return att.status === 'ON LEAVE' || att.status === 'OFF DAY' || att.status === 'ABSENT';
          }
          if (status === 'LATE' || status === 'OVERTIME') {
            return att.originalStatus === status || att.status === status;
          }
          return att.status === status;
        })
        .sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());

      return res.status(200).json(filteredResult);
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      return res.status(500).json({ error: 'Failed to fetch attendance records' });
    }
  }

  // Handle POST request - Create a manual attendance record
  if (req.method === 'POST') {
    try {
      const {
        userId,
        locationId,
        checkInTime,
        checkOutTime,
        status,
        notes
      } = req.body;

      if (!userId || !locationId || !checkInTime) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      const location = await prisma.location.findUnique({
        where: { id: locationId },
        select: { id: true },
      });

      if (!location) {
        return res.status(404).json({ error: 'Location not found' });
      }

      const dbStatus = status && VALID_DB_ATTENDANCE_STATUSES.includes(status) ? status : 'PRESENT';

      const attendance = await prisma.attendance.create({
        data: {
          userId,
          locationId,
          checkInTime: new Date(checkInTime),
          checkOutTime: checkOutTime ? new Date(checkOutTime) : null,
          checkInLatitude: 0,
          checkInLongitude: 0,
          checkOutLatitude: checkOutTime ? 0 : null,
          checkOutLongitude: checkOutTime ? 0 : null,
          status: dbStatus as any,
          notes,
        },
      });

      return res.status(201).json({
        ...attendance,
        originalStatus: attendance.status,
        status: attendance.status === 'ABSENT'
          ? 'OFF DAY'
          : attendance.checkOutTime
            ? 'COMPLETED'
            : 'Currently Not Checked Out',
      });
    } catch (error) {
      console.error('Error creating attendance record:', error);
      return res.status(500).json({ error: 'Failed to create attendance record' });
    }
  }

  // Handle PUT/PATCH request - Update an existing attendance record
  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      const {
        id,
        checkInTime,
        checkOutTime,
        status,
        notes
      } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Attendance ID is required' });
      }

      const existingRecord = await prisma.attendance.findUnique({
        where: { id },
      });

      if (!existingRecord) {
        return res.status(404).json({ error: 'Attendance record not found' });
      }

      const updateData: any = {};

      if (checkInTime !== undefined) {
        updateData.checkInTime = new Date(checkInTime);
      }

      if (checkOutTime !== undefined) {
        updateData.checkOutTime = checkOutTime ? new Date(checkOutTime) : null;
      }

      if (status !== undefined && VALID_DB_ATTENDANCE_STATUSES.includes(status)) {
        updateData.status = status;
      }

      if (notes !== undefined) {
        updateData.notes = notes;
      }

      const updatedAttendance = await prisma.attendance.update({
        where: { id },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              rosters: {
                include: {
                  workShift: true,
                },
              },
            },
          },
          location: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return res.status(200).json({
        ...updatedAttendance,
        originalStatus: updatedAttendance.status,
        status: updatedAttendance.status === 'ABSENT'
          ? 'OFF DAY'
          : updatedAttendance.checkOutTime
            ? 'COMPLETED'
            : 'Currently Not Checked Out',
      });
    } catch (error: any) {
      console.error('Error updating attendance record:', error);
      return res.status(500).json({ error: 'Failed to update attendance record', details: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
