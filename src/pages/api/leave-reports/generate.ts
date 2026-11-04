import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { fromZonedTime } from 'date-fns-tz';
import { getSectionalHeadContext } from '@/lib/sectionalHeadDb';

const SRI_LANKA_TZ = 'Asia/Colombo';

// Helper function to calculate business days between two dates
function calculateBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  // Normalize to midnight UTC
  const start = new Date(startDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(0, 0, 0, 0);
  
  const curDate = new Date(start.getTime());
  while (curDate <= end) {
    const dayOfWeek = curDate.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    curDate.setUTCDate(curDate.getUTCDate() + 1);
  }
  return count;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Create Supabase client with admin privileges
  const supabase = createClient(req, res);

  // Get user from session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  // Get user role
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const context = await getSectionalHeadContext(userId);
  const isSuperAdminOrHR = context?.isSuperAdminOrHR || (user.role as any) === 'SUPER_ADMIN';
  const isGlobalAdmin = user.role === 'ADMIN' || user.role === 'MANAGER' || isSuperAdminOrHR;
  const isSectionalHead = (user.role as any) === 'SECTIONAL_HEAD' || context?.isSectionalHead;

  // Only admins, managers, and sectional heads can generate reports
  if (!isGlobalAdmin && !isSectionalHead) {
    return res.status(403).json({
      error: 'Only admins, managers, and sectional heads can generate reports'
    });
  }

  try {
    let {
      reportType,
      userId: targetUserId,
      department: requestedDept,
      startDate,
      endDate,
      leaveTypeId
    } = req.body;

    // Enforce Sectional Head department locking
    let department = requestedDept;
    if (isSectionalHead && !isGlobalAdmin && context?.managedDepartment) {
      department = context.managedDepartment.name;
    }

    if (!reportType) {
      return res.status(400).json({ error: 'Report type is required' });
    }

    // Parse dates safely
    const parseDateSafely = (dateInput: any, timeSuffix: string) => {
      if (!dateInput) return undefined;

      // Try parsing as-is first
      let d = new Date(dateInput);

      // If it's a simple date string (YYYY-MM-DD), use the timezone-safe method
      if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        return fromZonedTime(`${dateInput} ${timeSuffix}`, SRI_LANKA_TZ);
      }

      // If it's an ISO string or invalid, handle it
      if (isNaN(d.getTime())) {
        if (typeof dateInput === 'string') {
          const isoMatch = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (isoMatch) {
            return fromZonedTime(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]} ${timeSuffix}`, SRI_LANKA_TZ);
          }
        }
        return undefined; // Let it be undefined rather than Invalid Date
      }

      return d;
    };

    const parsedStartDate = parseDateSafely(startDate, '00:00:00');
    const parsedEndDate = parseDateSafely(endDate, '23:59:59');

    // Build filter conditions
    const where: any = {};

    // Filter by date range if provided
    if (parsedStartDate || parsedEndDate) {
      where.OR = [
        // Leave starts within range
        {
          startDate: {
            ...(parsedStartDate && { gte: parsedStartDate }),
            ...(parsedEndDate && { lte: parsedEndDate })
          }
        },
        // Leave ends within range
        {
          endDate: {
            ...(parsedStartDate && { gte: parsedStartDate }),
            ...(parsedEndDate && { lte: parsedEndDate })
          }
        },
        // Leave spans the entire range
        {
          ...(parsedStartDate && parsedEndDate && {
            AND: [
              { startDate: { lte: parsedStartDate } },
              { endDate: { gte: parsedEndDate } }
            ]
          })
        }
      ];
    }

    // Filter by leave type if provided
    if (leaveTypeId) {
      where.leaveTypeId = leaveTypeId;
    }

    // Generate report based on type
    let reportData;

    // Individual employee report
    if (reportType === 'individual' && targetUserId) {
      where.userId = targetUserId;

      // Get employee details
      const employee = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          department: true,
          position: true
        }
      });

      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      const leaveRequests = await prisma.leaveRequest.findMany({
        where,
        include: {
          leaveType: true,
          reviewer: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { startDate: 'desc' }
      });

      // Get ALL leave requests for this employee for the current year to ensure accurate YTD balance
      const currentYear = new Date().getFullYear();
      const allYearRequests = await prisma.leaveRequest.findMany({
        where: {
          userId: targetUserId,
          // Fixed overlapping year logic: request must end in the target year or later, AND start in the target year or earlier
          endDate: {
            gte: new Date(currentYear, 0, 1),
          },
          startDate: {
            lte: new Date(currentYear, 11, 31, 23, 59, 59, 999),
          },
          status: { in: ['APPROVED', 'PENDING', 'VERIFIED'] }
        },
        include: { leaveType: true },
        orderBy: { startDate: 'desc' },
      });

      // Get leave balances
      const rawBalances = await prisma.leaveBalance.findMany({
        where: {
          userId: targetUserId,
          year: currentYear
        },
        include: {
          leaveType: true
        }
      });

      const leaveBalances = rawBalances.map(balance => {
        // Sum from ALL requests for this year for maximum accuracy (desync-proof)
        const typeUsage = allYearRequests
          .filter(req => req.leaveTypeId === balance.leaveTypeId)
          .reduce((acc, req) => {
            // Robust calculation: if totalDays is 0 (due to old bug), recalculate it on-the-fly
            const effectiveDays = req.totalDays > 0 
              ? req.totalDays 
              : calculateBusinessDays(req.startDate, req.endDate);

            if (req.status === 'APPROVED' || req.status === 'VERIFIED') acc.used += effectiveDays;
            if (req.status === 'PENDING') acc.pending += effectiveDays;
            return acc;
          }, { used: 0, pending: 0 });
        
        return {
          ...balance,
          usedDays: typeUsage.used,
          pendingDays: typeUsage.pending
        };
      });

      const formatAllocationLabel = (leaveType: { name: string; defaultAllocation: number | null }) => {
        if (leaveType.defaultAllocation !== null && leaveType.defaultAllocation !== undefined) {
          return `${leaveType.defaultAllocation} days per year`;
        }
        const name = (leaveType.name || '').toLowerCase();
        if (name.includes('medical')) return 'As approved';
        if (name.includes('no-pay') || name.includes('nopay') || name.includes('no pay')) return 'Unlimited (salary deducted)';
        return 'Unlimited';
      };

      const totalDaysTakenRobust = allYearRequests
        .filter(req => req.status === 'APPROVED')
        .reduce((sum, req) => {
          const effectiveDays = req.totalDays > 0 
            ? req.totalDays 
            : calculateBusinessDays(req.startDate, req.endDate);
          return sum + effectiveDays;
        }, 0);

      const totalDaysPendingRobust = allYearRequests
        .filter(req => req.status === 'PENDING')
        .reduce((sum, req) => {
          const effectiveDays = req.totalDays > 0 
            ? req.totalDays 
            : calculateBusinessDays(req.startDate, req.endDate);
          return sum + effectiveDays;
        }, 0);

      const totalRequests = leaveRequests.length;
      const approvedRequests = leaveRequests.filter(req => req.status === 'APPROVED').length;
      const rejectedRequests = leaveRequests.filter(req => req.status === 'REJECTED').length;
      const pendingRequests = leaveRequests.filter(req => req.status === 'PENDING').length;

      reportData = {
        reportType: 'Individual Employee Report',
        employee,
        leaveRequests,
        leaveBalances: leaveBalances.map(balance => {
          const used = balance.usedDays;
          const pending = balance.pendingDays;
          const remaining = balance.totalDays - used - pending;
          const isExceeded = remaining < 0;

          return {
            leaveType: balance.leaveType.name,
            totalDays: balance.totalDays,
            usedDays: used,
            pendingDays: pending,
            remainingDays: remaining,
            isQuotaExceeded: isExceeded,
            status: isExceeded ? 'QUOTA OVER' : 'AVAILABLE',
            allocationLabel: formatAllocationLabel({ name: balance.leaveType.name, defaultAllocation: (balance.leaveType as any).defaultAllocation ?? null }),
            // Explicitly show the math for the report
            deductionLabel: `${balance.totalDays} (Entitlement) - ${used} (Approved) = ${remaining} (Remaining)`
          };
        }),
        statistics: {
          totalRequests,
          approvedRequests,
          rejectedRequests,
          pendingRequests,
          totalDaysTaken: totalDaysTakenRobust,
          pendingDaysTaken: totalDaysPendingRobust,
          totalDaysRequested: totalDaysTakenRobust + totalDaysPendingRobust,
          // Direct sync with "Approved Leave Summary" terminology
          approvedLeaveSummary: leaveBalances.map(b => ({
            name: b.leaveType.name,
            days: b.usedDays,
            color: b.leaveType.color
          }))
        },
        generatedAt: new Date(),
        generatedBy: {
          id: userId,
          role: user.role
        }
      };
    }

    // Department report
    else if (reportType === 'department' && department) {
      // Get all employees in the department
      const employees = await prisma.user.findMany({
        where: { department },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          position: true
        }
      });

      if (employees.length === 0) {
        return res.status(404).json({
          error: 'No employees found in this department'
        });
      }

      // Get leave requests for all employees in the department
      where.userId = { in: employees.map(emp => emp.id) };

      const leaveRequests = await prisma.leaveRequest.findMany({
        where,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              position: true
            }
          },
          leaveType: true
        },
        orderBy: [
          { user: { firstName: 'asc' } },
          { startDate: 'desc' }
        ]
      });

      // Calculate statistics
      const totalRequests = leaveRequests.length;
      const approvedRequests = leaveRequests.filter(req => req.status === 'APPROVED').length;
      const rejectedRequests = leaveRequests.filter(req => req.status === 'REJECTED').length;
      const pendingRequests = leaveRequests.filter(req => req.status === 'PENDING').length;

      // Group by employee
      const employeeStats = employees.map(emp => {
        const empRequests = leaveRequests.filter(req => req.userId === emp.id);
        const totalDaysTaken = empRequests
          .filter(req => req.status === 'APPROVED')
          .reduce((sum, req) => {
            const effectiveDays = req.totalDays > 0 
              ? req.totalDays 
              : calculateBusinessDays(req.startDate, req.endDate);
            return sum + effectiveDays;
          }, 0);

        const pendingDaysTaken = empRequests
          .filter(req => req.status === 'PENDING')
          .reduce((sum, req) => {
            const effectiveDays = req.totalDays > 0 
              ? req.totalDays 
              : calculateBusinessDays(req.startDate, req.endDate);
            return sum + effectiveDays;
          }, 0);

        return {
          employee: emp,
          totalRequests: empRequests.length,
          approvedRequests: empRequests.filter(req => req.status === 'APPROVED' || req.status === 'VERIFIED').length,
          totalDaysTaken,
          pendingDaysTaken,
          totalDaysRequested: totalDaysTaken + pendingDaysTaken
        };
      });

      reportData = {
        reportType: 'Department Report',
        department,
        employees,
        leaveRequests,
        statistics: {
          totalRequests,
          approvedRequests,
          rejectedRequests,
          pendingRequests,
          employeeStats
        },
        generatedAt: new Date(),
        generatedBy: {
          id: userId,
          role: user.role
        }
      };
    }

    // Summary report
    else if (reportType === 'summary') {
      // Get all leave requests within the date range
      const leaveRequests = await prisma.leaveRequest.findMany({
        where,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              department: true,
              position: true
            }
          },
          leaveType: true
        }
      });

      // Get all leave types
      const leaveTypes = await prisma.leaveType.findMany();

      // Calculate statistics
      const totalRequests = leaveRequests.length;
      const approvedRequests = leaveRequests.filter(req => req.status === 'APPROVED').length;
      const rejectedRequests = leaveRequests.filter(req => req.status === 'REJECTED').length;
      const pendingRequests = leaveRequests.filter(req => req.status === 'PENDING').length;

      // Group by department
      const deptSet = new Set<string>();
      leaveRequests.forEach(req => {
        if (req.user.department) {
          deptSet.add(req.user.department);
        }
      });
      const departments = Array.from(deptSet);
      const departmentStats = departments.map(dept => {
        const deptRequests = leaveRequests.filter(req => req.user.department === dept);
        const totalDaysTaken = deptRequests
          .filter(req => req.status === 'APPROVED')
          .reduce((sum, req) => {
            const effectiveDays = req.totalDays > 0 
              ? req.totalDays 
              : calculateBusinessDays(req.startDate, req.endDate);
            return sum + effectiveDays;
          }, 0);

        return {
          department: dept,
          totalRequests: deptRequests.length,
          approvedRequests: deptRequests.filter(req => req.status === 'APPROVED').length,
          totalDaysTaken
        };
      });

      // Group by leave type
      const leaveTypeStats = leaveTypes.map(type => {
        const typeRequests = leaveRequests.filter(req => req.leaveTypeId === type.id);
        const totalDaysTaken = typeRequests
          .filter(req => req.status === 'APPROVED')
          .reduce((sum, req) => {
            const effectiveDays = req.totalDays > 0 
              ? req.totalDays 
              : calculateBusinessDays(req.startDate, req.endDate);
            return sum + effectiveDays;
          }, 0);

        const pendingDaysTaken = typeRequests
          .filter(req => req.status === 'PENDING')
          .reduce((sum, req) => {
            const effectiveDays = req.totalDays > 0 
              ? req.totalDays 
              : calculateBusinessDays(req.startDate, req.endDate);
            return sum + effectiveDays;
          }, 0);

        const totalDaysRequested = totalDaysTaken + pendingDaysTaken;
        const totalQuota = type.defaultAllocation ?? 0;
        const isExceeded = totalQuota > 0 && (totalQuota - totalDaysRequested) < 0;

        return {
          leaveType: type,
          totalRequests: typeRequests.length,
          approvedRequests: typeRequests.filter(req => req.status === 'APPROVED' || req.status === 'VERIFIED').length,
          totalDaysTaken,
          pendingDaysTaken,
          totalDaysRequested,
          isQuotaExceeded: isExceeded,
          quotaStatus: isExceeded ? 'QUOTA EXCEEDED' : 'AVAILABLE'
        };
      });

      reportData = {
        reportType: 'Summary Report',
        dateRange: {
          startDate: parsedStartDate,
          endDate: parsedEndDate
        },
        statistics: {
          totalRequests,
          approvedRequests,
          rejectedRequests,
          pendingRequests,
          departmentStats,
          leaveTypeStats
        },
        generatedAt: new Date(),
        generatedBy: {
          id: userId,
          role: user.role
        }
      };
    }

    else {
      return res.status(400).json({
        error: 'Invalid report type or missing required parameters'
      });
    }

    return res.status(200).json(reportData);
  } catch (error) {
    console.error('Error generating report:', error);
    return res.status(500).json({ error: 'Failed to generate report' });
  }
}