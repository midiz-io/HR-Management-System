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

  if (!userData || (userData.role !== 'ADMIN' && (userData.role as any) !== 'SUPER_ADMIN')) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  // Handle GET request - Get all rosters
  if (req.method === 'GET') {
    try {
      const { userId, workShiftId, startDate, endDate } = req.query;

      // Build the where clause based on query parameters
      let where: any = {};

      if (userId && typeof userId === 'string') {
        where.userId = userId;
      }

      if (workShiftId && typeof workShiftId === 'string') {
        where.workShiftId = workShiftId;
      }

      if (startDate && typeof startDate === 'string') {
        where.startDate = {
          gte: new Date(startDate),
        };
      }

      if (endDate && typeof endDate === 'string') {
        where.endDate = {
          lte: new Date(endDate),
        };
      }

      const rosters = await prisma.roster.findMany({
        where,
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
        orderBy: { startDate: 'desc' },
      });

      return res.status(200).json(rosters);
    } catch (error) {
      console.error('Error fetching rosters:', error);
      return res.status(500).json({ error: 'Failed to fetch rosters' });
    }
  }

  // Handle POST request - Create a new roster
  if (req.method === 'POST') {
    try {
      const { userId, workShiftId, startDate, endDate, notes } = req.body;

      // Validate required fields
      if (!userId || !workShiftId || !startDate) {
        return res.status(400).json({ error: 'Missing required fields' });
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

      // Create roster
      const roster = await prisma.roster.create({
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

      return res.status(201).json(roster);
    } catch (error) {
      console.error('Error creating roster:', error);
      return res.status(500).json({ error: 'Failed to create roster' });
    }
  }

  // Return 405 for other methods
  return res.status(405).json({ error: 'Method not allowed' });
}