import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getSectionalHeadContext, ensureSectionalHeadAndNewTables } from '@/lib/sectionalHeadDb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureSectionalHeadAndNewTables();
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Notice ID is required' });
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

  const { user, isSuperAdminOrHR, isSectionalHead, managedDepartment } = context;

  // DELETE: Delete notice
  if (req.method === 'DELETE') {
    try {
      const existing: any[] = await prisma.$queryRawUnsafe(`
        SELECT * FROM "DepartmentNotice" WHERE "id" = $1 LIMIT 1
      `, id);

      if (existing.length === 0) {
        return res.status(404).json({ error: 'Notice not found' });
      }

      const notice = existing[0];
      const isAuthor = notice.authorId === authUser.id;
      const isDeptHeadOfNotice = isSectionalHead && managedDepartment && 
        (notice.departmentId === managedDepartment.id || notice.departmentName === managedDepartment.name);

      if (!isSuperAdminOrHR && !isAuthor && !isDeptHeadOfNotice) {
        return res.status(403).json({ error: 'Permission denied to delete this notice' });
      }

      await prisma.$executeRawUnsafe(`DELETE FROM "NoticeReadStatus" WHERE "noticeId" = $1`, id);
      await prisma.$executeRawUnsafe(`DELETE FROM "DepartmentNotice" WHERE "id" = $1`, id);

      return res.status(200).json({ success: true, message: 'Notice deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting notice:', error);
      return res.status(500).json({ error: error.message || 'Failed to delete notice' });
    }
  }

  // PATCH: Toggle active status
  if (req.method === 'PATCH') {
    try {
      const { isActive } = req.body;
      await prisma.$executeRawUnsafe(`
        UPDATE "DepartmentNotice" 
        SET "isActive" = $1, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $2
      `, isActive !== false, id);

      return res.status(200).json({ success: true, isActive: isActive !== false });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to update notice' });
    }
  }

  res.setHeader('Allow', ['DELETE', 'PATCH']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}
