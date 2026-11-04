import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user ID and endpoint from request body
    const { endpoint, userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    if (!endpoint) {
      return res.status(400).json({ error: 'Missing subscription endpoint' });
    }

    // Verify user exists
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete subscription from database
    const result = await prisma.notificationSubscription.deleteMany({
      where: {
        endpoint: endpoint,
        userId: userId,
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error unsubscribing from notifications:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}