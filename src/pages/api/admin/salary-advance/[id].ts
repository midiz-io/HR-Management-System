import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Request ID is required' });
  }

  // Check admin/HR status
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, department: true }
  });

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.department !== 'HR')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method === 'PATCH') {
    try {
      const { status, rejectionReason } = req.body;

      const validStatuses = ['APPROVED', 'REJECTED', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const request = await prisma.salaryAdvanceRequest.update({
        where: { id },
        data: {
          status,
          reviewerId: session.user.id,
          reviewedAt: new Date(),
          rejectionReason: status === 'REJECTED' ? rejectionReason : null,
        },
      });

      // Optional: If approved, we could automatically add to next payroll or SalaryConfig, but for now we just approve it.

      return res.status(200).json(request);
    } catch (error) {
      console.error('Error updating salary advance request:', error);
      return res.status(500).json({ error: 'Failed to update request' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
