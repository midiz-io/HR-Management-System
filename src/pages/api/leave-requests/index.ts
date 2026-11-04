import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { sendNotificationToRole, sendNotificationToUser } from '@/util/notifications';
import { fromZonedTime } from 'date-fns-tz';

const SRI_LANKA_TZ = 'Asia/Colombo';

// Helper function to calculate business days between two dates
function calculateBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  // Normalize to start of day UTC to avoid time component issues
  const start = new Date(startDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(0, 0, 0, 0);
  
  const curDate = new Date(start.getTime());
  while (curDate <= end) {
    const dayOfWeek = curDate.getUTCDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    curDate.setUTCDate(curDate.getUTCDate() + 1);
  }
  return count;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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

  // Get user role and creation date
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, createdAt: true }
  });

  if (!userData) {
    return res.status(404).json({ error: 'User not found' });
  }

  const userRole = userData.role;
  const userCreatedAt = userData.createdAt;

  // Fetch the actual joinDate from the database (raw SQL since Prisma model may not recognize it)
  let actualJoinDate: Date = new Date(userCreatedAt);
  try {
    const rawJoinData: any[] = await prisma.$queryRaw`SELECT "joinDate" FROM "User" WHERE id = ${userId}::uuid`;
    if (rawJoinData && rawJoinData.length > 0 && rawJoinData[0].joinDate) {
      actualJoinDate = new Date(rawJoinData[0].joinDate);
    }
  } catch (rawError) {
    // If query fails, column likely doesn't exist yet — fall back to createdAt
    console.error('Error fetching joinDate for probation check:', rawError);
  }

  // Tiered restriction logic:
  // Month 1 & 2: Only 1 Half Day allowed.
  // After 3 months: All allowed.
  const joinDate = actualJoinDate;
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - joinDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Calculate which "tenure month" the user is in (1, 2, or 3+)
  const tenureMonth = Math.floor(diffDays / 30) + 1;
  
  // If joined >= 90 days ago, NO probation restrictions at all
  // Probation only applies to genuinely new employees (< 90 days since joinDate)
  const probationStatus = diffDays < 90 && (userRole === 'EMPLOYEE' || userRole === 'ADMIN') ? {
    isProbation: true,
    tenureMonth,
    daysSinceJoined: diffDays
  } : { isProbation: false };

  // GET - Fetch leave requests
  if (req.method === 'GET') {
    try {
      const { status, startDate, endDate, userId: queryUserId } = req.query;

      // Build filter conditions
      const where: any = {};

      // Filter by status if provided
      if (status) {
        where.status = status;
      }

      // Filter by date range if provided
      if (startDate || endDate) {
        const startDateStr = typeof startDate === 'string' && startDate.includes('T') ? startDate.split('T')[0] : startDate;
        const endDateStr = typeof endDate === 'string' && endDate.includes('T') ? endDate.split('T')[0] : endDate;

        const parsedStartFilter = startDateStr ? fromZonedTime(`${startDateStr} 00:00:00`, SRI_LANKA_TZ) : undefined;
        const parsedEndFilter = endDateStr ? fromZonedTime(`${endDateStr} 23:59:59`, SRI_LANKA_TZ) : undefined;

        where.OR = [
          // Leave starts within range
          {
            startDate: {
              ...(parsedStartFilter && { gte: parsedStartFilter }),
              ...(parsedEndFilter && { lte: parsedEndFilter })
            }
          },
          // Leave ends within range
          {
            endDate: {
              ...(parsedStartFilter && { gte: parsedStartFilter }),
              ...(parsedEndFilter && { lte: parsedEndFilter })
            }
          },
          // Leave spans the entire range
          {
            ...(parsedStartFilter && parsedEndFilter && {
              AND: [
                { startDate: { lte: parsedStartFilter } },
                { endDate: { gte: parsedEndFilter } }
              ]
            })
          }
        ];
      }

      // For regular employees, only show their own requests
      if (userRole === 'EMPLOYEE') {
        where.userId = userId;
      }
      // For Sectional Heads, filter by managed department employees plus their own requests
      else if (userRole === 'SECTIONAL_HEAD') {
        const managedDept = await prisma.department.findFirst({
          where: { headId: userId }
        });

        if (managedDept) {
          where.OR = [
            { userId: userId },
            { 
              user: { 
                departmentId: managedDept.id 
              } 
            }
          ];
        } else {
          where.userId = userId;
        }

        if (queryUserId) {
          where.userId = queryUserId;
        }
      }
      // For Admins, filter based on department head status
      else if (userRole === 'ADMIN') {
        const adminUser = await prisma.user.findUnique({
          where: { id: userId },
          include: { managedDepartment: true }
        });

        if (adminUser?.managedDepartment) {
          // If they manage a department, only show their department's employees
          where.user = {
            departmentId: adminUser.managedDepartment.id,
            role: { in: ['EMPLOYEE', 'MANAGER', 'SECTIONAL_HEAD'] }
          };
        } else {
          where.OR = [
            { userId: userId },
            { 
              user: { 
                role: { in: ['EMPLOYEE', 'MANAGER'] },
                departmentId: null
              } 
            }
          ];
        }
        
        if (queryUserId) {
          where.userId = queryUserId;
        }
      }
      // For managers/admins/super_admins, filter by specific user if requested
      else if (queryUserId) {
        where.userId = queryUserId;
      }

      const leaveRequests = await prisma.leaveRequest.findMany({
        where,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              department: true
            }
          },
          leaveType: true,
          reviewer: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          },
          documents: {
            select: {
              id: true,
              fileName: true,
              fileUrl: true,
              fileType: true,
              fileSize: true,
              uploadedAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return res.status(200).json(leaveRequests);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      return res.status(500).json({ error: 'Failed to fetch leave requests' });
    }
  }

  // POST - Create a new leave request
  else if (req.method === 'POST') {
    // Enforce Probation restriction logic
    if (probationStatus.isProbation) {
      const { isHalfDay } = req.body;
      const { tenureMonth, daysSinceJoined } = probationStatus;

      // 1. If not half-day, Block.
      if (!isHalfDay) {
        const eligibilityDate = new Date(joinDate);
        eligibilityDate.setDate(eligibilityDate.getDate() + 90);
        return res.status(403).json({
          error: `During probation (first 3 months), you can only request Half Day leaves. You will be eligible for full-day leaves after ${eligibilityDate.toLocaleDateString()} (${90 - (daysSinceJoined || 0)} days remaining).`
        });
      }

      // 2. If half-day, check if they already used their quota for this "tenure month"
      const currentMonthStart = new Date(userCreatedAt);
      currentMonthStart.setDate(currentMonthStart.getDate() + (tenureMonth - 1) * 30);
      const currentMonthEnd = new Date(userCreatedAt);
      currentMonthEnd.setDate(currentMonthEnd.getDate() + tenureMonth * 30);

      const existingInMonth = await prisma.leaveRequest.findFirst({
        where: {
          userId,
          status: { in: ['APPROVED', 'PENDING', 'VERIFIED'] },
          createdAt: {
            gte: currentMonthStart,
            lt: currentMonthEnd
          }
        }
      });

      if (existingInMonth) {
        return res.status(403).json({
          error: `Restriction: You are allowed only one Half Day leave for Month ${tenureMonth} of your registration. You have already used or requested this month's quota.`
        });
      }
      
      // If none of the above, they pass (1 half-day allowed)
    }

    try {
      const {
        leaveTypeId: originalLeaveTypeId,
        startDate,
        endDate,
        reason,
        isHalfDay,
        documents = []
      } = req.body;

      let leaveTypeId = originalLeaveTypeId;

      // If it's a half-day request, force it to 'Annual Leave'
      if (isHalfDay) {
        const annualLeaveType = await prisma.leaveType.findFirst({
          where: { name: 'Annual Leave' }
        });
        
        if (annualLeaveType) {
          leaveTypeId = annualLeaveType.id;
        } else {
          return res.status(400).json({
            error: 'Annual Leave type not found. Please contact administrator to initialize leave types.'
          });
        }
      }

      // Validate required fields
      if (!leaveTypeId || !startDate || !endDate || !reason) {
        return res.status(400).json({
          error: 'Leave type, start date, end date, and reason are required'
        });
      }

      // Validate reason can't be empty
      if (!reason.length) {
        return res.status(400).json({
          error: 'Reason must not be empty'
        });
      }

      // Verify the leave type exists
      const leaveType = await prisma.leaveType.findUnique({
        where: { id: leaveTypeId }
      });

      if (!leaveType) {
        return res.status(400).json({
          error: 'Invalid leave type selected'
        });
      }

      // Parse dates safely
      const parseDateSafely = (dateInput: any) => {
        if (!dateInput) return null;
        let d = new Date(dateInput);
        if (isNaN(d.getTime())) {
          if (typeof dateInput === 'string') {
            const isoMatch = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (isoMatch) {
              d = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00Z`);
            }
          }
        }
        return isNaN(d.getTime()) ? null : d;
      };

      const parsedStartDate = parseDateSafely(startDate);
      const parsedEndDate = parseDateSafely(endDate);

      // Validate parsed dates
      if (!parsedStartDate || !parsedEndDate) {
        return res.status(400).json({
          error: 'Invalid date format provided'
        });
      }

      // Ensure they are truly Date objects for Prisma
      const finalStartDate = new Date(parsedStartDate.getTime());
      const finalEndDate = new Date(parsedEndDate.getTime());

      // Validate date range
      if (finalStartDate > finalEndDate) {
        return res.status(400).json({
          error: 'End date must be after start date'
        });
      }

      // Calculate total days (business days only)
      const totalDays = req.body.isHalfDay ? 0.5 : calculateBusinessDays(parsedStartDate, parsedEndDate);

      // Check for overlapping leave requests
      const overlappingRequests = await prisma.leaveRequest.findMany({
        where: {
          userId,
          status: { in: ['PENDING', 'APPROVED'] },
          OR: [
            {
              startDate: { lte: finalStartDate },
              endDate: { gte: finalStartDate }
            },
            {
              startDate: { lte: finalEndDate },
              endDate: { gte: finalEndDate }
            },
            {
              startDate: { gte: finalStartDate },
              endDate: { lte: finalEndDate }
            }
          ]
        }
      });

      if (overlappingRequests.length > 0) {
        return res.status(400).json({
          error: 'You already have an overlapping leave request for this period'
        });
      }

      // Handle leave balance based on leave type allocation
      const currentYear = new Date().getFullYear();
      const hasFixedAllocation = leaveType.defaultAllocation !== null && leaveType.defaultAllocation !== undefined;

      // Calculate REAL-TIME balance from history (desync-proof and robust)
      const allYearRequests = await prisma.leaveRequest.findMany({
        where: {
          userId,
          leaveTypeId,
          // Fixed overlapping year logic: request must end in the current year or later, AND start in the current year or earlier
          endDate: {
            gte: new Date(currentYear, 0, 1),
          },
          startDate: {
            lte: new Date(currentYear, 11, 31, 23, 59, 59, 999),
          },
          // Include all statuses that count against the quota
          status: { in: ['APPROVED', 'PENDING', 'VERIFIED'] }
        }
      });

      const usedFromHistory = allYearRequests
        .filter(req => req.status === 'APPROVED' || req.status === 'VERIFIED')
        .reduce((sum, req) => {
          // Robust calculation: if totalDays is 0 (due to old bug), recalculate it on-the-fly
          const effectiveDays = req.totalDays > 0 
            ? req.totalDays 
            : (function() {
                // Re-use business day calculation logic
                let count = 0;
                const start = new Date(req.startDate);
                start.setUTCHours(0, 0, 0, 0);
                const end = new Date(req.endDate);
                end.setUTCHours(0, 0, 0, 0);
                const curDate = new Date(start.getTime());
                while (curDate <= end) {
                  const dayOfWeek = curDate.getUTCDay();
                  if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
                  curDate.setUTCDate(curDate.getUTCDate() + 1);
                }
                return count;
              })();
          return sum + effectiveDays;
        }, 0);
      
      const pendingFromHistory = allYearRequests
        .filter(req => req.status === 'PENDING')
        .reduce((sum, req) => {
          const effectiveDays = req.totalDays > 0 
            ? req.totalDays 
            : (function() {
                let count = 0;
                const start = new Date(req.startDate);
                start.setUTCHours(0, 0, 0, 0);
                const end = new Date(req.endDate);
                end.setUTCHours(0, 0, 0, 0);
                const curDate = new Date(start.getTime());
                while (curDate <= end) {
                  const dayOfWeek = curDate.getUTCDay();
                  if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
                  curDate.setUTCDate(curDate.getUTCDate() + 1);
                }
                return count;
              })();
          return sum + effectiveDays;
        }, 0);

      // For leave types with fixed allocation (Annual, Casual), enforce balance limit
      if (hasFixedAllocation) {
        const totalQuota = leaveType.defaultAllocation ?? 0;
        const availableDays = totalQuota - usedFromHistory - pendingFromHistory;

        if (availableDays < totalDays) {
          // If the balance is exceeded, return the specific requested error message
          return res.status(400).json({
            error: `Your available leave quota for this year has expired. Available: ${availableDays.toFixed(1)} days, Requested: ${totalDays} days. "You have enough leave left this year."`
          });
        }
      }

      // Sync the LeaveBalance table (as a caching layer/legacy compatibility)
      let leaveBalance = await prisma.leaveBalance.findUnique({
        where: {
          userId_leaveTypeId_year: {
            userId,
            leaveTypeId,
            year: currentYear
          }
        }
      });

      if (!leaveBalance) {
        leaveBalance = await prisma.leaveBalance.create({
          data: {
            userId,
            leaveTypeId,
            year: currentYear,
            totalDays: leaveType.defaultAllocation ?? 0,
            pendingDays: pendingFromHistory + totalDays,
            usedDays: usedFromHistory
          }
        });
      } else {
        await prisma.leaveBalance.update({
          where: { id: leaveBalance.id },
          data: {
            usedDays: usedFromHistory,
            pendingDays: pendingFromHistory + totalDays
          }
        });
      }

      // Create leave request
      const leaveRequest = await prisma.leaveRequest.create({
        data: {
          userId,
          leaveTypeId,
          startDate: parsedStartDate,
          endDate: parsedEndDate,
          totalDays,
          reason,
          documents: {
            create: documents.map((doc: any) => ({
              fileName: doc.fileName,
              fileUrl: doc.fileUrl,
              fileType: doc.fileType,
              fileSize: doc.fileSize
            }))
          }
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            }
          },
          leaveType: true,
          documents: true
        }
      });

      // Get user name for notification
      const userName = `${leaveRequest.user.firstName || ''} ${leaveRequest.user.lastName || ''}`.trim() || leaveRequest.user.email;

      // Format dates for notification
      const startDateFormatted = parsedStartDate.toLocaleDateString();
      const endDateFormatted = parsedEndDate.toLocaleDateString();

      // Send notification to admins
      await sendNotificationToRole(
        'ADMIN',
        `New Leave Request: ${userName}`,
        `${userName} has requested ${totalDays} days of ${leaveRequest.leaveType.name} from ${startDateFormatted} to ${endDateFormatted}.`,
        {
          url: '/admin-dashboard?tab=leave',
          tag: 'leave-request',
          requireInteraction: true,
        }
      );

      // Send confirmation notification to the employee
      await sendNotificationToUser(
        userId,
        'Leave Request Submitted',
        `Your request for ${totalDays} days of ${leaveRequest.leaveType.name} from ${startDateFormatted} to ${endDateFormatted} has been submitted and is pending approval.`,
        {
          url: '/dashboard?tab=leave',
          tag: 'leave-request-confirmation',
        }
      );

      return res.status(201).json(leaveRequest);
    } catch (error) {
      console.error('Error creating leave request:', error);
      return res.status(500).json({ error: 'Failed to create leave request' });
    }
  }

  // PUT - Update leave request status (admin/manager only)
  else if (req.method === 'PUT') {
    // Check if user is admin, manager, super admin or sectional head
    if (userRole !== 'ADMIN' && (userRole as any) !== 'MANAGER' && (userRole as any) !== 'SUPER_ADMIN' && (userRole as any) !== 'SECTIONAL_HEAD') {
      return res.status(403).json({
        error: 'Only admins, managers, and sectional heads can update leave request status'
      });
    }

    try {
      const { id, status, rejectionReason } = req.body;

      if (!id || !status) {
        return res.status(400).json({
          error: 'Leave request ID and status are required'
        });
      }

      // Validate status
      if (!['APPROVED', 'REJECTED', 'VERIFIED'].includes(status)) {
        return res.status(400).json({
          error: 'Status must be either APPROVED, REJECTED, or VERIFIED'
        });
      }

      // If rejecting, reason is required
      if (status === 'REJECTED' && !rejectionReason) {
        return res.status(400).json({
          error: 'Rejection reason is required'
        });
      }

      // Get the leave request
      const leaveRequest = await prisma.leaveRequest.findUnique({
        where: { id },
        include: {
          user: true,
          leaveType: true
        }
      });

      if (!leaveRequest) {
        return res.status(404).json({ error: 'Leave request not found' });
      }

      // Role-based permission check for reviewers
      if ((userRole as any) === 'SECTIONAL_HEAD') {
        const managedDept = await prisma.department.findFirst({
          where: { headId: userId }
        });
        const targetUser = leaveRequest.user;
        if (!managedDept || (targetUser as any).departmentId !== managedDept.id) {
          return res.status(403).json({
            error: 'You can only recommend or reject leave requests for your department'
          });
        }
        if (targetUser.id === userId) {
          return res.status(403).json({
            error: 'You cannot review your own leave request. HR will provide final approval directly.'
          });
        }
        if (status === 'APPROVED') {
          return res.status(403).json({
            error: 'Sectional Heads can provide recommendation (Verify) or Reject. Final approval is granted by HR.'
          });
        }
      } else if (userRole === 'ADMIN') {
        const adminUser = await prisma.user.findUnique({
          where: { id: userId },
          include: { managedDepartment: true }
        });

        const targetUser = leaveRequest.user;
        
        // Check if Admin is the head of the employee's department
        if (adminUser?.managedDepartment) {
          if ((targetUser as any).departmentId !== adminUser.managedDepartment.id) {
            return res.status(403).json({
              error: 'You can only review leave requests for your department'
            });
          }
        } else {
          // If not a head, they can't review others unless they have global permissions
          if (targetUser.id !== userId) {
            return res.status(403).json({
              error: 'You are not authorized to review this leave request'
            });
          }
        }

        if ((targetUser.role as any) === 'ADMIN' || (targetUser.role as any) === 'SUPER_ADMIN') {
          return res.status(403).json({
            error: 'Admins cannot review leave requests for other Admins or Super Admins'
          });
        }
      }

      // Check if request is already processed (allow PENDING or VERIFIED)
      if ((leaveRequest.status as any) !== 'PENDING' && (leaveRequest.status as any) !== 'VERIFIED') {
        return res.status(400).json({
          error: `Leave request is already ${leaveRequest.status.toLowerCase()}`
        });
      }

      // For fixed-allocation leave types, block APPROVED/VERIFIED if it would exceed entitlement.
      // (Protects against admin changing entitlements or historical desync.)
      if ((status === 'APPROVED' || status === 'VERIFIED') && leaveRequest.leaveType.defaultAllocation !== null && leaveRequest.leaveType.defaultAllocation !== undefined) {
        const currentYear = new Date().getFullYear();

        const allYearRequests = await prisma.leaveRequest.findMany({
          where: {
            userId: leaveRequest.userId,
            leaveTypeId: leaveRequest.leaveTypeId,
            endDate: { gte: new Date(currentYear, 0, 1) },
            startDate: { lte: new Date(currentYear, 11, 31, 23, 59, 59, 999) },
            status: { in: ['APPROVED', 'PENDING', 'VERIFIED'] },
            NOT: { id: leaveRequest.id }
          }
        });

        const usedOther = allYearRequests
          .filter(r => r.status === 'APPROVED' || r.status === 'VERIFIED')
          .reduce((sum, r) => sum + (r.totalDays > 0 ? r.totalDays : calculateBusinessDays(r.startDate, r.endDate)), 0);

        const pendingOther = allYearRequests
          .filter(r => r.status === 'PENDING')
          .reduce((sum, r) => sum + (r.totalDays > 0 ? r.totalDays : calculateBusinessDays(r.startDate, r.endDate)), 0);

        const totalQuota = leaveRequest.leaveType.defaultAllocation ?? 0;
        const wouldUse = leaveRequest.totalDays > 0 ? leaveRequest.totalDays : calculateBusinessDays(leaveRequest.startDate, leaveRequest.endDate);
        const availableAfter = totalQuota - (usedOther + wouldUse) - pendingOther;

        if (availableAfter < 0) {
          return res.status(400).json({
            error: `Cannot ${status.toLowerCase()} this request because it exceeds the employee's annual entitlement. Available: ${Math.max(0, totalQuota - usedOther - pendingOther).toFixed(1)} days, Requested: ${wouldUse.toFixed(1)} days.`
          });
        }
      }

      // Get or create leave balance
      const currentYear = new Date().getFullYear();
      let leaveBalance = await prisma.leaveBalance.findUnique({
        where: {
          userId_leaveTypeId_year: {
            userId: leaveRequest.userId,
            leaveTypeId: leaveRequest.leaveTypeId,
            year: currentYear
          }
        }
      });

      if (!leaveBalance) {
        // Create balance record if missing (shouldn't happen normally)
        leaveBalance = await prisma.leaveBalance.create({
          data: {
            userId: leaveRequest.userId,
            leaveTypeId: leaveRequest.leaveTypeId,
            year: currentYear,
            totalDays: leaveRequest.leaveType.defaultAllocation ?? 0,
            pendingDays: 0,
            usedDays: 0
          }
        });
      }

      // Update leave request
      const updatedLeaveRequest = await prisma.leaveRequest.update({
        where: { id },
        data: {
          status: status as any,
          reviewerId: userId,
          reviewedAt: new Date(),
          rejectionReason: status === 'REJECTED' ? rejectionReason : null
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              department: true
            }
          },
          leaveType: true,
          reviewer: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      // Re-sync this specific LeaveBalance from history (accurate + keeps VERIFIED semantics consistent).
      const historyRequests = await prisma.leaveRequest.findMany({
        where: {
          userId: leaveRequest.userId,
          leaveTypeId: leaveRequest.leaveTypeId,
          endDate: { gte: new Date(currentYear, 0, 1) },
          startDate: { lte: new Date(currentYear, 11, 31, 23, 59, 59, 999) },
          status: { in: ['APPROVED', 'PENDING', 'VERIFIED'] }
        }
      });

      const used = historyRequests
        .filter(r => r.status === 'APPROVED' || r.status === 'VERIFIED')
        .reduce((sum, r) => sum + (r.totalDays > 0 ? r.totalDays : calculateBusinessDays(r.startDate, r.endDate)), 0);

      const pending = historyRequests
        .filter(r => r.status === 'PENDING')
        .reduce((sum, r) => sum + (r.totalDays > 0 ? r.totalDays : calculateBusinessDays(r.startDate, r.endDate)), 0);

      await prisma.leaveBalance.update({
        where: { id: leaveBalance.id },
        data: { usedDays: used, pendingDays: pending }
      });

      // Get user name for notification
      const userName = `${updatedLeaveRequest.user.firstName || ''} ${updatedLeaveRequest.user.lastName || ''}`.trim() || updatedLeaveRequest.user.email;
      const reviewerName = `${updatedLeaveRequest.reviewer?.firstName || ''} ${updatedLeaveRequest.reviewer?.lastName || ''}`.trim() || 'Administrator';

      // Format dates for notification
      const startDateFormatted = new Date(updatedLeaveRequest.startDate).toLocaleDateString();
      const endDateFormatted = new Date(updatedLeaveRequest.endDate).toLocaleDateString();

      if (status === 'APPROVED') {
        await sendNotificationToUser(
          updatedLeaveRequest.user.id,
          'Leave Request Approved',
          `Your request for ${updatedLeaveRequest.totalDays} days of ${updatedLeaveRequest.leaveType.name} from ${startDateFormatted} to ${endDateFormatted} has been approved by ${reviewerName}.`,
          {
            url: '/dashboard?tab=leave',
            tag: 'leave-approved',
            requireInteraction: true,
          }
        );
      } else if (status === 'REJECTED') {
        await sendNotificationToUser(
          updatedLeaveRequest.user.id,
          'Leave Request Rejected',
          `Your request for ${updatedLeaveRequest.totalDays} days of ${updatedLeaveRequest.leaveType.name} from ${startDateFormatted} to ${endDateFormatted} has been rejected by ${reviewerName}. Reason: ${rejectionReason}`,
          {
            url: '/dashboard?tab=leave',
            tag: 'leave-rejected',
            requireInteraction: true,
          }
        );
      }

      return res.status(200).json(updatedLeaveRequest);
    } catch (error) {
      console.error('Error updating leave request:', error);
      return res.status(500).json({ error: 'Failed to update leave request' });
    }
  }

  // DELETE - Cancel a leave request (only for own pending requests)
  else if (req.method === 'DELETE') {
    try {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'Leave request ID is required' });
      }

      // Get the leave request
      const leaveRequest = await prisma.leaveRequest.findUnique({
        where: { id: id as string }
      });

      if (!leaveRequest) {
        return res.status(404).json({ error: 'Leave request not found' });
      }

      // Check if user owns this request or is admin
      if (leaveRequest.userId !== userId && userRole !== 'ADMIN') {
        return res.status(403).json({
          error: 'You can only cancel your own leave requests'
        });
      }

      // Check if request is still pending
      if (leaveRequest.status !== 'PENDING') {
        return res.status(400).json({
          error: 'Only pending leave requests can be cancelled'
        });
      }

      // Update leave balance - restore pending days
      const currentYear = new Date().getFullYear();
      const leaveBalance = await prisma.leaveBalance.findUnique({
        where: {
          userId_leaveTypeId_year: {
            userId: leaveRequest.userId,
            leaveTypeId: leaveRequest.leaveTypeId,
            year: currentYear
          }
        }
      });

      if (leaveBalance) {
        await prisma.leaveBalance.update({
          where: { id: leaveBalance.id },
          data: {
            pendingDays: Math.max(0, leaveBalance.pendingDays - leaveRequest.totalDays)
          }
        });
      }

      // Update leave request status to CANCELLED
      await prisma.leaveRequest.update({
        where: { id: id as string },
        data: { status: 'CANCELLED' }
      });

      return res.status(200).json({ message: 'Leave request cancelled successfully' });
    } catch (error) {
      console.error('Error cancelling leave request:', error);
      return res.status(500).json({ error: 'Failed to cancel leave request' });
    }
  }

  // Method not allowed
  else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}