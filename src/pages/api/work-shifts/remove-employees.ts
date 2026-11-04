import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

  try {
    const { workShiftId } = req.body;

    if (!workShiftId) {
      return res.status(400).json({ error: 'Work shift ID is required' });
    }

    // Get the work shift with its employees
    const workShift = await prisma.workShift.findUnique({
      where: { id: workShiftId },
      include: {
        employees: {
          select: { id: true }
        }
      }
    });

    if (!workShift) {
      return res.status(404).json({ error: 'Work shift not found' });
    }

    // If there are no employees, nothing to do
    if (workShift.employees.length === 0) {
      return res.status(200).json({
        message: 'No employees to remove',
        removedCount: 0
      });
    }

    // Use direct SQL to remove all employee relationships
    await prisma.$executeRaw`DELETE FROM "_EmployeeWorkShifts" WHERE "B" = ${workShiftId}::uuid`;

    return res.status(200).json({
      message: 'Successfully removed all employee relationships from work shift',
      removedCount: workShift.employees.length
    });
  } catch (error) {
    console.error('Error removing employees from work shift:', error);
    return res.status(500).json({
      error: 'Failed to remove employees from work shift',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}