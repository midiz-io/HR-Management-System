import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getSectionalHeadContext, ensureSectionalHeadAndNewTables } from '@/lib/sectionalHeadDb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureSectionalHeadAndNewTables();
  const { departmentId } = req.query;

  if (!departmentId || typeof departmentId !== 'string') {
    return res.status(400).json({ error: 'Valid department ID is required' });
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

  const { user, managedDepartment, isSuperAdminOrHR } = context;

  // Verify access: Super Admin / HR can access any department, otherwise must be own department
  const userDeptId = managedDepartment ? managedDepartment.id : user.departmentId;
  const hasAccess = isSuperAdminOrHR || userDeptId === departmentId;

  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied: You can only view chat for your own department' });
  }

  if (req.method === 'GET') {
    try {
      const messagesRaw: any[] = await prisma.$queryRawUnsafe(`
        SELECT 
          m."id",
          m."departmentId",
          m."senderId",
          m."message",
          m."attachments",
          m."createdAt",
          u."firstName",
          u."lastName",
          u."email",
          u."role"::text as "role",
          u."position",
          u."profileImage"
        FROM "DepartmentMessage" m
        JOIN "User" u ON m."senderId" = u."id"
        WHERE m."departmentId" = $1
        ORDER BY m."createdAt" ASC
        LIMIT 150
      `, departmentId);

      const formatted = messagesRaw.map(m => ({
        id: m.id,
        departmentId: m.departmentId,
        senderId: m.senderId,
        message: m.message,
        attachments: m.attachments,
        createdAt: m.createdAt,
        sender: {
          id: m.senderId,
          firstName: m.firstName,
          lastName: m.lastName,
          email: m.email,
          role: m.role,
          position: m.position,
          profileImage: m.profileImage,
        }
      }));

      // Get department info
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
        select: { id: true, name: true, description: true }
      });

      return res.status(200).json({
        department,
        messages: formatted
      });
    } catch (error: any) {
      console.error('Error fetching department messages:', error);
      return res.status(500).json({ error: 'Failed to load department messages' });
    }
  }

  res.setHeader('Allow', ['GET']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}
