import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  if (req.method === 'GET') {
    try {
      const requests = await prisma.shortLeaveRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });
      return res.status(200).json(requests);
    } catch (error) {
      console.error('Error fetching short leave requests:', error);
      return res.status(500).json({ error: 'Failed to fetch requests' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { date, leaveType, startTime, endTime, reason, requestTo } = req.body;

      if (!date || !leaveType) {
        return res.status(400).json({ error: 'Date and Leave Type are required' });
      }

      if (leaveType !== 'MORNING' && leaveType !== 'EVENING') {
        return res.status(400).json({ error: 'Invalid leave type' });
      }

      if (requestTo && requestTo !== 'DEPT_HEAD' && requestTo !== 'ADMIN') {
        return res.status(400).json({ error: 'Invalid recipient specified' });
      }

      if (requestTo === 'DEPT_HEAD') {
        const employee = await prisma.user.findUnique({
          where: { id: userId },
          include: { assignedDepartment: true }
        });
        if (!employee?.assignedDepartment) {
          return res.status(400).json({ error: 'You are not assigned to any department.' });
        }
        if (!employee.assignedDepartment.headId) {
          return res.status(400).json({ error: `Your department (${employee.assignedDepartment.name}) does not have an assigned Department Head. Please request to Admin.` });
        }
      }

      const newRequest = await prisma.shortLeaveRequest.create({
        data: {
          userId,
          date: new Date(date),
          leaveType,
          startTime,
          endTime,
          reason,
          requestTo: requestTo || 'ADMIN'
        }
      });

      return res.status(201).json(newRequest);
    } catch (error) {
      console.error('Error creating short leave request:', error);
      return res.status(500).json({ error: 'Failed to create request' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
