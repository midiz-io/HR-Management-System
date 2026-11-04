import { NextApiRequest, NextApiResponse } from 'next';
import { generateAndSendDailyAttendanceReport } from '@/util/notifications';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user ID from request body
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if user exists and is admin
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userData.role !== 'ADMIN' && (userData.role as any) !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    // Generate and send daily attendance report
    const result = await generateAndSendDailyAttendanceReport();

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(200).json({
      success: true,
      reportId: result.reportId,
      notificationResult: result.notificationResult
    });
  } catch (error) {
    console.error('Error generating daily report:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}