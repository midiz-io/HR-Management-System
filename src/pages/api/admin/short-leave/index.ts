import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { managedDepartment: true }
  });

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.department !== 'HR' && !user.managedDepartment)) {
    return res.status(403).json({ error: 'Forbidden. Admin, HR, or Department Head only.' });
  }

  if (req.method === 'GET') {
    try {
      let where: any = {};

      if (user.role === 'SUPER_ADMIN' || user.department === 'HR') {
        // HR/Super Admin sees everything
        where = {};
      } else if (user.managedDepartment) {
        // Department Head sees requests targeted to DEPT_HEAD in their department
        where = {
          requestTo: 'DEPT_HEAD',
          user: {
            departmentId: user.managedDepartment.id
          }
        };
      } else if (user.role === 'ADMIN') {
        // General Admin sees requests targeted to ADMIN
        where = {
          requestTo: 'ADMIN'
        };
      }

      const requests = await prisma.shortLeaveRequest.findMany({
        where,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              department: true,
              position: true,
              departmentId: true,
            }
          },
          reviewer: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.status(200).json(requests);
    } catch (error) {
      console.error('Error fetching admin short leave requests:', error);
      return res.status(500).json({ error: 'Failed to fetch requests' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { targetUserId, date, leaveType, startTime, endTime, reason, requestTo } = req.body;

      if (!targetUserId || !date || !leaveType) {
        return res.status(400).json({ error: 'Employee, Date, and Leave Type are required' });
      }

      if (leaveType !== 'MORNING' && leaveType !== 'EVENING') {
        return res.status(400).json({ error: 'Invalid leave type' });
      }

      if (requestTo && requestTo !== 'DEPT_HEAD' && requestTo !== 'ADMIN') {
        return res.status(400).json({ error: 'Invalid recipient specified' });
      }

      const employee = await prisma.user.findUnique({
        where: { id: targetUserId },
        include: { assignedDepartment: true }
      });

      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      if (requestTo === 'DEPT_HEAD') {
        if (!employee.assignedDepartment) {
          return res.status(400).json({ error: 'Employee is not assigned to any department.' });
        }
        if (!employee.assignedDepartment.headId) {
          return res.status(400).json({ error: `Employee's department (${employee.assignedDepartment.name}) does not have an assigned Department Head. Please request to Admin.` });
        }
      }

      const newRequest = await prisma.shortLeaveRequest.create({
        data: {
          userId: targetUserId,
          date: new Date(date),
          leaveType,
          startTime,
          endTime,
          reason,
          requestTo: requestTo || 'ADMIN',
          status: 'PENDING'
        }
      });

      return res.status(201).json(newRequest);
    } catch (error) {
      console.error('Error creating admin short leave request:', error);
      return res.status(500).json({ error: 'Failed to create request' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
