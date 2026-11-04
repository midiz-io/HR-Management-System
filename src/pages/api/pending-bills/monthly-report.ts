import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getSectionalHeadContext, ensureSectionalHeadAndNewTables } from '@/lib/sectionalHeadDb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
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

  const { isSuperAdminOrHR, user } = context;
  const isSalesOrAdmin = isSuperAdminOrHR || 
    user.role === 'ADMIN' || 
    (user.department && user.department.toLowerCase().includes('sales'));

  if (!isSalesOrAdmin) {
    return res.status(403).json({ error: 'Access denied: Only HR, Admin, or Sales can view the monthly pending bills report' });
  }

  try {
    const { month, year, format } = req.query;
    const now = new Date();
    const targetMonth = month ? parseInt(month as string) : now.getMonth() + 1;
    const targetYear = year ? parseInt(year as string) : now.getFullYear();

    const reportRows: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        a."id",
        a."userId",
        a."month",
        a."year",
        a."totalBilled",
        a."cashPaid",
        a."outstandingBalance",
        a."isSalaryDeductionConfirmed",
        a."confirmedDeductionAmount",
        a."salaryDeductionConfirmedAt",
        u."firstName",
        u."lastName",
        u."email",
        u."department",
        u."position",
        u."sequentialId",
        conf."firstName" as "confirmedByFirstName",
        conf."lastName" as "confirmedByLastName"
      FROM "PendingBillAccount" a
      JOIN "User" u ON a."userId" = u."id"
      LEFT JOIN "User" conf ON a."confirmedById" = conf."id"
      WHERE a."month" = $1 AND a."year" = $2
      ORDER BY a."outstandingBalance" DESC, u."firstName" ASC
    `, targetMonth, targetYear);

    // Calculate report summary totals
    let totalBilledSum = 0;
    let totalCashPaidSum = 0;
    let totalOutstandingSum = 0;
    let totalConfirmedDeductionsSum = 0;

    const employees = reportRows.map(r => {
      totalBilledSum += r.totalBilled || 0;
      totalCashPaidSum += r.cashPaid || 0;
      totalOutstandingSum += r.outstandingBalance || 0;
      totalConfirmedDeductionsSum += r.confirmedDeductionAmount || 0;

      return {
        id: r.id,
        userId: r.userId,
        employeeId: r.sequentialId ? `EMP-${String(r.sequentialId).padStart(4, '0')}` : r.userId.slice(0, 8),
        employeeName: `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email,
        email: r.email,
        department: r.department || 'General',
        position: r.position || 'Employee',
        month: r.month,
        year: r.year,
        totalBilled: r.totalBilled,
        cashPaid: r.cashPaid,
        outstandingBalance: r.outstandingBalance,
        isSalaryDeductionConfirmed: r.isSalaryDeductionConfirmed,
        confirmedDeductionAmount: r.confirmedDeductionAmount,
        salaryDeductionConfirmedAt: r.salaryDeductionConfirmedAt,
        confirmedBy: r.confirmedByFirstName ? `${r.confirmedByFirstName} ${r.confirmedByLastName || ''}`.trim() : null,
      };
    });

    // CSV format download support
    if (format === 'csv') {
      const csvHeader = 'Employee ID,Employee Name,Department,Month,Year,Total Invoice Amount,Cash Paid,Outstanding Balance,Salary Deduction Confirmed\n';
      const csvRows = employees.map(e => 
        `"${e.employeeId}","${e.employeeName}","${e.department}",${e.month},${e.year},${e.totalBilled},${e.cashPaid},${e.outstandingBalance},"${e.isSalaryDeductionConfirmed ? 'YES' : 'NO'}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=Pending_Bills_Report_${targetYear}_${targetMonth}.csv`);
      return res.status(200).send(csvHeader + csvRows);
    }

    return res.status(200).json({
      month: targetMonth,
      year: targetYear,
      summary: {
        totalEmployeesWithBills: employees.length,
        totalBilledSum,
        totalCashPaidSum,
        totalOutstandingSum,
        totalConfirmedDeductionsSum,
      },
      employees,
    });
  } catch (error: any) {
    console.error('Error generating pending bills report:', error);
    return res.status(500).json({ error: 'Failed to generate monthly pending bills report' });
  }
}
