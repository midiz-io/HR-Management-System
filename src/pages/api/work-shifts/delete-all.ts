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
    // Get all work shifts to count them
    const workShifts = await prisma.workShift.findMany({
      select: { id: true }
    });

    if (workShifts.length === 0) {
      return res.status(200).json({
        message: 'No work shifts to delete',
        deletedCount: 0
      });
    }

    // Delete all rosters first (no replica identity issues here)
    await prisma.roster.deleteMany({});

    // Count for response
    const deletedCount = workShifts.length;

    // Use direct SQL to avoid replica identity issues
    // This is a safer approach that bypasses Prisma's ORM layer for this specific operation
    await prisma.$executeRaw`TRUNCATE TABLE "WorkShift" CASCADE`;

    // Return success
    return res.status(200).json({
      message: `Successfully deleted ${deletedCount} work shifts`,
      deletedCount: deletedCount
    });
  } catch (error) {
    console.error('Error deleting all work shifts:', error);
    return res.status(500).json({
      error: 'Failed to delete all work shifts',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}