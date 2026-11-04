import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

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

  // GET - Fetch leave balances
  if (req.method === 'GET') {
    try {
      const { year, userId: queryUserId } = req.query;
      
      // Default to current year if not specified
      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
      
      // For regular employees, only show their own balances
      const targetUserId = user.role === 'EMPLOYEE' ? userId : (queryUserId || userId);
      
      let leaveBalances = await prisma.leaveBalance.findMany({
        where: {
          userId: targetUserId as string,
          year: targetYear
        },
        include: {
          leaveType: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              department: true
            }
          }
        },
        orderBy: {
          leaveType: {
            name: 'asc'
          }
        }
      });
      
      // If no balances found, initialize them from the standard leave types
      if (leaveBalances.length === 0) {
        // Get all leave types
        const leaveTypes = await prisma.leaveType.findMany();
        
        if (leaveTypes.length > 0) {
          // Create default balances using each type's defaultAllocation
          const balancesToCreate = leaveTypes.map(leaveType => ({
            userId: targetUserId as string,
            leaveTypeId: leaveType.id,
            year: targetYear,
            totalDays: (leaveType as any).defaultAllocation ?? 0,
            usedDays: 0,
            pendingDays: 0
          }));
          
          await prisma.leaveBalance.createMany({
            data: balancesToCreate
          });
          
          // Fetch the newly created balances
          leaveBalances = await prisma.leaveBalance.findMany({
            where: {
              userId: targetUserId as string,
              year: targetYear
            },
            include: {
              leaveType: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  department: true
                }
              }
            },
            orderBy: {
              leaveType: {
                name: 'asc'
              }
            }
          });
        }
      }
      
      // Calculate used and pending days from history for each balance (as requested)
      // This ensures balances are always up-to-date and 100% accurate based on logs
      const allRequests = await prisma.leaveRequest.findMany({
        where: {
          userId: targetUserId as string,
          // Fixed overlapping year logic: request must end in the target year or later, AND start in the target year or earlier
          endDate: {
            gte: new Date(targetYear, 0, 1),
          },
          startDate: {
            lte: new Date(targetYear, 11, 31, 23, 59, 59, 999),
          },
          // Include all statuses that should count against the quota
          status: { in: ['APPROVED', 'PENDING', 'VERIFIED'] }
        }
      });

      const calculatedBalances = leaveBalances.map(balance => {
        const typeUsage = allRequests
          .filter(req => req.leaveTypeId === balance.leaveTypeId)
          .reduce((acc, req) => {
            // Robust calculation: if totalDays is 0 (due to old bug), recalculate it on-the-fly for the summary
            const effectiveDays = req.totalDays > 0 
              ? req.totalDays 
              : calculateBusinessDays(req.startDate, req.endDate);
              
            if (req.status === 'APPROVED' || req.status === 'VERIFIED') acc.used += effectiveDays;
            if (req.status === 'PENDING') acc.pending += effectiveDays;
            return acc;
          }, { used: 0, pending: 0 });
        
        const available = balance.totalDays - typeUsage.used - typeUsage.pending;
        
        return {
          ...balance,
          usedDays: typeUsage.used,
          pendingDays: typeUsage.pending,
          isExceeded: available < 0
        };
      });

      // Sort by most used (requested) first
      calculatedBalances.sort((a, b) => b.usedDays - a.usedDays);
      
      return res.status(200).json(calculatedBalances);
    } catch (error) {
      console.error('Error fetching leave balances:', error);
      return res.status(500).json({ error: 'Failed to fetch leave balances' });
    }
  }
  
  // PUT - Update leave balance (admin only)
  else if (req.method === 'PUT') {
    // Check if user is admin
    if (user.role !== 'ADMIN' && (user.role as any) !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only admins can update leave balances' });
    }

    try {
      const { id, totalDays, usedDays, pendingDays } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'Leave balance ID is required' });
      }
      
      // Validate numeric fields
      if (
        (totalDays !== undefined && (isNaN(totalDays) || totalDays < 0)) ||
        (usedDays !== undefined && (isNaN(usedDays) || usedDays < 0)) ||
        (pendingDays !== undefined && (isNaN(pendingDays) || pendingDays < 0))
      ) {
        return res.status(400).json({ 
          error: 'Total days, used days, and pending days must be non-negative numbers' 
        });
      }
      
      // Update leave balance
      const updatedLeaveBalance = await prisma.leaveBalance.update({
        where: { id },
        data: {
          ...(totalDays !== undefined && { totalDays: parseFloat(totalDays) }),
          ...(usedDays !== undefined && { usedDays: parseFloat(usedDays) }),
          ...(pendingDays !== undefined && { pendingDays: parseFloat(pendingDays) })
        },
        include: {
          leaveType: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });
      
      return res.status(200).json(updatedLeaveBalance);
    } catch (error) {
      console.error('Error updating leave balance:', error);
      return res.status(500).json({ error: 'Failed to update leave balance' });
    }
  }
  
  // POST - Initialize leave balances for a new year (admin only)
  else if (req.method === 'POST') {
    // Check if user is admin
    if (user.role !== 'ADMIN' && (user.role as any) !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only admins can initialize leave balances' });
    }

    try {
      const { year, userId: targetUserId } = req.body;
      
      if (!year) {
        return res.status(400).json({ error: 'Year is required' });
      }
      
      if (!targetUserId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      // Check if user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId }
      });
      
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Check if balances already exist for this user and year
      const existingBalances = await prisma.leaveBalance.findMany({
        where: {
          userId: targetUserId,
          year: parseInt(year)
        }
      });
      
      if (existingBalances.length > 0) {
        return res.status(400).json({ 
          error: 'Leave balances already exist for this user and year' 
        });
      }
      
      // Get all leave types
      const leaveTypes = await prisma.leaveType.findMany();
      
      if (leaveTypes.length === 0) {
        return res.status(404).json({ error: 'No leave types found' });
      }
      
      // Create default balances using each type's defaultAllocation
      const balancesToCreate = leaveTypes.map(leaveType => ({
        userId: targetUserId,
        leaveTypeId: leaveType.id,
        year: parseInt(year),
        totalDays: (leaveType as any).defaultAllocation ?? 0,
        usedDays: 0,
        pendingDays: 0
      }));
      
      await prisma.leaveBalance.createMany({
        data: balancesToCreate
      });
      
      // Fetch the newly created balances
      const newLeaveBalances = await prisma.leaveBalance.findMany({
        where: {
          userId: targetUserId,
          year: parseInt(year)
        },
        include: {
          leaveType: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              department: true
            }
          }
        }
      });
      
      return res.status(201).json(newLeaveBalances);
    } catch (error) {
      console.error('Error initializing leave balances:', error);
      return res.status(500).json({ error: 'Failed to initialize leave balances' });
    }
  }
  
  // Method not allowed
  else {
    res.setHeader('Allow', ['GET', 'PUT', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}