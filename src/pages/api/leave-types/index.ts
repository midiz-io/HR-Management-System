import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Create Supabase client with admin privileges
  const supabase = createClient(req, res);

  // Get user from session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  // Get user role
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // GET - Fetch leave types
  if (req.method === 'GET') {
    try {
      const leaveTypes = await prisma.leaveType.findMany({
        orderBy: { name: 'asc' }
      });

      return res.status(200).json(leaveTypes);
    } catch (error) {
      console.error('Error fetching leave types:', error);
      return res.status(500).json({ error: 'Failed to fetch leave types' });
    }
  }

  // POST - Create a new leave type (admin only)
  else if (req.method === 'POST') {
    // Check if user is admin or super admin
    if (user.role !== 'ADMIN' && (user.role as any) !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only admins and super admins can create leave types' });
    }

    try {
      const { name, description, color } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Leave type name is required' });
      }

      const leaveType = await prisma.leaveType.create({
        data: {
          name,
          description,
          color
        }
      });

      return res.status(201).json(leaveType);
    } catch (error) {
      console.error('Error creating leave type:', error);
      return res.status(500).json({ error: 'Failed to create leave type' });
    }
  }

  // PUT - Update a leave type (admin only)
  else if (req.method === 'PUT') {
    // Check if user is admin or super admin
    if (user.role !== 'ADMIN' && (user.role as any) !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only admins and super admins can update leave types' });
    }

    try {
      const { id, name, description, color } = req.body;

      if (!id || !name) {
        return res.status(400).json({ error: 'Leave type ID and name are required' });
      }

      const leaveType = await prisma.leaveType.update({
        where: { id },
        data: {
          name,
          description,
          color
        }
      });

      return res.status(200).json(leaveType);
    } catch (error) {
      console.error('Error updating leave type:', error);
      return res.status(500).json({ error: 'Failed to update leave type' });
    }
  }

  // DELETE - Delete a leave type (admin only)
  else if (req.method === 'DELETE') {
    // Check if user is admin or super admin
    if (user.role !== 'ADMIN' && (user.role as any) !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only admins and super admins can delete leave types' });
    }

    try {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'Leave type ID is required' });
      }

      // Check if leave type is in use
      const leaveRequestCount = await prisma.leaveRequest.count({
        where: { leaveTypeId: id as string }
      });

      if (leaveRequestCount > 0) {
        return res.status(400).json({
          error: 'Cannot delete leave type that is in use by leave requests'
        });
      }

      await prisma.leaveType.delete({
        where: { id: id as string }
      });

      return res.status(200).json({ message: 'Leave type deleted successfully' });
    } catch (error) {
      console.error('Error deleting leave type:', error);
      return res.status(500).json({ error: 'Failed to delete leave type' });
    }
  }

  // Method not allowed
  else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}