import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Get the user from the request
  const supabase = createClient(req, res);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if the user is an admin
  const userData = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!userData || ((userData.role as any) !== 'ADMIN' && (userData.role as any) !== 'SUPER_ADMIN')) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  // Get the roster ID from the request
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid roster ID' });
  }

  // Handle GET request - Get a specific roster
  if (req.method === 'GET') {
    try {
      const roster = await prisma.roster.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          workShift: true,
        },
      });

      if (!roster) {
        return res.status(404).json({ error: 'Roster not found' });
      }

      return res.status(200).json(roster);
    } catch (error) {
      console.error('Error fetching roster:', error);
      return res.status(500).json({ error: 'Failed to fetch roster' });
    }
  }

  // Handle PUT request - Update a roster
  if (req.method === 'PUT') {
    try {
      const { userId, workShiftId, startDate, endDate, notes } = req.body;

      // Validate required fields
      if (!userId || !workShiftId || !startDate) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Check if roster exists
      const existingRoster = await prisma.roster.findUnique({
        where: { id },
      });

      if (!existingRoster) {
        return res.status(404).json({ error: 'Roster not found' });
      }

      // Check if user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if work shift exists
      const workShift = await prisma.workShift.findUnique({
        where: { id: workShiftId },
      });

      if (!workShift) {
        return res.status(404).json({ error: 'Work shift not found' });
      }

      // Update the roster
      const updatedRoster = await prisma.roster.update({
        where: { id },
        data: {
          userId,
          workShiftId,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          notes,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          workShift: true,
        },
      });

      return res.status(200).json(updatedRoster);
    } catch (error) {
      console.error('Error updating roster:', error);
      return res.status(500).json({ error: 'Failed to update roster' });
    }
  }

  // Handle DELETE request - Delete a roster
  if (req.method === 'DELETE') {
    try {
      // Check if the roster exists
      const roster = await prisma.roster.findUnique({
        where: { id },
      });

      if (!roster) {
        return res.status(404).json({ error: 'Roster not found' });
      }

      // Delete the roster
      await prisma.roster.delete({
        where: { id },
      });

      return res.status(200).json({ message: 'Roster deleted successfully' });
    } catch (error) {
      console.error('Error deleting roster:', error);
      return res.status(500).json({ error: 'Failed to delete roster' });
    }
  }

  // Return 405 for other methods
  return res.status(405).json({ error: 'Method not allowed' });
}