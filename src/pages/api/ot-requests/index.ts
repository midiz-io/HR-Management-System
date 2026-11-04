import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { sendNotificationToRole, sendNotificationToUser } from '@/util/notifications';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    include: { managedDepartment: true }
  });

  if (!userData) {
    return res.status(404).json({ error: 'User not found' });
  }

  const userRole = userData.role;

  // GET - Fetch OT requests
  if (req.method === 'GET') {
    try {
      const { status, userId: queryUserId } = req.query;
      const where: any = {};

      if (status) where.status = status;

      // Filter logic
      if (userRole === 'EMPLOYEE') {
        where.userId = userId;
      } else if (userRole === 'ADMIN') {
        // If Admin is a Department Head, only show their department's employees
        if (userData.managedDepartment) {
          where.user = {
            departmentId: userData.managedDepartment.id
          };
        } else {
          // If not a head, maybe show all (original behavior) or nothing?
          // The user wants Dept Heads to be responsible.
          // Let's allow all for now or restricted if they manage a dept.
          where.OR = [
            { user: { role: 'EMPLOYEE' } },
            { userId: userId }
          ];
        }
      } else if (userRole === 'SUPER_ADMIN') {
        // Show all
        if (queryUserId) where.userId = queryUserId;
      }

      const otRequests = await prisma.oTRequest.findMany({
        where,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              department: true
            }
          },
          reviewer: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return res.status(200).json(otRequests);
    } catch (error) {
      console.error('Error fetching OT requests:', error);
      return res.status(500).json({ error: 'Failed to fetch OT requests' });
    }
  }

  // POST - Create OT request
  if (req.method === 'POST') {
    try {
      const { date, startTime, endTime, totalHours, reason } = req.body;

      if (!date || !startTime || !endTime || !totalHours || !reason) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      const otRequest = await prisma.oTRequest.create({
        data: {
          userId,
          date: new Date(date),
          startTime,
          endTime,
          totalHours: parseFloat(totalHours),
          reason
        },
        include: {
          user: true
        }
      });

      // Notify Admin/Head
      const userName = `${otRequest.user.firstName || ''} ${otRequest.user.lastName || ''}`.trim() || otRequest.user.email;
      
      // If user has a department head, notify them specifically?
      // For now, notify all ADMINs (or filter in notification logic)
      await sendNotificationToRole(
        'ADMIN',
        `New OT Request: ${userName}`,
        `${userName} requested ${totalHours} hours of OT on ${new Date(date).toLocaleDateString()}.`,
        { url: '/admin-dashboard?tab=ot', tag: 'ot-request' }
      );

      return res.status(201).json(otRequest);
    } catch (error) {
      console.error('Error creating OT request:', error);
      return res.status(500).json({ error: 'Failed to create OT request' });
    }
  }

  // PUT - Update OT request status
  if (req.method === 'PUT') {
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      const { id, status, rejectionReason } = req.body;

      const otRequest = await prisma.oTRequest.findUnique({
        where: { id },
        include: { user: true }
      });

      if (!otRequest) {
        return res.status(404).json({ error: 'OT request not found' });
      }

      // Check if Admin is the head of the employee's department
      if (userRole === 'ADMIN' && userData.managedDepartment) {
        if (otRequest.user.departmentId !== userData.managedDepartment.id) {
          return res.status(403).json({ error: 'You can only review requests for your department' });
        }
      }

      const updated = await prisma.oTRequest.update({
        where: { id },
        data: {
          status,
          reviewerId: userId,
          reviewedAt: new Date(),
          rejectionReason: status === 'REJECTED' ? rejectionReason : null
        }
      });

      // Notify User
      await sendNotificationToUser(
        otRequest.userId,
        `OT Request ${status}`,
        `Your OT request for ${otRequest.totalHours} hours on ${new Date(otRequest.date).toLocaleDateString()} has been ${status.toLowerCase()}.`,
        { url: '/dashboard?tab=ot', tag: 'ot-update' }
      );

      return res.status(200).json(updated);
    } catch (error) {
      console.error('Error updating OT request:', error);
      return res.status(500).json({ error: 'Failed to update OT request' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
