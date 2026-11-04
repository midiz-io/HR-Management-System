import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { calculatePayroll } from '@/util/payroll';
import {
  calculateOffAndHolidayPay,
  getMonthBounds,
} from '@/util/payroll-days';
import { generatePayslipPDFBuffer } from '@/util/pdf-generator';
import { sendWhatsAppDocument, sendSMS } from '@/util/bird-api';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = req.headers.authorization;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: Missing Authorization header' });
  }

  if (!prisma.user) {
    console.error('Prisma Error: prisma.user is undefined');
    return res.status(500).json({ error: 'Prisma client error: user model not found' });
  }

  try {
    // Create Supabase client for storage
    const supabase = createClient(req, res);

    const requester = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!requester || (requester.role !== 'SUPER_ADMIN' && requester.role !== 'ADMIN')) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    if (req.method === 'POST') {
      const { month, year } = req.body;

      if (!month || !year) {
        return res.status(400).json({ error: 'Month and year are required' });
      }

      if (!prisma.salaryConfig || !prisma.payroll) {
        console.error('Prisma Error: salaryConfig or payroll model is undefined. Client needs regeneration.');
        return res.status(500).json({
          error: 'Prisma client error: Payroll models not found. Please run npx prisma generate.',
        });
      }

      const m = Number(month);
      const y = Number(year);
      const { start: startOfMonth, end: endOfMonth } = getMonthBounds(m, y);

      const configs = await prisma.salaryConfig.findMany({
        include: {
          user: {
            include: {
              rosters: { include: { workShift: true } },
            },
          },
        },
      });

      const processedPayrolls = [];

      for (const config of configs) {
        const otRequests = await prisma.oTRequest.findMany({
          where: {
            userId: config.userId,
            status: 'APPROVED',
            date: { gte: startOfMonth, lte: endOfMonth },
          },
        });
        const totalOTHours = otRequests.reduce((sum, req) => sum + req.totalHours, 0);

        const lateCount = await prisma.attendance.count({
          where: {
            userId: config.userId,
            status: 'LATE',
            checkInTime: { gte: startOfMonth, lte: endOfMonth },
          },
        });

        const dailyRate = config.basicSalary / 30;
        const lateDeductions = 0; // Late deductions are disabled/removed
        const attendanceBonus = 0;

        const monthAttendances = await prisma.attendance.findMany({
          where: {
            userId: config.userId,
            checkInTime: { gte: startOfMonth, lte: endOfMonth },
            status: { not: 'ABSENT' },
          },
          select: { checkInTime: true },
        });

        const { offDayPayment, holidayPayment, calculatedIncentive } = calculateOffAndHolidayPay(
          config.basicSalary,
          config.user.rosters,
          monthAttendances.map((a) => a.checkInTime),
          y,
          config.offDaysCount ?? 0,
          config.incentive ?? 0
        );

        const calc = calculatePayroll(
          config.basicSalary,
          config.allowances + (config.otherAllowances || 0), // Removed otAllowance from flat additions
          config.deductions +
            (config.salaryAdvance || 0) +
            (config.loanDeduction || 0) +
            (config.pendingBills || 0),
          totalOTHours,
          lateDeductions,
          attendanceBonus,
          config.epfEmployee,
          config.epfEmployer,
          config.etfEmployer,
          offDayPayment,
          holidayPayment,
          calculatedIncentive,
          config.incentive ?? 0,
          config.otAllowance || 0 // Pass otAllowance as the hourly OT rate
        );

        const existingPayroll = await prisma.payroll.findUnique({
          where: {
            userId_month_year: {
              userId: config.userId,
              month: m,
              year: y,
            },
          },
        });

        const payrollData = {
          basicSalary: calc.basicSalary,
          allowances: config.allowances,
          otAllowance: config.otAllowance || 0,
          otherAllowances: config.otherAllowances || 0,
          offDayPay: calc.offDayPay,
          holidayPay: calc.holidayPay,
          otPay: calc.otPay,
          deductions: calc.deductions,
          salaryAdvance: config.salaryAdvance || 0,
          loanDeduction: config.loanDeduction || 0,
          pendingBills: config.pendingBills || 0,
          incentive: calc.incentive,
          performanceIncentive: calc.performanceIncentive,
          attendanceBonus: calc.attendanceBonus,
          lateDeductions: calc.lateDeductions,
          epfAmount: calc.epfEmployee,
          etfAmount: calc.etfEmployer,
          netSalary: calc.netSalary,
          status: 'PROCESSED' as const,
        };

        const payroll = existingPayroll
          ? await prisma.payroll.update({
              where: { id: existingPayroll.id },
              data: payrollData,
            })
          : await prisma.payroll.create({
              data: {
                userId: config.userId,
                month: m,
                year: y,
                ...payrollData,
              },
            });

        processedPayrolls.push(payroll);

        // --- Notification Logic ---
        if (config.user.phoneNumber) {
          try {
            // Generate PDF
            const pdfBuffer = await generatePayslipPDFBuffer({
              employeeName: `${config.user.firstName || ''} ${config.user.lastName || ''}`.trim() || config.user.email,
              department: config.user.department || 'N/A',
              month: new Date(y, m - 1).toLocaleString('default', { month: 'long' }),
              year: y,
              basicSalary: calc.basicSalary,
              allowances: config.allowances + (config.otAllowance || 0) + (config.otherAllowances || 0),
              offDayPay: calc.offDayPay,
              holidayPay: calc.holidayPay,
              otPay: calc.otPay,
              incentive: calc.incentive,
              performanceIncentive: calc.performanceIncentive,
              attendanceBonus: calc.attendanceBonus,
              deductions: calc.deductions,
              salaryAdvance: config.salaryAdvance || 0,
              loanDeduction: config.loanDeduction || 0,
              pendingBills: config.pendingBills || 0,
              lateDeductions: calc.lateDeductions,
              epfEmployee: calc.epfEmployee,
              etfEmployer: calc.etfEmployer,
              netSalary: calc.netSalary,
              timestamp: new Date().toLocaleString()
            });

            // Make sure bucket exists (ignore error if it already does)
            await supabase.storage.createBucket('payslips', { public: false }).catch(() => {});

            const fileName = `payslips/${y}/${m}/${config.userId}-${Date.now()}.pdf`;
            
            // Upload to Supabase
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('payslips')
              .upload(fileName, pdfBuffer, {
                contentType: 'application/pdf',
                upsert: true
              });

            if (uploadError) {
              console.error('Failed to upload payslip PDF:', uploadError);
            } else {
              // Get signed URL valid for 1 hour (3600 seconds)
              const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                .from('payslips')
                .createSignedUrl(fileName, 3600);

              if (signedUrlError || !signedUrlData?.signedUrl) {
                console.error('Failed to get signed URL for payslip:', signedUrlError);
              } else {
                const monthName = new Date(y, m - 1).toLocaleString('default', { month: 'long' });
                const caption = `Your payslip for ${monthName} ${y} has been processed.\nProcessed at: ${new Date().toLocaleString()}`;
                
                // Send via Bird API
                const result = await sendWhatsAppDocument(config.user.phoneNumber, signedUrlData.signedUrl, caption);
                if (!result.success) {
                  console.error(`Failed to send WhatsApp to ${config.user.phoneNumber}:`, result.error);
                } else {
                  console.log(`Successfully sent WhatsApp payslip to ${config.user.phoneNumber}`);
                }
              }
            }
          } catch (notifErr) {
            console.error('Error in payslip notification logic:', notifErr);
          }
        }
      }

      return res.status(200).json({
        message: `Successfully processed payroll for ${processedPayrolls.length} employees`,
        count: processedPayrolls.length,
      });
    } else if (req.method === 'DELETE') {
      const { month, year, userIds } = req.body;

      if (!month || !year) {
        return res.status(400).json({ error: 'Month and year are required' });
      }

      const m = Number(month);
      const y = Number(year);

      let deleteWhere: any = {
        month: m,
        year: y,
      };

      if (userIds && Array.isArray(userIds) && userIds.length > 0) {
        deleteWhere.userId = { in: userIds };
      }

      const result = await prisma.payroll.deleteMany({
        where: deleteWhere,
      });

      // Also delete salary configuration for selected userIds so they are removed from the active payroll table
      if (userIds && Array.isArray(userIds) && userIds.length > 0) {
        await prisma.salaryConfig.deleteMany({
          where: {
            userId: { in: userIds },
          },
        });
      }

      return res.status(200).json({
        message: `Successfully cleared payroll for ${result.count} records`,
        count: result.count,
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Error processing payroll:', error);
    const details = error?.message || 'Internal Server Error';
    if (details.includes('OTStatus') || details.includes('does not exist')) {
      return res.status(500).json({
        error: 'Database schema out of date. Run: node scratch/fix_payroll_database.js',
        details,
      });
    }
    if (error?.code === 'P1001') {
      return res.status(503).json({
        error: 'Database unreachable. Check your connection / Supabase project.',
        details,
      });
    }
    return res.status(500).json({ error: details });
  }
}
