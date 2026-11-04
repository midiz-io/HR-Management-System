import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getSectionalHeadContext, ensureSectionalHeadAndNewTables } from '@/lib/sectionalHeadDb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureSectionalHeadAndNewTables();
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
  const isPublisher = isSuperAdminOrHR || isSectionalHead || user.role === 'ADMIN';

  // =========================================================================
  // GET: Fetch notices (Active feed, Unread for popup, or Management view)
  // =========================================================================
  if (req.method === 'GET') {
    try {
      const { unreadOnly, manage } = req.query;

      // 1. Management View (Only for Super Admin, Admin, Sectional Head)
      if (manage === 'true') {
        if (!isPublisher) {
          return res.status(403).json({ error: 'Permission denied' });
        }

        let manageQuery = `
          SELECT * FROM "DepartmentNotice"
          WHERE 1=1
        `;
        const params: any[] = [];

        // Sectional Head only sees notices published for or by their department
        if (!isSuperAdminOrHR && isSectionalHead && managedDepartment) {
          params.push(managedDepartment.id, managedDepartment.name, authUser.id);
          manageQuery += ` AND ("departmentId" = $1 OR "departmentName" = $2 OR "authorId" = $3::uuid)`;
        }

        manageQuery += ` ORDER BY "createdAt" DESC LIMIT 100`;

        const rawNotices: any[] = await prisma.$queryRawUnsafe(manageQuery, ...params);
        const notices = Array.isArray(rawNotices) ? rawNotices.map((n) => ({
          ...n,
          createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString(),
          expiresAt: n.expiresAt ? new Date(n.expiresAt).toISOString() : null,
        })) : [];

        // Fetch all departments for publish dropdown
        let departments: any[] = [];
        try {
          departments = await prisma.department.findMany({
            select: { id: true, name: true }
          });
        } catch (e) {
          departments = await prisma.$queryRawUnsafe(`SELECT "id", "name" FROM "Department" ORDER BY "name" ASC`);
        }
        departments = Array.isArray(departments) ? departments.filter((d) => d && d.id && d.name) : [];

        return res.status(200).json({
          notices,
          departments,
          isPublisher: true,
          isSuperAdminOrHR,
          managedDepartment,
        });
      }

      // 2. Unread Popup View or Department Notice Feed
      // A notice is visible to user if:
      // a) departmentId is NULL or 'ALL' (Company-Wide notice)
      // b) departmentId matches user's departmentId OR departmentName matches user's department
      const userDeptId = (user as any).departmentId || null;
      const userDeptName = user.department || null;

      const isGlobalAdmin = Boolean(isSuperAdminOrHR || user.role === 'ADMIN');

      let noticesQuery = `
        SELECT 
          n.*,
          CASE WHEN r."id" IS NOT NULL THEN TRUE ELSE FALSE END as "isRead"
        FROM "DepartmentNotice" n
        LEFT JOIN "NoticeReadStatus" r ON n."id" = r."noticeId" AND r."userId" = $1::uuid
        WHERE n."isActive" = TRUE
          AND (n."expiresAt" IS NULL OR n."expiresAt" > CURRENT_TIMESTAMP)
          AND (
            $4::boolean = TRUE
            OR n."departmentId" IS NULL 
            OR n."departmentId" = 'ALL'
            OR ( $2::text IS NOT NULL AND n."departmentId" = $2::text )
            OR ( $3::text IS NOT NULL AND LOWER(n."departmentName") = LOWER($3::text) )
          )
      `;

      if (unreadOnly === 'true') {
        noticesQuery += ` AND r."id" IS NULL`;
      }

      noticesQuery += ` ORDER BY 
        CASE n."priority" 
          WHEN 'URGENT' THEN 1 
          WHEN 'IMPORTANT' THEN 2 
          ELSE 3 
        END ASC, 
        n."createdAt" DESC 
        LIMIT 50`;

      const rawNotices: any[] = await prisma.$queryRawUnsafe(noticesQuery, authUser.id, userDeptId, userDeptName, isGlobalAdmin);
      const notices = Array.isArray(rawNotices) ? rawNotices.map((n) => ({
        ...n,
        createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString(),
        expiresAt: n.expiresAt ? new Date(n.expiresAt).toISOString() : null,
      })) : [];

      // Fetch all departments if user is publisher
      let departments: any[] = [];
      if (isPublisher) {
        try {
          departments = await prisma.department.findMany({
            select: { id: true, name: true }
          });
        } catch (e) {
          departments = await prisma.$queryRawUnsafe(`SELECT "id", "name" FROM "Department" ORDER BY "name" ASC`);
        }
        departments = Array.isArray(departments) ? departments.filter((d) => d && d.id && d.name) : [];
      }

      return res.status(200).json({
        notices,
        isPublisher,
        isSuperAdminOrHR,
        userDepartment: userDeptName,
        departments,
      });
    } catch (error: any) {
      console.error('Error fetching department notices:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch notices' });
    }
  }

  // =========================================================================
  // POST: Publish a new department notice
  // =========================================================================
  if (req.method === 'POST') {
    if (!isPublisher) {
      return res.status(403).json({ error: 'Only Super Admin, Admin, or Sectional Heads can publish notices' });
    }

    try {
      const { title, description, imageUrl, departmentId, departmentName, priority, expiresAt } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Notice title is required' });
      }

      if (!description || !description.trim()) {
        return res.status(400).json({ error: 'Notice description is required' });
      }

      // If Sectional Head (and not Super Admin/HR), restrict to their managed department
      let targetDeptId = departmentId;
      let targetDeptName = departmentName;

      if (!isSuperAdminOrHR && isSectionalHead) {
        if (!managedDepartment) {
          return res.status(400).json({ error: 'You are not assigned as head of any department' });
        }
        targetDeptId = managedDepartment.id;
        targetDeptName = managedDepartment.name;
      } else {
        // Super Admin / Admin
        if (!targetDeptId || targetDeptId === 'ALL') {
          targetDeptId = 'ALL';
          targetDeptName = 'All Departments (Company-Wide)';
        }
      }

      const noticeId = `notc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const authorFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
      const authorRoleLabel = isSuperAdminOrHR ? 'HR Administration' : isSectionalHead ? `Sectional Head (${managedDepartment?.name || 'Department'})` : 'Management';

      await prisma.$executeRawUnsafe(`
        INSERT INTO "DepartmentNotice" (
          "id", "title", "description", "imageUrl", "departmentId", "departmentName",
          "priority", "authorId", "authorName", "authorRole", "isActive", "expiresAt",
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::uuid, $9, $10, TRUE, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `, 
        noticeId, 
        title.trim(), 
        description.trim(), 
        imageUrl ? imageUrl.trim() : null, 
        targetDeptId, 
        targetDeptName, 
        priority || 'NORMAL', 
        authUser.id, 
        authorFullName, 
        authorRoleLabel, 
        expiresAt ? new Date(expiresAt) : null
      );

      const createdNotice = {
        id: noticeId,
        title: title.trim(),
        description: description.trim(),
        imageUrl: imageUrl ? imageUrl.trim() : null,
        departmentId: targetDeptId,
        departmentName: targetDeptName,
        priority: priority || 'NORMAL',
        authorId: authUser.id,
        authorName: authorFullName,
        authorRole: authorRoleLabel,
        isActive: true,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        createdAt: new Date().toISOString(),
      };

      return res.status(201).json({
        success: true,
        message: 'Department notice published successfully!',
        notice: createdNotice,
      });
    } catch (error: any) {
      console.error('Error publishing notice:', error);
      return res.status(500).json({ error: error.message || 'Failed to publish notice' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}
