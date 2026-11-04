import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getSectionalHeadContext, ensureSectionalHeadAndNewTables } from '@/lib/sectionalHeadDb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureSectionalHeadAndNewTables();
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Valid request ID is required' });
  }

  const supabase = createClient(req, res);
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const context = await getSectionalHeadContext(authUser.id);
  if (!context) {
    return res.status(404).json({ error: 'User profile not found' });
  }

  const { isSectionalHead, isSuperAdminOrHR, managedDepartment } = context;

  // PATCH: Process review actions (Recommend, Approve, Reject, Cancel)
  if (req.method === 'PATCH') {
    try {
      const { action, rejectionReason } = req.body;

      if (!action) {
        return res.status(400).json({ error: 'Action is required (RECOMMEND, APPROVE, REJECT, CANCEL)' });
      }

      const existingRows: any[] = await prisma.$queryRawUnsafe(`
        SELECT * FROM "OffDayRequest" WHERE "id" = $1 LIMIT 1
      `, id);

      if (existingRows.length === 0) {
        return res.status(404).json({ error: 'Off-day request not found' });
      }

      const request = existingRows[0];

      // ACTION 1: Employee CANCEL own request
      if (action === 'CANCEL') {
        if (request.userId !== authUser.id) {
          return res.status(403).json({ error: 'You can only cancel your own requests' });
        }
        if (request.status === 'APPROVED') {
          return res.status(400).json({ error: 'Approved requests cannot be cancelled directly. Please contact HR.' });
        }

        await prisma.$executeRawUnsafe(`
          UPDATE "OffDayRequest"
          SET "status" = 'CANCELLED', "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $1
        `, id);

        return res.status(200).json({ success: true, message: 'Request cancelled successfully', status: 'CANCELLED' });
      }

      // ACTION 2: Sectional Head RECOMMEND (Forward to HR)
      if (action === 'RECOMMEND') {
        // Must be Sectional Head or HR
        const canRecommend = isSuperAdminOrHR || (isSectionalHead && managedDepartment && managedDepartment.id === request.departmentId);
        if (!canRecommend) {
          return res.status(403).json({ error: 'Only the Sectional Head of this department or HR can recommend this request' });
        }

        if (request.status !== 'PENDING_SECTIONAL_HEAD') {
          return res.status(400).json({ error: `Cannot recommend request in '${request.status}' status` });
        }

        await prisma.$executeRawUnsafe(`
          UPDATE "OffDayRequest"
          SET "status" = 'PENDING_HR',
              "recommendedById" = $1::uuid,
              "recommendedAt" = CURRENT_TIMESTAMP,
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $2
        `, authUser.id, id);

        return res.status(200).json({
          success: true,
          message: 'Off-day request recommended and forwarded to HR for final approval.',
          status: 'PENDING_HR',
        });
      }

      // ACTION 3: Final APPROVE (HR only)
      if (action === 'APPROVE') {
        if (!isSuperAdminOrHR) {
          return res.status(403).json({ error: 'Only HR (Super Admin) can provide final approval for off-day requests' });
        }

        if (request.status !== 'PENDING_HR' && request.status !== 'PENDING_SECTIONAL_HEAD') {
          return res.status(400).json({ error: `Cannot approve request in '${request.status}' status` });
        }

        await prisma.$executeRawUnsafe(`
          UPDATE "OffDayRequest"
          SET "status" = 'APPROVED',
              "reviewerId" = $1::uuid,
              "reviewedAt" = CURRENT_TIMESTAMP,
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $2
        `, authUser.id, id);

        return res.status(200).json({
          success: true,
          message: 'Off-day request approved by HR.',
          status: 'APPROVED',
        });
      }

      // ACTION 4: REJECT (Sectional Head or HR)
      if (action === 'REJECT') {
        const canReject = isSuperAdminOrHR || (isSectionalHead && managedDepartment && managedDepartment.id === request.departmentId);
        if (!canReject) {
          return res.status(403).json({ error: 'You do not have permission to reject this request' });
        }

        await prisma.$executeRawUnsafe(`
          UPDATE "OffDayRequest"
          SET "status" = 'REJECTED',
              "reviewerId" = $1::uuid,
              "reviewedAt" = CURRENT_TIMESTAMP,
              "rejectionReason" = $2,
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $3
        `, authUser.id, rejectionReason || 'Rejected by supervisor/HR', id);

        return res.status(200).json({
          success: true,
          message: 'Off-day request rejected.',
          status: 'REJECTED',
        });
      }

      return res.status(400).json({ error: `Unknown action: ${action}` });
    } catch (error: any) {
      console.error('Error updating off-day request:', error);
      return res.status(500).json({ error: error.message || 'Failed to update request' });
    }
  }

  res.setHeader('Allow', ['PATCH']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}
