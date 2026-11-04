import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { eachDayOfInterval, format, getDay } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const SRI_LANKA_TZ = 'Asia/Colombo';
const WORKING_DAYS_PER_MONTH = 30;

interface SecurityRecord {
  faceVerified: boolean;
  pin: string;
  verifiedAt: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    let userId = req.headers.authorization as string | undefined;

    if (!userId) {
      const supabase = createClient(req, res);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id;
    }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const securityKey = `EMPLOYEE_SALARY_SECURITY_${userId}`;

    // Handle POST actions for Biometric Face Verification & PIN Verification
    if (req.method === 'POST') {
      const { action, pin } = req.body;

      if (action === 'COMPLETE_FACE_VERIFICATION') {
        // Generate a random 6-digit security PIN
        const generatedPin = String(Math.floor(100000 + Math.random() * 900000));
        const record: SecurityRecord = {
          faceVerified: true,
          pin: generatedPin,
          verifiedAt: new Date().toISOString(),
        };

        await prisma.systemSetting.upsert({
          where: { key: securityKey },
          update: { value: JSON.stringify(record) },
          create: { key: securityKey, value: JSON.stringify(record) },
        });

        return res.status(200).json({
          success: true,
          faceVerified: true,
          pin: generatedPin,
          verifiedAt: record.verifiedAt,
        });
      }

      if (action === 'VERIFY_PIN') {
        const setting = await prisma.systemSetting.findUnique({
          where: { key: securityKey },
        });

        if (!setting) {
          return res.status(400).json({
            error: 'Biometric face verification has not been completed yet.',
          });
        }

        let parsed: SecurityRecord | null = null;
        try {
          parsed = JSON.parse(setting.value);
        } catch {
          parsed = null;
        }

        if (!parsed || !parsed.faceVerified) {
          return res.status(400).json({
            error: 'Biometric face verification required.',
          });
        }

        if (String(pin || '').trim() !== String(parsed.pin).trim()) {
          return res.status(403).json({
            verified: false,
            error: 'Invalid Security PIN. Please check your downloaded PIN card.',
          });
        }

        return res.status(200).json({
          success: true,
          verified: true,
        });
      }

      if (action === 'RESET_BIOMETRICS') {
        await prisma.systemSetting
          .delete({
            where: { key: securityKey },
          })
          .catch(() => {});

        return res.status(200).json({
          success: true,
          faceVerified: false,
        });
      }

      return res.status(400).json({ error: 'Invalid action' });
    }

    // Handle GET: Calculate Daily Salary & Monthly Salary Structure per Requirement Document
    if (req.method === 'GET') {
      const now = new Date();
      const slNow = toZonedTime(now, SRI_LANKA_TZ);
      const currentYear = slNow.getFullYear();
      const currentMonth = slNow.getMonth() + 1; // 1-12
      const todayDateStr = format(slNow, 'yyyy-MM-dd');

      const monthStartStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();
      const monthEndStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(
        lastDayOfMonth
      ).padStart(2, '0')}`;

      const monthStartUTC = fromZonedTime(`${monthStartStr} 00:00:00`, SRI_LANKA_TZ);
      const monthEndUTC = fromZonedTime(`${monthEndStr} 23:59:59`, SRI_LANKA_TZ);

      const [userRecord, securitySetting, deptPoliciesSetting, approvedOTs, approvedAdvances, pendingBill] =
        await Promise.all([
          prisma.user.findUnique({
            where: { id: userId },
            include: {
              salaryConfig: true,
              assignedDepartment: true,
              rosters: {
                include: { workShift: true },
                orderBy: { startDate: 'desc' },
              },
              attendances: {
                where: {
                  checkInTime: {
                    gte: monthStartUTC,
                    lte: monthEndUTC,
                  },
                  status: { not: 'ABSENT' },
                },
                include: { location: true },
                orderBy: { checkInTime: 'asc' },
              },
            },
          }),
          prisma.systemSetting.findUnique({ where: { key: securityKey } }),
          prisma.systemSetting.findUnique({ where: { key: 'DEPARTMENT_OFF_DAY_POLICIES' } }),
          prisma.oTRequest.findMany({
            where: {
              userId,
              status: 'APPROVED',
              date: { gte: monthStartUTC, lte: monthEndUTC },
            },
          }),
          prisma.salaryAdvanceRequest.findMany({
            where: {
              userId,
              status: 'APPROVED',
              requestDate: { gte: monthStartUTC, lte: monthEndUTC },
            },
          }),
          ((prisma as any).pendingBillAccount?.findUnique({
            where: {
              userId_month_year: {
                userId,
                month: currentMonth,
                year: currentYear,
              },
            },
          }) ?? Promise.resolve(null)).catch(() => null),
        ]);

      if (!userRecord) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      let securityInfo: SecurityRecord = {
        faceVerified: false,
        pin: '',
        verifiedAt: '',
      };
      if (securitySetting?.value) {
        try {
          securityInfo = JSON.parse(securitySetting.value);
        } catch {
          // ignore
        }
      }

      // Department-specific Off-Day Policy resolution
      const departmentName =
        userRecord.assignedDepartment?.name || userRecord.department || 'General';
      let deptPolicyMap: Record<string, number> = {};
      if (deptPoliciesSetting?.value) {
        try {
          deptPolicyMap = JSON.parse(deptPoliciesSetting.value);
        } catch {
          // ignore
        }
      }

      const config = userRecord.salaryConfig;
      const defaultDeptOffDays =
        deptPolicyMap[departmentName] ??
        (departmentName.toLowerCase().includes('driver') ? 5 : 5);
      const allocatedPaidOffDays =
        config?.offDaysCount && config.offDaysCount > 0
          ? config.offDaysCount
          : defaultDeptOffDays;

      const expectedWorkingDays = Math.max(1, WORKING_DAYS_PER_MONTH - allocatedPaidOffDays);

      // Salary base components
      const basicSalary = config?.basicSalary ?? 0;
      const configuredIncentive = config?.incentive ?? 0;
      const fixedAllowances = (config?.allowances ?? 0) + (config?.otherAllowances ?? 0);
      const otHourlyRateConfig = config?.otAllowance ?? 0;
      const epfEmployeeRate = config?.epfEmployee ?? 8;
      const epfEmployerRate = config?.epfEmployer ?? 12;
      const etfEmployerRate = config?.etfEmployer ?? 3;

      // Deduplicate attendances by Sri Lanka date (YYYY-MM-DD) as required by Section 3
      const attendanceByDate = new Map<
        string,
        {
          id: string;
          checkInTime: Date;
          checkOutTime: Date | null;
          status: string;
          locationName: string;
        }
      >();

      for (const att of userRecord.attendances) {
        const dStr = format(toZonedTime(new Date(att.checkInTime), SRI_LANKA_TZ), 'yyyy-MM-dd');
        if (!attendanceByDate.has(dStr)) {
          attendanceByDate.set(dStr, {
            id: att.id,
            checkInTime: att.checkInTime,
            checkOutTime: att.checkOutTime,
            status: att.status,
            locationName: att.location?.name || 'Office',
          });
        }
      }

      // Approved OT by date
      const otHoursByDate = new Map<string, number>();
      let totalApprovedOTHours = 0;
      for (const ot of approvedOTs) {
        const dStr = format(toZonedTime(new Date(ot.date), SRI_LANKA_TZ), 'yyyy-MM-dd');
        otHoursByDate.set(dStr, (otHoursByDate.get(dStr) || 0) + ot.totalHours);
        totalApprovedOTHours += ot.totalHours;
      }

      const standardHourlyRate = (basicSalary + configuredIncentive) / 240;
      const effectiveOtHourlyRate =
        otHourlyRateConfig > 0 ? otHourlyRateConfig : standardHourlyRate * 1.5;

      // Daily rates
      const dailyBasicRate = basicSalary / WORKING_DAYS_PER_MONTH;
      const dailyIncentiveRate = configuredIncentive / expectedWorkingDays;
      const dailyAdditionalOffDayRate =
        (basicSalary + configuredIncentive) / WORKING_DAYS_PER_MONTH;

      // Build day-by-day breakdown from 1st of month up to today
      const daysElapsedInterval = eachDayOfInterval({
        start: new Date(currentYear, currentMonth - 1, 1),
        end: new Date(
          currentYear,
          currentMonth - 1,
          Math.min(slNow.getDate(), lastDayOfMonth)
        ),
      });

      const dayNames = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ];

      let workedDaysCount = 0;
      let paidOffDaysUsed = 0;
      let unpaidAbsenceDays = 0;
      let additionalOffDaysWorked = 0;
      let accumulatedDailySalary = 0;
      let todayEarnedSalary = 0;

      const dailyRecords: Array<{
        date: string;
        dayName: string;
        dayType: 'WORKED' | 'ADDITIONAL_OFF_DAY_WORKED' | 'PAID_OFF_DAY' | 'UNPAID_ABSENCE';
        hasAttendance: boolean;
        locationName: string | null;
        checkInTime: string | null;
        checkOutTime: string | null;
        basicEarned: number;
        incentiveEarned: number;
        otPayEarned: number;
        totalDayEarned: number;
      }> = [];

      for (const dayDate of daysElapsedInterval) {
        const dStr = format(dayDate, 'yyyy-MM-dd');
        const dayName = dayNames[getDay(dayDate)];
        const att = attendanceByDate.get(dStr);
        const dayOtHours = otHoursByDate.get(dStr) || 0;
        const dayOtPay = dayOtHours * effectiveOtHourlyRate;

        if (att) {
          workedDaysCount += 1;
          const isExtraOffDayWork = workedDaysCount > expectedWorkingDays;

          const basicEarned = isExtraOffDayWork
            ? dailyAdditionalOffDayRate
            : dailyBasicRate;
          const incentiveEarned = isExtraOffDayWork ? 0 : dailyIncentiveRate;
          const totalDayEarned = basicEarned + incentiveEarned + dayOtPay;

          if (isExtraOffDayWork) {
            additionalOffDaysWorked += 1;
          }

          accumulatedDailySalary += totalDayEarned;
          if (dStr === todayDateStr) {
            todayEarnedSalary = totalDayEarned;
          }

          dailyRecords.push({
            date: dStr,
            dayName,
            dayType: isExtraOffDayWork ? 'ADDITIONAL_OFF_DAY_WORKED' : 'WORKED',
            hasAttendance: true,
            locationName: att.locationName,
            checkInTime: format(toZonedTime(new Date(att.checkInTime), SRI_LANKA_TZ), 'hh:mm a'),
            checkOutTime: att.checkOutTime
              ? format(toZonedTime(new Date(att.checkOutTime), SRI_LANKA_TZ), 'hh:mm a')
              : null,
            basicEarned: Math.round(basicEarned * 100) / 100,
            incentiveEarned: Math.round(incentiveEarned * 100) / 100,
            otPayEarned: Math.round(dayOtPay * 100) / 100,
            totalDayEarned: Math.round(totalDayEarned * 100) / 100,
          });
        } else {
          // Employee did not attend work on this day
          // Apply department-specific paid off-day entitlement
          if (paidOffDaysUsed < allocatedPaidOffDays) {
            paidOffDaysUsed += 1;
            const basicEarned = dailyBasicRate;
            const totalDayEarned = basicEarned + dayOtPay;
            accumulatedDailySalary += totalDayEarned;

            if (dStr === todayDateStr) {
              todayEarnedSalary = totalDayEarned;
            }

            dailyRecords.push({
              date: dStr,
              dayName,
              dayType: 'PAID_OFF_DAY',
              hasAttendance: false,
              locationName: 'Paid Off-Day',
              checkInTime: null,
              checkOutTime: null,
              basicEarned: Math.round(basicEarned * 100) / 100,
              incentiveEarned: 0,
              otPayEarned: Math.round(dayOtPay * 100) / 100,
              totalDayEarned: Math.round(totalDayEarned * 100) / 100,
            });
          } else {
            unpaidAbsenceDays += 1;
            dailyRecords.push({
              date: dStr,
              dayName,
              dayType: 'UNPAID_ABSENCE',
              hasAttendance: false,
              locationName: null,
              checkInTime: null,
              checkOutTime: null,
              basicEarned: 0,
              incentiveEarned: 0,
              otPayEarned: Math.round(dayOtPay * 100) / 100,
              totalDayEarned: Math.round(dayOtPay * 100) / 100,
            });
          }
        }
      }

      // Monthly Salary Calculation Structure (Section 1 & 2 of Requirement Document)
      // Paid Off-Day Payment (for extra off-days worked beyond targetWorkingDays)
      const paidOffDayPayment = additionalOffDaysWorked * dailyAdditionalOffDayRate;

      // Step 1: Total for EPF = Basic Salary + Paid Off-Day Payment
      const totalForEpf = basicSalary + paidOffDayPayment;

      // Incentives & OT
      const attendanceIncentive = Math.min(
        configuredIncentive,
        (configuredIncentive / expectedWorkingDays) * Math.min(workedDaysCount, expectedWorkingDays)
      );
      const performanceIncentive = Math.max(0, configuredIncentive - attendanceIncentive);
      const totalOtPay = totalApprovedOTHours * effectiveOtHourlyRate;
      const otAndOtherAllowances = fixedAllowances + totalOtPay;

      // Step 2: Gross Salary = Total for EPF + Attendance Incentive + Performance Incentive + Other Allowances (OT)
      const grossSalary =
        totalForEpf + attendanceIncentive + performanceIncentive + otAndOtherAllowances;

      // Step 3: Employee EPF Contribution (8%) = Total for EPF / 100 * 8
      const employeeEpf = (totalForEpf / 100) * epfEmployeeRate;

      // Deductions breakdown
      const approvedAdvancesSum = approvedAdvances.reduce((s: number, a: any) => s + a.amount, 0);
      const salaryAdvances = Math.max(config?.salaryAdvance ?? 0, approvedAdvancesSum);
      const loanDeduction = config?.loanDeduction ?? 0;
      const pendingBillsAmount = Math.max(
        config?.pendingBills ?? 0,
        pendingBill?.outstandingBalance ?? 0
      );
      const otherDeductions = config?.deductions ?? 0;

      const nonEpfDeductions =
        salaryAdvances + loanDeduction + pendingBillsAmount + otherDeductions;

      // Step 4: Net Salary = Gross Salary - Total Deductions
      const totalDeductions = employeeEpf + nonEpfDeductions;
      const netSalary = grossSalary - totalDeductions;

      // Section 2: Company Contributions (Displayed Separately)
      const companyEpf12 = (totalForEpf / 100) * epfEmployerRate;
      const companyEtf3 = (totalForEpf / 100) * etfEmployerRate;

      // Standard full work-day earning rate (when attending work)
      const standardDailyEarning = dailyBasicRate + dailyIncentiveRate;

      return res.status(200).json({
        employee: {
          id: userRecord.id,
          name:
            `${userRecord.firstName || ''} ${userRecord.lastName || ''}`.trim() ||
            userRecord.email,
          email: userRecord.email,
          position: userRecord.position || 'Employee',
          department: departmentName,
          sequentialId: userRecord.sequentialId,
        },
        period: {
          month: currentMonth,
          year: currentYear,
          monthName: format(slNow, 'MMMM yyyy'),
          todayDate: todayDateStr,
        },
        security: {
          faceVerified: Boolean(securityInfo.faceVerified),
          verifiedAt: securityInfo.verifiedAt || null,
          // Return stored pin so trusted session can auto-apply after swipe if already verified on device
          savedPin: securityInfo.faceVerified ? securityInfo.pin : null,
        },
        departmentOffDayPolicy: {
          departmentName,
          allocatedPaidOffDays,
          expectedWorkingDays,
          daysWorked: workedDaysCount,
          paidOffDaysUsed,
          paidOffDaysRemaining: Math.max(0, allocatedPaidOffDays - paidOffDaysUsed),
          additionalPayableOffDays: additionalOffDaysWorked,
          unpaidAbsences: unpaidAbsenceDays,
        },
        dailySummary: {
          dailyBasicRate: Math.round(dailyBasicRate * 100) / 100,
          dailyIncentiveRate: Math.round(dailyIncentiveRate * 100) / 100,
          standardDailyEarning: Math.round(standardDailyEarning * 100) / 100,
          todayEarnedSalary: Math.round(todayEarnedSalary * 100) / 100,
          accumulatedDailySalary: Math.round(accumulatedDailySalary * 100) / 100,
          attendedToday: attendanceByDate.has(todayDateStr),
        },
        monthlyStructure: {
          hasSalaryConfig: Boolean(config),
          basicSalary: Math.round(basicSalary * 100) / 100,
          paidOffDayPayment: Math.round(paidOffDayPayment * 100) / 100,
          totalForEpf: Math.round(totalForEpf * 100) / 100,
          attendanceIncentive: Math.round(attendanceIncentive * 100) / 100,
          performanceIncentive: Math.round(performanceIncentive * 100) / 100,
          otPay: Math.round(totalOtPay * 100) / 100,
          otherAllowances: Math.round(fixedAllowances * 100) / 100,
          otAndOtherAllowances: Math.round(otAndOtherAllowances * 100) / 100,
          grossSalary: Math.round(grossSalary * 100) / 100,
          epfEmployeeRate,
          employeeEpf: Math.round(employeeEpf * 100) / 100,
          salaryAdvances: Math.round(salaryAdvances * 100) / 100,
          loanDeduction: Math.round(loanDeduction * 100) / 100,
          pendingBills: Math.round(pendingBillsAmount * 100) / 100,
          otherDeductions: Math.round(otherDeductions * 100) / 100,
          nonEpfDeductions: Math.round(nonEpfDeductions * 100) / 100,
          totalDeductions: Math.round(totalDeductions * 100) / 100,
          netSalary: Math.round(netSalary * 100) / 100,
          companyContributions: {
            epfEmployerRate,
            companyEpf12: Math.round(companyEpf12 * 100) / 100,
            etfEmployerRate,
            companyEtf3: Math.round(companyEtf3 * 100) / 100,
          },
        },
        dailyRecords: dailyRecords.reverse(),
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Error in /api/employee/daily-salary:', error);
    return res.status(500).json({
      error: 'Failed to calculate daily salary',
      details: error.message,
    });
  }
}

