import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import {
  calculateOffAndHolidayPay,
  getMonthBounds,
} from '@/util/payroll-days';
import { calculatePayroll } from '@/util/payroll';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = req.headers.authorization;
  console.log('Payroll Config Request:', { method: req.method, userId });
  console.log('Available Prisma Models:', Object.keys(prisma).filter(k => !k.startsWith('_')));

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: Missing Authorization header' });
  }

  if (!prisma.user) {
    console.error('Prisma Error: prisma.user is undefined. Prisma client might need regeneration.');
    return res.status(500).json({ error: 'Prisma client error: user model not found' });
  }

  try {
    const requester = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!requester || (requester.role !== 'SUPER_ADMIN' && requester.role !== 'ADMIN')) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
  } catch (error: any) {
    console.error('Auth Check Error:', error);
    const msg = error?.message || 'Authentication check failed';
    if (error?.code === 'P1001') {
      return res.status(503).json({
        error: 'Database unreachable. Check your connection / Supabase project.',
        details: msg,
      });
    }
    return res.status(500).json({ error: 'Authentication check failed', details: msg });
  }

  if (!prisma.salaryConfig) {
    console.error('Prisma Error: prisma.salaryConfig is undefined. Prisma client needs regeneration.');
    return res.status(500).json({ error: 'Prisma client error: salaryConfig model not found. Please run npx prisma generate.' });
  }

  if (req.method === 'GET') {
    try {
      const now = new Date();
      const month = parseInt((req.query.month as string) || String(now.getMonth() + 1), 10);
      const year = parseInt((req.query.year as string) || String(now.getFullYear()), 10);
      const { start: startOfMonth, end: endOfMonth } = getMonthBounds(month, year);

      const configs = await prisma.salaryConfig.findMany({
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              position: true,
              department: true,
              assignedDepartment: {
                select: { name: true }
              },
              location: {
                select: { name: true }
              },
              rosters: {
                include: { workShift: true },
              },
            },
          },
        },
      });

      const userIds = configs.map((c) => c.userId);
      const attendances = userIds.length
        ? await prisma.attendance.findMany({
            where: {
              userId: { in: userIds },
              checkInTime: { gte: startOfMonth, lte: endOfMonth },
            },
            select: { userId: true, checkInTime: true, status: true },
          })
        : [];

      const otRequests = userIds.length
        ? await prisma.oTRequest.findMany({
            where: {
              userId: { in: userIds },
              status: 'APPROVED',
              date: { gte: startOfMonth, lte: endOfMonth },
            },
            select: { userId: true, totalHours: true },
          })
        : [];

      const attendanceByUser = new Map<string, Date[]>();
      const lateCountByUser = new Map<string, number>();
      for (const att of attendances) {
        const list = attendanceByUser.get(att.userId) ?? [];
        list.push(att.checkInTime);
        attendanceByUser.set(att.userId, list);

        if (att.status === 'LATE') {
          lateCountByUser.set(att.userId, (lateCountByUser.get(att.userId) ?? 0) + 1);
        }
      }

      const otHoursByUser = new Map<string, number>();
      for (const req of otRequests) {
        otHoursByUser.set(req.userId, (otHoursByUser.get(req.userId) ?? 0) + req.totalHours);
      }

      const existingPayrolls = userIds.length
        ? await prisma.payroll.findMany({
            where: {
              month,
              year,
              userId: { in: userIds },
            },
          })
        : [];

      const payrollMap = new Map<string, any>();
      for (const p of existingPayrolls) {
        payrollMap.set(p.userId, p);
      }

      const enriched = configs.map((config) => {
        const { user, ...rest } = config;
        const { rosters, ...userFields } = user;
        const pay = calculateOffAndHolidayPay(
          config.basicSalary,
          rosters,
          attendanceByUser.get(config.userId) ?? [],
          year,
          config.offDaysCount ?? 0,
          config.incentive ?? 0
        );

        const existingPayroll = payrollMap.get(config.userId);

        if (existingPayroll) {
          const epfBasis = config.basicSalary + (existingPayroll.offDayPay ?? 0) + (existingPayroll.holidayPay ?? 0);
          const epfEmployer = epfBasis * ((config.epfEmployer ?? 12) / 100);
          const etfEmployer = epfBasis * ((config.etfEmployer ?? 3) / 100);

          const savedCalc = {
            basicSalary: existingPayroll.basicSalary,
            allowances: existingPayroll.allowances,
            otAllowance: existingPayroll.otAllowance ?? 0,
            otherAllowances: existingPayroll.otherAllowances ?? 0,
            offDayPay: existingPayroll.offDayPay ?? 0,
            holidayPay: existingPayroll.holidayPay ?? 0,
            otPay: existingPayroll.otPay ?? 0,
            otHours: (existingPayroll.otPay ?? 0) > 0 ? ((existingPayroll.otPay ?? 0) / (((config.basicSalary + (config.incentive || 0)) / 240) * 1.5)) : 0,
            deductions: existingPayroll.deductions ?? 0,
            salaryAdvance: existingPayroll.salaryAdvance ?? 0,
            loanDeduction: existingPayroll.loanDeduction ?? 0,
            pendingBills: existingPayroll.pendingBills ?? 0,
            attendanceBonus: existingPayroll.attendanceBonus ?? 0,
            lateDeductions: 0,
            incentive: existingPayroll.incentive ?? 0,
            performanceIncentive: existingPayroll.performanceIncentive ?? 0,
            totalIncentive: (existingPayroll.incentive ?? 0) + (existingPayroll.performanceIncentive ?? 0) + (existingPayroll.otPay ?? 0),
            epfEmployee: existingPayroll.epfAmount ?? 0,
            epfEmployer,
            etfEmployer,
            grossSalary: existingPayroll.basicSalary + (existingPayroll.offDayPay ?? 0) + (existingPayroll.holidayPay ?? 0) + (existingPayroll.incentive ?? 0) + (existingPayroll.performanceIncentive ?? 0) + (existingPayroll.otPay ?? 0) + existingPayroll.allowances + (existingPayroll.attendanceBonus ?? 0),
            netSalary: existingPayroll.netSalary ?? 0,
          };

          return {
            ...rest,
            user: userFields,
            offDayPayment: existingPayroll.offDayPay ?? 0,
            holidayPayment: existingPayroll.holidayPay ?? 0,
            offDaysWorked: pay.offDaysWorked,
            offDaysCount: config.offDaysCount ?? 0,
            holidaysWorked: pay.holidaysWorked,
            calculationMonth: month,
            calculationYear: year,
            calculatedIncentive: existingPayroll.incentive ?? 0,
            performanceIncentive: existingPayroll.performanceIncentive ?? 0,
            actuallyWorkedDays: pay.actuallyWorkedDays,
            expectedWorkingDays: pay.expectedWorkingDays,
            calc: savedCalc,
            isSaved: true,
            payrollStatus: existingPayroll.status,
          };
        }

        const userOtHours = otHoursByUser.get(config.userId) ?? 0;
        const lateCount = lateCountByUser.get(config.userId) ?? 0;
        const dailyRate = config.basicSalary / 30;
        const lateDeductions = 0; // Late deductions are disabled/removed
        const attendanceBonus = 0;

        const calc = calculatePayroll(
          config.basicSalary,
          config.allowances,
          config.deductions +
            (config.salaryAdvance || 0) +
            (config.loanDeduction || 0) +
            (config.pendingBills || 0),
          userOtHours,
          lateDeductions,
          attendanceBonus,
          config.epfEmployee,
          config.epfEmployer,
          config.etfEmployer,
          pay.offDayPayment,
          pay.holidayPayment,
          pay.calculatedIncentive,
          config.incentive ?? 0
        );

        return {
          ...rest,
          user: userFields,
          offDayPayment: pay.offDayPayment,
          holidayPayment: pay.holidayPayment,
          offDaysWorked: pay.offDaysWorked,
          offDaysCount: config.offDaysCount ?? 0,
          holidaysWorked: pay.holidaysWorked,
          calculationMonth: month,
          calculationYear: year,
          calculatedIncentive: pay.calculatedIncentive,
          performanceIncentive: calc.performanceIncentive,
          actuallyWorkedDays: pay.actuallyWorkedDays,
          expectedWorkingDays: pay.expectedWorkingDays,
          calc,
          isSaved: false,
        };
      });

      return res.status(200).json(enriched);
    } catch (error: any) {
      console.error('Error fetching salary configs:', error);
      return res.status(500).json({
        error: 'Failed to fetch salary configs',
        details: error?.message,
      });
    }
  }

  if (req.method === 'POST') {
    const {
      targetUserId,
      basicSalary,
      allowances,
      otAllowance,
      otherAllowances,
      deductions,
      salaryAdvance,
      loanDeduction,
      pendingBills,
      epfEmployee,
      epfEmployer,
      etfEmployer,
      bankName,
      accountNumber,
      branchName,
      offDaysCount,
      incentive,
    } = req.body;

    if (!targetUserId || basicSalary === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const config = await prisma.salaryConfig.upsert({
        where: { userId: targetUserId },
        update: {
          basicSalary: parseFloat(basicSalary),
          allowances: parseFloat(allowances || 0),
          otAllowance: parseFloat(otAllowance || 0),
          otherAllowances: parseFloat(otherAllowances || 0),
          deductions: parseFloat(deductions || 0),
          salaryAdvance: parseFloat(salaryAdvance || 0),
          loanDeduction: parseFloat(loanDeduction || 0),
          pendingBills: parseFloat(pendingBills || 0),
          incentive: parseFloat(incentive || 0),
          epfEmployee: epfEmployee !== undefined && epfEmployee !== null && epfEmployee !== '' ? parseFloat(epfEmployee) : 8,
          epfEmployer: epfEmployer !== undefined && epfEmployer !== null && epfEmployer !== '' ? parseFloat(epfEmployer) : 12,
          etfEmployer: etfEmployer !== undefined && etfEmployer !== null && etfEmployer !== '' ? parseFloat(etfEmployer) : 3,
          bankName,
          accountNumber,
          branchName,
          offDaysCount: Math.max(0, parseFloat(offDaysCount ?? 0) || 0),
        },
        create: {
          userId: targetUserId,
          basicSalary: parseFloat(basicSalary),
          offDaysCount: Math.max(0, parseFloat(offDaysCount ?? 0) || 0),
          allowances: parseFloat(allowances || 0),
          otAllowance: parseFloat(otAllowance || 0),
          otherAllowances: parseFloat(otherAllowances || 0),
          deductions: parseFloat(deductions || 0),
          salaryAdvance: parseFloat(salaryAdvance || 0),
          loanDeduction: parseFloat(loanDeduction || 0),
          pendingBills: parseFloat(pendingBills || 0),
          incentive: parseFloat(incentive || 0),
          epfEmployee: epfEmployee !== undefined && epfEmployee !== null && epfEmployee !== '' ? parseFloat(epfEmployee) : 8,
          epfEmployer: epfEmployer !== undefined && epfEmployer !== null && epfEmployer !== '' ? parseFloat(epfEmployer) : 12,
          etfEmployer: etfEmployer !== undefined && etfEmployer !== null && etfEmployer !== '' ? parseFloat(etfEmployer) : 3,
          bankName,
          accountNumber,
          branchName,
        },
      });
      return res.status(200).json(config);
    } catch (error: any) {
      console.error('Error updating salary config:', error);
      const details = error?.message || 'Unknown error';
      if (details.includes('OTStatus') || details.includes('does not exist')) {
        return res.status(500).json({
          error: 'Database schema out of date. Run: node scratch/fix_payroll_database.js',
          details,
        });
      }
      return res.status(500).json({ error: 'Failed to save salary config', details });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
