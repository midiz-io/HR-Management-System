import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const SRI_LANKA_TZ = 'Asia/Colombo';

// Helper function to format time to Sri Lankan timezone
const formatToSriLankanTime = (date: Date | string, formatString: string = 'yyyy-MM-dd HH:mm:ss'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const zonedDate = toZonedTime(dateObj, SRI_LANKA_TZ);
  return format(zonedDate, formatString);
};

// Helper to parse time string (HH:mm) and convert to minutes since midnight
const parseTimeToMinutes = (timeString: string): number => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

// Helper to format minutes to HH:mm
const formatMinutesToTime = (minutes: number): string => {
  const hrs = Math.floor(Math.abs(minutes) / 60);
  const mins = Math.abs(minutes) % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify authentication
  const supabase = createClient(req, res);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userData = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!userData) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Only admins, super admins and managers can view late attendance reports
  if ((userData.role as any) !== 'ADMIN' && (userData.role as any) !== 'SUPER_ADMIN' && userData.role !== 'MANAGER') {
    return res.status(403).json({ error: 'Access denied. Admin or Manager role required.' });
  }

  if (req.method === 'GET') {
    try {
      const { startDate, endDate, department, userId, locationId } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required' });
      }

      // Parse dates in Sri Lanka timezone and convert to UTC for database queries
      // This ensures consistent behavior on both localhost and Vercel (UTC servers)
      // Parse dates safely
      const parseDateSafely = (dateInput: any, timeSuffix: string) => {
        if (!dateInput) return undefined;
        let d = new Date(dateInput);
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

      // Build where clause - fetch ALL attendances, not just LATE ones
      const whereClause: any = {
        checkInTime: {
          gte: parsedStartDate,
          lte: parsedEndDate,
        },
        ...(locationId && locationId !== 'ALL' ? {
          locationId: locationId as string,
        } : {}),
      };

      // Build a single user filter (relation filter) so department/userId combine correctly
      const userFilter: any = {};
      if (department && department !== 'ALL') {
        userFilter.department = department as string;
      }
      if (userId && userId !== 'ALL') {
        userFilter.id = userId as string;
      }
      if (Object.keys(userFilter).length > 0) {
        whereClause.user = userFilter;
      }

      // Fetch all attendances in the date range
      const allAttendances = await prisma.attendance.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              department: true,
              position: true,
              rosters: {
                where: {
                  AND: [
                    { startDate: { lte: parsedEndDate } },
                    {
                      OR: [
                        { endDate: { gte: parsedStartDate } },
                        { endDate: null }
                      ]
                    }
                  ]
                },
                include: {
                  workShift: true,
                },
                orderBy: {
                  startDate: 'desc',
                },
              },
            },
          },
          location: true,
        },
        orderBy: [
          { checkInTime: 'asc' },
        ],
      });

      // Helper to get day name from date
      const getDayName = (date: Date): string => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[date.getDay()];
      };

      const finalData: any[] = [];
      allAttendances.forEach((att) => {
        const checkInDateUTC = new Date(att.checkInTime);
        const checkInDate = toZonedTime(checkInDateUTC, SRI_LANKA_TZ);
        const hours = parseInt(format(checkInDate, 'HH'), 10);
        const minutes = parseInt(format(checkInDate, 'mm'), 10);
        const checkInTimeMinutes = hours * 60 + minutes;
        const dayName = getDayName(checkInDate);

        // Find applicable roster for this specific check-in date
        const checkInDateOnlyStr = format(checkInDate, 'yyyy-MM-dd');
        const applicableRoster = att.user.rosters
          .filter((roster: any) => {
            const rosterStartStr = format(toZonedTime(new Date(roster.startDate), SRI_LANKA_TZ), 'yyyy-MM-dd');
            const rosterEndStr = roster.endDate
              ? format(toZonedTime(new Date(roster.endDate), SRI_LANKA_TZ), 'yyyy-MM-dd')
              : '2099-12-31';
            return checkInDateOnlyStr >= rosterStartStr && checkInDateOnlyStr <= rosterEndStr;
          })
          .sort((a: any, b: any) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];

        let status = 'PRESENT';
        let lateMinutes = 0;
        let rosterStartTime = null;

        if (applicableRoster?.workShift) {
          const workShiftDays = applicableRoster.workShift.days || [];
          if (workShiftDays.includes(dayName)) {
            rosterStartTime = applicableRoster.workShift.startTime;
            const expectedStartMinutes = parseTimeToMinutes(rosterStartTime);
            const diffMinutes = checkInTimeMinutes - expectedStartMinutes;

            if (diffMinutes > 0) {
              lateMinutes = diffMinutes;
              status = 'LATE';
            }
          }
        } else {
          status = 'NO ROSTER';
        }

        const employeeName = `${att.user.firstName || ''} ${att.user.lastName || ''}`.trim() || att.user.email;

        finalData.push({
          id: att.id,
          employeeName,
          email: att.user.email,
          department: att.user.department || 'N/A',
          position: att.user.position || 'N/A',
          date: formatToSriLankanTime(att.checkInTime, 'yyyy-MM-dd'),
          checkInTime: formatToSriLankanTime(att.checkInTime, 'HH:mm:ss'),
          rosterStartTime: rosterStartTime || 'Not Set',
          lateMinutes: formatMinutesToTime(lateMinutes),
          lateMinutesValue: lateMinutes,
          location: att.location.name,
          locationId: att.locationId,
          notes: att.notes || '',
          status: status,
        });
      });

      // Calculate summary statistics
      const totalRecords = finalData.length;
      const lateRecords = finalData.filter(a => a.status === 'LATE');
      const totalLateAttendances = lateRecords.length;
      const uniqueEmployees = new Set(finalData.map(a => a.email)).size;
      const totalLateMinutes = lateRecords.reduce((sum, a) => sum + a.lateMinutesValue, 0);
      const averageLateMinutes = totalLateAttendances > 0
        ? Math.round(totalLateMinutes / totalLateAttendances)
        : 0;

      // Group by employee for summary
      const employeeSummary = finalData.reduce((acc: any, curr: any) => {
        if (!acc[curr.email]) {
          acc[curr.email] = {
            employeeName: curr.employeeName,
            location: curr.location,
            lateCount: 0,
            totalLateMinutes: 0,
            totalCount: 0,
          };
        }
        acc[curr.email].totalCount++;
        if (curr.status === 'LATE') {
          acc[curr.email].lateCount++;
          acc[curr.email].totalLateMinutes += curr.lateMinutesValue;
        }
        return acc;
      }, {});

      const topLateEmployees = Object.values(employeeSummary)
        .sort((a: any, b: any) => b.lateCount - a.lateCount)
        .slice(0, 5);

      return res.status(200).json({
        success: true,
        data: finalData,
        summary: {
          totalRecords,
          totalLateAttendances,
          uniqueEmployees,
          totalLateMinutes: formatMinutesToTime(totalLateMinutes),
          averageLateMinutes: formatMinutesToTime(averageLateMinutes),
          topLateEmployees,
        },
        period: {
          startDate: formatToSriLankanTime(parsedStartDate, 'MMM d, yyyy'),
          endDate: formatToSriLankanTime(parsedEndDate, 'MMM d, yyyy'),
        },
      });
    } catch (error) {
      console.error('Error fetching late attendance report:', error);
      return res.status(500).json({ error: 'Failed to fetch late attendance report' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
