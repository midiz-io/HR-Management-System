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

  // Fetch user and request details for validation
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { managedDepartment: true }
  });

  if (!user) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const shortLeaveRequest = await prisma.shortLeaveRequest.findUnique({
    where: { id },
    include: {
      user: true
    }
  });

  if (!shortLeaveRequest) {
    return res.status(404).json({ error: 'Short leave request not found' });
  }

  const isSuperAdminOrHR = user.role === 'SUPER_ADMIN' || user.department === 'HR';
  let isAuthorized = false;

  if (isSuperAdminOrHR) {
    isAuthorized = true;
  } else if (shortLeaveRequest.requestTo === 'DEPT_HEAD') {
    isAuthorized = !!(user.managedDepartment && user.managedDepartment.id === shortLeaveRequest.user.departmentId);
  } else {
    isAuthorized = user.role === 'ADMIN';
  }

  if (!isAuthorized) {
    return res.status(403).json({ error: 'Forbidden. You are not authorized to review this request.' });
  }

  if (req.method === 'PATCH') {
    try {
      const { status, rejectionReason } = req.body;

      const validStatuses = ['APPROVED', 'REJECTED', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const request = await prisma.shortLeaveRequest.update({
        where: { id },
        data: {
          status,
          reviewerId: session.user.id,
          reviewedAt: new Date(),
          rejectionReason: status === 'REJECTED' ? rejectionReason : null,
        },
      });

      return res.status(200).json(request);
    } catch (error) {
      console.error('Error updating short leave request:', error);
      return res.status(500).json({ error: 'Failed to update request' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
