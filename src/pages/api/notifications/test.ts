import { NextApiRequest, NextApiResponse } from 'next';
import { initWebPush } from '@/util/notifications';
import prisma from '@/lib/prisma';
import webpush from 'web-push';

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

    // Verify user exists
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Initialize web-push
    initWebPush();

    // Get user's subscriptions
    const subscriptions = await prisma.notificationSubscription.findMany({
      where: {
        userId: userId,
      },
    });

    if (subscriptions.length === 0) {
      return res.status(404).json({ error: 'No subscription found for this user' });
    }

    // Create notification payload
    const payload = JSON.stringify({
      title: 'Test Notification',
      body: 'This is a test notification from your Employee Management System',
      icon: '/favicon.ico',
      data: {
        url: '/dashboard',
      },
      timestamp: Date.now(),
    });

    // Send notification to all user's devices
    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          // Validate subscription data
          if (!subscription.endpoint || !subscription.p256dh || !subscription.auth) {
            console.error(`Invalid subscription data: ${JSON.stringify(subscription)}`);
            
            // Delete invalid subscription
            await prisma.notificationSubscription.delete({
              where: { id: subscription.id },
            });
            
            return { 
              success: false, 
              endpoint: subscription.endpoint || 'unknown', 
              error: 'Invalid subscription data' 
            };
          }
          
          // Create proper PushSubscription object format
          const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            }
          };
          
          // Send notification
          await webpush.sendNotification(pushSubscription, payload);
          console.log(`Successfully sent test notification to ${subscription.endpoint}`);
          
          return { 
            success: true, 
            endpoint: subscription.endpoint 
          };
        } catch (error: any) {
          console.error(`Error sending notification to ${subscription.endpoint || 'unknown'}:`, error);
          
          // If subscription is expired or invalid, remove it
          if (error.statusCode === 404 || error.statusCode === 410) {
            await prisma.notificationSubscription.delete({
              where: { id: subscription.id },
            });
            console.log(`Deleted invalid subscription: ${subscription.endpoint || 'unknown'}`);
          }
          
          return { 
            success: false, 
            endpoint: subscription.endpoint || 'unknown', 
            error: error.message || 'Unknown error' 
          };
        }
      })
    );

    // Log notification to database
    await prisma.notification.create({
      data: {
        title: 'Test Notification',
        body: 'This is a test notification from your Employee Management System',
        icon: '/favicon.ico',
        url: '/dashboard',
        userId: userId,
      },
    });

    // Check if any notifications were successfully sent
    const successfulNotifications = results.filter(
      result => result.status === 'fulfilled' && result.value.success
    );

    if (successfulNotifications.length === 0) {
      return res.status(400).json({ 
        error: 'Failed to send notifications to all devices',
        results
      });
    }

    return res.status(200).json({ 
      success: true, 
      sentCount: successfulNotifications.length,
      totalCount: results.length,
      results 
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}