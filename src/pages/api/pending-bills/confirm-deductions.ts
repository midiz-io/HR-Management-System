import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getSectionalHeadContext, ensureSectionalHeadAndNewTables } from '@/lib/sectionalHeadDb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  await ensureSectionalHeadAndNewTables();
  const supabase = createClient(req, res);
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const context = await getSectionalHeadContext(authUser.id);
  if (!context) {
    return res.status(404).json({ error: 'User profile not found' });
  }

  const { isSuperAdminOrHR } = context;

  // Only HR (Super Admin or HR department) can confirm salary deductions
  if (!isSuperAdminOrHR) {
    return res.status(403).json({ error: 'Access denied: Only HR (Super Admin) can confirm monthly salary deductions' });
  }

  try {
    const { month, year, accountIds } = req.body;

    if (!month || !year) {
      return res.status(400).json({ error: 'Month and year are required' });
    }

    const targetMonth = parseInt(month);
    const targetYear = parseInt(year);

    let whereClause = `WHERE a."month" = $1 AND a."year" = $2 AND a."outstandingBalance" > 0`;
    const params: any[] = [targetMonth, targetYear];

    if (accountIds && Array.isArray(accountIds) && accountIds.length > 0) {
      params.push(accountIds);
      whereClause += ` AND a."id" = ANY($${params.length}::text[])`;
    }

    const eligibleAccounts: any[] = await prisma.$queryRawUnsafe(`
      SELECT a."id", a."userId", a."outstandingBalance"
      FROM "PendingBillAccount" a
      ${whereClause}
    `, ...params);

    if (eligibleAccounts.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No outstanding pending bill balances found to deduct for this month.',
        confirmedCount: 0,
      });
    }

    let confirmedCount = 0;
    let totalDeductedSum = 0;

    for (const acc of eligibleAccounts) {
      const deductionAmount = acc.outstandingBalance;
      totalDeductedSum += deductionAmount;
      confirmedCount++;

      // 1. Mark account deduction confirmed
      await prisma.$executeRawUnsafe(`
        UPDATE "PendingBillAccount"
        SET "isSalaryDeductionConfirmed" = true,
            "confirmedDeductionAmount" = $1,
            "salaryDeductionConfirmedAt" = CURRENT_TIMESTAMP,
            "confirmedById" = $2::uuid,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $3
      `, deductionAmount, authUser.id, acc.id);

      // 2. Sync deduction into SalaryConfig for this employee
      try {
        await prisma.$executeRawUnsafe(`
          UPDATE "SalaryConfig"
          SET "pendingBills" = $1,
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE "userId" = $2::uuid
        `, deductionAmount, acc.userId);
      } catch (err) {
        console.warn('SalaryConfig sync note:', err);
      }

      // 3. If a Payroll record already exists for this month, update it directly
      try {
        const payrolls: any[] = await prisma.$queryRawUnsafe(`
          SELECT * FROM "Payroll"
          WHERE "userId" = $1::uuid AND "month" = $2 AND "year" = $3
          LIMIT 1
        `, acc.userId, targetMonth, targetYear);

        if (payrolls.length > 0) {
          const p = payrolls[0];
          const newPendingBills = deductionAmount;
          const basic = p.basicSalary || 0;
          const allowances = (p.allowances || 0) + (p.otAllowance || 0) + (p.otherAllowances || 0) + (p.attendanceBonus || 0) + (p.offDayPay || 0) + (p.holidayPay || 0) + (p.otPay || 0) + (p.incentive || 0) + (p.performanceIncentive || 0);
          const epf = p.epfAmount || 0;
          const generalDeductions = (p.deductions || 0) + (p.salaryAdvance || 0) + (p.loanDeduction || 0) + (p.lateDeductions || 0);
          const newNetSalary = (basic + allowances) - (epf + generalDeductions + newPendingBills);

          await prisma.$executeRawUnsafe(`
            UPDATE "Payroll"
            SET "pendingBills" = $1,
                "netSalary" = $2,
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = $3
          `, newPendingBills, Math.max(0, newNetSalary), p.id);
        }
      } catch (err) {
        console.warn('Payroll sync note:', err);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Confirmed salary deductions for ${confirmedCount} employees totaling LKR ${totalDeductedSum.toLocaleString()}. Applied to monthly payroll records.`,
      confirmedCount,
      totalDeductedSum,
    });
  } catch (error: any) {
    console.error('Error confirming salary deductions:', error);
    return res.status(500).json({ error: error.message || 'Failed to confirm salary deductions' });
  }
}
