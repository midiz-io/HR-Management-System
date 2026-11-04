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

  // Get the work shift ID from the request
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid work shift ID' });
  }

  // Handle GET request - Get a specific work shift
  if (req.method === 'GET') {
    try {
      const workShift = await prisma.workShift.findUnique({
        where: { id },
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

      if (!workShift) {
        return res.status(404).json({ error: 'Work shift not found' });
      }

      return res.status(200).json(workShift);
    } catch (error) {
      console.error('Error fetching work shift:', error);
      return res.status(500).json({
        error: 'Failed to fetch work shift',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Handle PUT request - Update a work shift
  if (req.method === 'PUT') {
    try {
      const { name, description, startTime, endTime, days, employeeIds } = req.body;

      console.log('Updating work shift:', { id, name, description, startTime, endTime, days, employeeIds });

      // Validate required fields
      if (!name || !startTime || !endTime || !days || !Array.isArray(days)) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // First, check if the work shift exists
      const workShift = await prisma.workShift.findUnique({
        where: { id }
      });

      if (!workShift) {
        return res.status(404).json({ error: 'Work shift not found' });
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

      // Get current employees to determine what needs to be added/removed
      const currentWorkShift = await prisma.workShift.findUnique({
        where: { id },
        select: {
          employees: {
            select: { id: true },
          },
        },
      });

      const currentEmployeeIds = currentWorkShift?.employees.map((emp: { id: string }) => emp.id) || [];
      const employeesToAdd = validEmployeeIds.filter((id: string) => !currentEmployeeIds.includes(id));
      const employeesToRemove = currentEmployeeIds.filter((id: string) => !validEmployeeIds.includes(id));

      // Update the work shift and manage employees relationship to avoid replica identity issues
      const updatedWorkShift = await prisma.workShift.update({
        where: { id },
        data: {
          name,
          description,
          startTime,
          endTime,
          days: {
            set: days,
          },
          employees: {
            // Disconnect employees that should be removed
            disconnect: employeesToRemove.map((empId: string) => ({ id: empId })),
            // Connect employees that should be added
            connect: employeesToAdd.map((empId: string) => ({ id: empId })),
          },
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

      console.log('Work shift updated successfully');
      return res.status(200).json(updatedWorkShift);
    } catch (error) {
      console.error('Error updating work shift:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: 'Failed to update work shift',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Handle DELETE request - Delete a work shift
  if (req.method === 'DELETE') {
    try {
      // Check if the work shift exists and get its employees
      const workShift = await prisma.workShift.findUnique({
        where: { id },
        include: {
          employees: {
            select: { id: true },
          },
        },
      });

      if (!workShift) {
        return res.status(404).json({ error: 'Work shift not found' });
      }

      // Delete any associated rosters first
      await prisma.roster.deleteMany({
        where: { workShiftId: id }
      });

      // Set replica identity on junction table to allow deletes (if not already set)
      // This is needed when PostgreSQL has logical replication enabled
      try {
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "_EmployeeWorkShifts" REPLICA IDENTITY FULL'
        );
      } catch (alterError: any) {
        // Ignore error if replica identity is already set or if we don't have permission
        // This is safe to ignore as it just means the table might already be configured
        console.log('Replica identity setting (non-critical):', alterError?.message);
      }

      // Delete from junction table directly using raw SQL
      if (workShift.employees.length > 0) {
        await prisma.$executeRawUnsafe(
          'DELETE FROM "_EmployeeWorkShifts" WHERE "B"::uuid = $1::uuid',
          id
        );
      }

      // Now delete the work shift (junction table is already cleaned up)
      await prisma.workShift.delete({
        where: { id }
      });

      return res.status(200).json({ message: 'Work shift deleted successfully' });
    } catch (error) {
      console.error('Error deleting work shift:', error);
      return res.status(500).json({
        error: 'Failed to delete work shift',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Return 405 for other methods
  return res.status(405).json({ error: 'Method not allowed' });
}