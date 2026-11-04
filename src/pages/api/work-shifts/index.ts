import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check authentication
  try {
    const supabase = createClient(req, res);
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      console.error('Authentication error:', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if the user is an admin
    const userData = await prisma.user.findUnique({
      where: { id: data.user.id },
    });

    if (!userData || ((userData.role as any) !== 'ADMIN' && (userData.role as any) !== 'SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
  } catch (authError) {
    console.error('Error in authentication:', authError);
    return res.status(401).json({ error: 'Authentication failed' });
  }

  // Handle GET request - Get all work shifts
  if (req.method === 'GET') {
    try {
      const workShifts = await prisma.workShift.findMany({
        include: {
          employees: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      return res.status(200).json(workShifts);
    } catch (error) {
      console.error('Error fetching work shifts:', error);
      return res.status(500).json({
        error: 'Failed to fetch work shifts',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Handle POST request - Create a new work shift
  if (req.method === 'POST') {
    try {
      const { name, description, startTime, endTime, days, employeeIds } = req.body;

      // Validate required fields
      if (!name || !startTime || !endTime || !days || !Array.isArray(days)) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Clean and validate employee IDs (dedupe and ensure users exist)
      let validEmployeeIds: string[] = [];
      if (employeeIds && Array.isArray(employeeIds) && employeeIds.length > 0) {
        // Remove duplicates
        const uniqueIds = Array.from(new Set(employeeIds as string[]));

        // Keep only IDs that actually exist in the User table
        const existingUsers = await prisma.user.findMany({
          where: { id: { in: uniqueIds } },
          select: { id: true },
        });

        validEmployeeIds = existingUsers.map((u: { id: string }) => u.id);
      }

      // Create the work shift
      const workShift = await prisma.workShift.create({
        data: {
          name,
          description,
          startTime,
          endTime,
          days,
          ...(validEmployeeIds.length > 0
            ? {
              employees: {
                connect: validEmployeeIds.map((id: string) => ({ id })),
              },
            }
            : {}),
        },
        include: {
          employees: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      return res.status(201).json(workShift);
    } catch (error) {
      console.error('Error creating work shift:', error);
      return res.status(500).json({
        error: 'Failed to create work shift',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Return 405 for other methods
  return res.status(405).json({ error: 'Method not allowed' });
}