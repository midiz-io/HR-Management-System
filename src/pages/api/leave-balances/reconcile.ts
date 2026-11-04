import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

// Helper function to calculate business days between two dates
function calculateBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
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

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Verify Super Admin or Admin role
  const userData = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  });

  if (!userData || (userData.role !== 'SUPER_ADMIN' && userData.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  try {
    const { year, userId: targetUserId } = req.body;
    const syncYear = year ? parseInt(year as string) : new Date().getFullYear();

    // Find all relevant balances to reconcile
    const balances = await prisma.leaveBalance.findMany({
      where: {
        year: syncYear,
        ...(targetUserId && { userId: targetUserId })
      }
    });

    const results = [];

    for (const balance of balances) {
      // Calculate raw history for this specific balance
      const historyRequests = await prisma.leaveRequest.findMany({
        where: {
          userId: balance.userId,
          leaveTypeId: balance.leaveTypeId,
          endDate: { gte: new Date(syncYear, 0, 1) },
          startDate: { lte: new Date(syncYear, 11, 31, 23, 59, 59, 999) },
          status: { in: ['APPROVED', 'PENDING', 'VERIFIED'] }
        }
      });

      const used = historyRequests
        .filter(req => req.status === 'APPROVED' || req.status === 'VERIFIED')
        .reduce((sum, req) => sum + (req.totalDays > 0 ? req.totalDays : calculateBusinessDays(req.startDate, req.endDate)), 0);

      const pending = historyRequests
        .filter(req => req.status === 'PENDING')
        .reduce((sum, req) => sum + (req.totalDays > 0 ? req.totalDays : calculateBusinessDays(req.startDate, req.endDate)), 0);

      // Update the database record to match history
      const updated = await prisma.leaveBalance.update({
        where: { id: balance.id },
        data: {
          usedDays: used,
          pendingDays: pending
        }
      });
      results.push(updated);
    }

    return res.status(200).json({ 
      message: `Successfully reconciled ${results.length} balance records for year ${syncYear}.`,
      count: results.length
    });
  } catch (error) {
    console.error('Error reconciling balances:', error);
    return res.status(500).json({ error: 'Failed to reconcile balances' });
  }
}
