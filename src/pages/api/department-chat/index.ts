import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getSectionalHeadContext, ensureSectionalHeadAndNewTables } from '@/lib/sectionalHeadDb';
import { broadcastRealtimeEvent } from '@/lib/realtime';

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

  const { user, managedDepartment, isSuperAdminOrHR } = context;

  // GET: List accessible departments for chat
  if (req.method === 'GET') {
    try {
      if (isSuperAdminOrHR) {
        // HR / Super Admin can see and access all departments
        const departments = await prisma.department.findMany({
          select: {
            id: true,
            name: true,
            description: true,
            head: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              }
            },
            _count: {
              select: { employees: true, messages: true }
            }
          },
          orderBy: { name: 'asc' }
        });
        return res.status(200).json({ departments, currentRole: user.role, isSuperAdmin: true });
      }

      // Sectional Head or Regular Employee: Only own department
      const userDeptId = managedDepartment ? managedDepartment.id : user.departmentId;
      if (!userDeptId) {
        return res.status(200).json({ departments: [], currentRole: user.role, isSuperAdmin: false });
      }

      const departments = await prisma.department.findMany({
        where: { id: userDeptId },
        select: {
          id: true,
          name: true,
          description: true,
          head: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            }
          },
          _count: {
            select: { employees: true, messages: true }
          }
        }
      });

      return res.status(200).json({ departments, currentRole: user.role, isSuperAdmin: false });
    } catch (error: any) {
      console.error('Error fetching chat departments:', error);
      return res.status(500).json({ error: 'Failed to fetch departments' });
    }
  }

  // POST: Send message to a department chat
  if (req.method === 'POST') {
    try {
      const { departmentId, message, attachments } = req.body;

      if (!departmentId || !message || !message.trim()) {
        return res.status(400).json({ error: 'Department ID and message content are required' });
      }

      // Check permission: Must be Super Admin / HR OR member/head of this department
      const userDeptId = managedDepartment ? managedDepartment.id : user.departmentId;
      const hasAccess = isSuperAdminOrHR || userDeptId === departmentId;

      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied: You can only chat in your own department' });
      }

      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await prisma.$executeRawUnsafe(`
        INSERT INTO "DepartmentMessage" ("id", "departmentId", "senderId", "message", "attachments", "createdAt", "updatedAt")
        VALUES ($1, $2, $3::uuid, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, msgId, departmentId, authUser.id, message.trim(), attachments || null);

      const createdMessage = {
        id: msgId,
        departmentId,
        senderId: authUser.id,
        message: message.trim(),
        attachments: attachments || null,
        createdAt: new Date(),
        sender: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          position: user.position,
        }
      };

      // Broadcast real-time event
      try {
        broadcastRealtimeEvent('DEPARTMENT_CHAT_MESSAGE', {
          departmentId,
          messageId: msgId,
          senderName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        });
      } catch (_) {}

      return res.status(201).json(createdMessage);
    } catch (error: any) {
      console.error('Error sending department message:', error);
      return res.status(500).json({ error: error.message || 'Failed to send message' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}
