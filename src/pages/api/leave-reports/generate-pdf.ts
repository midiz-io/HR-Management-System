import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// Sri Lankan timezone
const SRI_LANKA_TZ = 'Asia/Colombo';

// Helper function to convert date to Sri Lankan time and format
const formatToSriLankanTime = (date: Date | string, formatString: string = 'yyyy-MM-dd'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const zonedDate = toZonedTime(dateObj, SRI_LANKA_TZ);
  return format(zonedDate, formatString);
};

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
  // Get the user from the request
  const supabase = createClient(req, res);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if the user is an admin for certain operations
  const userData = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!userData) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Handle POST request - Generate leave summary PDF data
  if (req.method === 'POST') {
    try {
      const { userId, year, includeDetails } = req.body;

      // Validate required fields
      if (!year) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // If userId is provided and the requester is not an admin, check if they're requesting their own data
      if (userId && (userData.role as any) !== 'ADMIN' && (userData.role as any) !== 'SUPER_ADMIN' && userId !== user.id) {
        return res.status(403).json({ error: 'Forbidden: You can only access your own leave records' });
      }

      // Determine which user's leave to fetch
      const targetUserId = userId || user.id;

      // Get the target user's details
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
      });

      if (!targetUser) {
        return res.status(404).json({ error: 'Target user not found' });
      }

      // Fetch leave balances for the specified year
      const leaveBalances = await prisma.leaveBalance.findMany({
        where: {
          userId: targetUserId,
          year: parseInt(year),
        },
        include: {
          leaveType: true,
        },
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
        }
      });

      // Fetch leave requests for the specified year (for the detailed list)
      const targetYearInt = parseInt(year);
      const startOfYear = new Date(targetYearInt, 0, 1);
      const endOfYear = new Date(targetYearInt, 11, 31, 23, 59, 59, 999);
      
      const leaveRequests = await prisma.leaveRequest.findMany({
        where: {
          userId: targetUserId,
          // Fixed overlapping year logic for the specific requested year
          endDate: {
            gte: startOfYear,
          },
          startDate: {
            lte: endOfYear,
          },
        },
        include: { 
          leaveType: true,
          reviewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { startDate: 'desc' },
      });

      // Calculate leave statistics robustly
      const totalLeavesRequested = leaveRequests.reduce((sum, req) => {
        const effectiveDays = req.totalDays > 0 
          ? req.totalDays 
          : calculateBusinessDays(req.startDate, req.endDate);
        return sum + effectiveDays;
      }, 0);

      const pendingLeaves = leaveRequests
        .filter(req => req.status === 'PENDING')
        .reduce((sum, req) => {
          const effectiveDays = req.totalDays > 0 
            ? req.totalDays 
            : calculateBusinessDays(req.startDate, req.endDate);
          return sum + effectiveDays;
        }, 0);

      const approvedLeaves = leaveRequests
        .filter(req => req.status === 'APPROVED')
        .reduce((sum, req) => {
          const effectiveDays = req.totalDays > 0 
            ? req.totalDays 
            : calculateBusinessDays(req.startDate, req.endDate);
          return sum + effectiveDays;
        }, 0);

      const rejectedLeaves = leaveRequests
        .filter(req => req.status === 'REJECTED')
        .reduce((sum, req) => {
          const effectiveDays = req.totalDays > 0 
            ? req.totalDays 
            : calculateBusinessDays(req.startDate, req.endDate);
          return sum + effectiveDays;
        }, 0);

      const totalLeavesTaken = approvedLeaves;

      // Format leave balances for PDF (Calculating from history as requested)
      const formattedLeaveBalances = leaveBalances.map(balance => {
        // Find all requests for this type in the current year's history
        const typeRequests = leaveRequests.filter(req => req.leaveTypeId === balance.leaveTypeId);
        
        const used = typeRequests
          .filter(req => req.status === 'APPROVED' || req.status === 'VERIFIED')
          .reduce((sum, req) => {
            // Robust calculation: if totalDays is 0 (due to old bug), recalculate it on-the-fly
            const effectiveDays = req.totalDays > 0 
              ? req.totalDays 
              : calculateBusinessDays(req.startDate, req.endDate);
            return sum + effectiveDays;
          }, 0);
          
        const pending = typeRequests
          .filter(req => req.status === 'PENDING')
          .reduce((sum, req) => {
            const effectiveDays = req.totalDays > 0 
              ? req.totalDays 
              : calculateBusinessDays(req.startDate, req.endDate);
            return sum + effectiveDays;
          }, 0);

        const remaining = balance.totalDays - used - pending;
        const isExceeded = remaining < 0;

        const formatAllocationLabel = (leaveType: { name: string; defaultAllocation: number | null }) => {
          if (leaveType.defaultAllocation !== null && leaveType.defaultAllocation !== undefined) {
            return `${leaveType.defaultAllocation} days per year`;
          }
          const name = (leaveType.name || '').toLowerCase();
          if (name.includes('medical')) return 'As approved';
          if (name.includes('no-pay') || name.includes('nopay') || name.includes('no pay')) return 'Unlimited (salary deducted)';
          return 'Unlimited';
        };

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
      });

      // Format leave requests for PDF
      const formattedLeaveRequests = leaveRequests.map(request => ({
        leaveType: request.leaveType.name,
        startDate: formatToSriLankanTime(request.startDate),
        endDate: formatToSriLankanTime(request.endDate),
        totalDays: request.totalDays,
        status: request.status,
        reason: request.reason,
        reviewedBy: request.reviewer
          ? `${request.reviewer.firstName || ''} ${request.reviewer.lastName || ''}`.trim() || request.reviewer.email
          : 'N/A',
        reviewedAt: request.reviewedAt ? formatToSriLankanTime(request.reviewedAt) : 'N/A',
      }));

      // Prepare the response data
      const pdfData = {
        reportTitle: `Leave Summary Report: ${year}`,
        employeeInfo: {
          name: `${targetUser?.firstName || ''} ${targetUser?.lastName || ''}`.trim() || targetUser?.email || 'Unknown',
          email: targetUser?.email || 'N/A',
          department: targetUser?.department || 'N/A',
          position: targetUser?.position || 'N/A',
        },
        summary: {
          year,
          totalLeavesTaken,
          totalLeavesRequested,
          pendingLeaves,
          approvedLeaves,
          rejectedLeaves,
          // Harmonized with dashboard "Approved Leave Summary"
          approvedLeaveSummary: formattedLeaveBalances.map(b => ({
            name: b.leaveType,
            days: b.usedDays
          }))
        },
        leaveBalances: formattedLeaveBalances,
        leaveRequests: includeDetails ? formattedLeaveRequests : [],
        generatedAt: formatToSriLankanTime(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        generatedBy: `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || userData?.email || 'Unknown',
      };

      return res.status(200).json(pdfData);
    } catch (error) {
      console.error('Error generating leave summary PDF data:', error);
      return res.status(500).json({ error: 'Failed to generate leave summary PDF data' });
    }
  }

  // Return 405 for other methods
  return res.status(405).json({ error: 'Method not allowed' });
}