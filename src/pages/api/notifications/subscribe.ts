import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user ID and subscription data from request body
    const { subscription, userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription data' });
    }

    // Verify user exists
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Extract keys from subscription
    const { keys } = subscription;
    
    if (!keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: 'Invalid subscription keys' });
    }

    // Save subscription to database
    await prisma.notificationSubscription.upsert({
      where: {
        endpoint: subscription.endpoint,
      },
      update: {
        userId: userId,
        p256dh: keys.p256dh,
        auth: keys.auth,
        expirationTime: subscription.expirationTime ? new Date(subscription.expirationTime) : null,
        updatedAt: new Date(),
      },
      create: {
        userId: userId,
        endpoint: subscription.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        expirationTime: subscription.expirationTime ? new Date(subscription.expirationTime) : null,
      },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error subscribing to notifications:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}