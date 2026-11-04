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

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, department: true }
  });

  const departmentManaged = await prisma.department.findFirst({
    where: { headId: session.user.id }
  });

  const isGlobalAdminOrHR = user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.department === 'HR');
  const isAuthorized = isGlobalAdminOrHR || !!departmentManaged;

  if (!isAuthorized) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Retrieve request to verify department access
  const targetRequest = await prisma.gatePassRequest.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          departmentId: true
        }
      }
    }
  });

  if (!targetRequest) {
    return res.status(404).json({ error: 'Gate Pass request not found.' });
  }

  // If the user is only a sectional head, verify department matches
  if (!isGlobalAdminOrHR && departmentManaged) {
    if (targetRequest.user.departmentId !== departmentManaged.id) {
      return res.status(403).json({ error: 'Forbidden. You can only review requests for your department.' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { status, rejectionReason, returnedAt } = req.body;

      const validStatuses = [
        'PENDING_SECTIONAL_HEAD', 
        'PENDING_HR', 
        'APPROVED', 
        'REJECTED', 
        'CANCELLED', 
        'RETURNED', 
        'NOT_RETURNED'
      ];
      
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const updateData: any = {};
      if (status) updateData.status = status;
      if (status === 'REJECTED') updateData.rejectionReason = rejectionReason;
      if (status === 'APPROVED' || status === 'REJECTED') {
        updateData.reviewerId = session.user.id;
        updateData.reviewedAt = new Date();
      }
      if (status === 'RETURNED' || returnedAt) {
        updateData.returnedAt = returnedAt ? new Date(returnedAt) : new Date();
      }

      const request = await prisma.gatePassRequest.update({
        where: { id },
        data: updateData,
      });

      return res.status(200).json(request);
    } catch (error) {
      console.error('Error updating gate pass request:', error);
      return res.status(500).json({ error: 'Failed to update request' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
