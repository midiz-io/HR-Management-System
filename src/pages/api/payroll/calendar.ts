import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import {
  buildPayrollMonthCalendar,
  calculateOffAndHolidayPay,
  getMonthBounds,
} from '@/util/payroll-days';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = req.headers.authorization;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const requester = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!requester || requester.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Super Admin access required' });
    }

    const targetUserId = req.query.userId as string;
    const month = parseInt((req.query.month as string) || String(new Date().getMonth() + 1), 10);
    const year = parseInt((req.query.year as string) || String(new Date().getFullYear()), 10);

    if (!targetUserId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const config = await prisma.salaryConfig.findUnique({
      where: { userId: targetUserId },
    });

    if (!config) {
      return res.status(404).json({ error: 'Salary configuration not found' });
    }

    const employee = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        rosters: { include: { workShift: true } },
      },
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const { start, end } = getMonthBounds(month, year);
    const attendances = await prisma.attendance.findMany({
      where: {
        userId: targetUserId,
        checkInTime: { gte: start, lte: end },
      },
      select: { checkInTime: true },
      orderBy: { checkInTime: 'asc' },
    });

    const checkIns = attendances.map((a) => a.checkInTime);
    const calendar = buildPayrollMonthCalendar(month, year, employee.rosters, checkIns);
    const pay = calculateOffAndHolidayPay(
      config.basicSalary,
      employee.rosters,
      checkIns,
      year,
      config.offDaysCount ?? 0,
      config.incentive ?? 0
    );

    return res.status(200).json({
      employee: {
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
      },
      month,
      year,
      calendar,
      payments: {
        dailyRate: pay.dailyRate,
        offDayPayment: pay.offDayPayment,
        holidayPayment: pay.holidayPayment,
        offDaysCount: config.offDaysCount ?? 0,
        offDaysWorked: pay.offDaysWorked,
        holidaysWorked: pay.holidaysWorked,
        incentive: config.incentive ?? 0,
        calculatedIncentive: pay.calculatedIncentive,
        performanceIncentive: Math.max(0, (config.incentive ?? 0) - pay.calculatedIncentive),
        actuallyWorkedDays: pay.actuallyWorkedDays,
        expectedWorkingDays: pay.expectedWorkingDays,
      },
    });
  } catch (error) {
    console.error('Error fetching payroll calendar:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
