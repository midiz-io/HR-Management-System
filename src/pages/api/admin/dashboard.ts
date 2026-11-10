import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { calculateLateness } from '@/util/attendance-logic';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const userId = req.headers.authorization;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      let userData = await prisma.user.findUnique({
        where: { id: userId as string },
        select: { id: true, role: true },
      });

      if (!userData) {
        try {
          const authEmailRows: any[] = await prisma.$queryRaw`SELECT email FROM auth.users WHERE id = ${userId}::uuid`;
          if (authEmailRows && authEmailRows.length > 0 && authEmailRows[0].email) {
            userData = await prisma.user.findFirst({
              where: { email: { equals: authEmailRows[0].email.trim(), mode: 'insensitive' } },
              select: { id: true, role: true },
            });
          }
        } catch {
          // Ignore fallback error
        }
      }

      const role = userData?.role as string | undefined;
      if (!userData || (role !== 'ADMIN' && role !== 'SUPER_ADMIN' && role !== 'SECTIONAL_HEAD')) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      const now = new Date();
      const sriLankanDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
      const dateMatch = sriLankanDateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);

      if (!dateMatch) {
        throw new Error('Failed to parse Sri Lankan date: ' + sriLankanDateStr);
      }

      const [, yearStr, monthStr, dayStr] = dateMatch;
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const day = parseInt(dayStr, 10);

      const todayStartUTC = new Date(Date.UTC(year, month - 1, day - 1, 18, 30, 0, 0));
      const todayEndUTC = new Date(Date.UTC(year, month - 1, day, 18, 29, 59, 999));

      const dayOfWeek = now.getDay();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const todayName = dayNames[dayOfWeek];

      // Execute all dashboard queries in parallel for ~5x faster response time
      const [
        totalUsers,
        totalLocations,
        activeWorkShifts,
        activeRosters,
        todayAttendances,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.location.count(),
        prisma.workShift.findMany({
          where: {
            days: {
              has: todayName,
            },
          },
          select: {
            employees: {
              select: { id: true },
            },
          },
        }),
        prisma.roster.findMany({
          where: {
            startDate: { lte: todayEndUTC },
            OR: [
              { endDate: null },
              { endDate: { gte: todayStartUTC } },
            ],
            workShift: {
              days: {
                has: todayName,
              },
            },
          },
          select: {
            userId: true,
          },
        }),
        prisma.attendance.findMany({
          where: {
            checkInTime: {
              gte: todayStartUTC,
              lte: todayEndUTC,
            },
          },
          orderBy: {
            checkInTime: 'desc',
          },
          include: {
            location: {
              select: {
                name: true,
              },
            },
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                rosters: {
                  where: {
                    AND: [
                      { startDate: { lte: todayEndUTC } },
                      {
                        OR: [
                          { endDate: { gte: todayStartUTC } },
                          { endDate: null },
                        ],
                      },
                    ],
                  },
                  include: {
                    workShift: true,
                  },
                },
              },
            },
          },
        }),
      ]);

      const employeesWithShifts = new Set<string>();
      activeWorkShifts.forEach(shift => {
        shift.employees.forEach(employee => {
          employeesWithShifts.add(employee.id);
        });
      });

      activeRosters.forEach(roster => {
        employeesWithShifts.add(roster.userId);
      });

      const expectedEmployeeCount = employeesWithShifts.size > 0 ? employeesWithShifts.size : totalUsers;

      let presentCount = 0;
      let lateCount = 0;

      const userTodayAttendance = new Map<string, any>();
      todayAttendances.forEach(att => {
        if (!userTodayAttendance.has(att.userId)) {
          userTodayAttendance.set(att.userId, att);
        }
      });

      userTodayAttendance.forEach((att) => {
        const result = calculateLateness(att.checkInTime, att.user as any);
        if (result.isLate) {
          lateCount++;
        } else {
          presentCount++;
        }
      });

      const activeUsersCount = userTodayAttendance.size;
      const absentCount = expectedEmployeeCount - (presentCount + lateCount);
      const recentCheckIns = todayAttendances.slice(0, 5);

      const dashboardStats = {
        totalUsers,
        activeUsers: activeUsersCount,
        totalLocations,
        todayAttendance: {
          present: presentCount,
          late: lateCount,
          absent: absentCount > 0 ? absentCount : 0,
          total: totalUsers,
        },
        recentCheckIns: recentCheckIns.map(checkIn => ({
          id: checkIn.id,
          userName: checkIn.user.firstName && checkIn.user.lastName
            ? `${checkIn.user.firstName} ${checkIn.user.lastName}`
            : checkIn.user.email,
          locationName: checkIn.location.name,
          time: checkIn.checkInTime.toISOString(),
        })),
      };

      return res.status(200).json(dashboardStats);
    } catch (error: any) {
      console.error('Error fetching dashboard statistics:', error);
      return res.status(500).json({
        error: 'Failed to fetch dashboard statistics',
        details: error?.message || 'Unknown error'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
