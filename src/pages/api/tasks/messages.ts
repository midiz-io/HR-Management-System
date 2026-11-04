import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Create Supabase client
  const supabase = createClient(req, res);

  // Get the user from the session
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return await getMessages(req, res, user.id);
      case 'POST':
        return await createMessage(req, res, user.id);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Task Messages API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Get messages for a specific task
async function getMessages(req: NextApiRequest, res: NextApiResponse, userId: string) {
  const { taskId } = req.query;

  if (!taskId) {
    return res.status(400).json({ error: 'Task ID is required' });
  }

  // Check if user has access to this task
  const task = await prisma.task.findUnique({
    where: { id: taskId as string },
  });

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // User must be either the assignee, the creator of the task, or a super admin
  const userData = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (task.assignedToId !== userId && task.assignedById !== userId && (userData?.role as any) !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'You do not have access to this task' });
  }

  // Get messages for the task
  const messages = await prisma.taskMessage.findMany({
    where: { taskId: taskId as string },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return res.status(200).json(messages);
}

// Create a new message
async function createMessage(req: NextApiRequest, res: NextApiResponse, userId: string) {
  const { taskId, message } = req.body;

  if (!taskId || !message) {
    return res.status(400).json({ error: 'Task ID and message are required' });
  }

  // Check if user has access to this task
  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // User must be either the assignee, the creator of the task, or a super admin
  const userData = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (task.assignedToId !== userId && task.assignedById !== userId && (userData?.role as any) !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'You do not have access to this task' });
  }

  // Create the message
  const newMessage = await prisma.taskMessage.create({
    data: {
      taskId,
      userId,
      message,
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
    },
  });

  broadcastRealtimeEvent('CHAT_MESSAGE', { taskId, messageId: newMessage.id });
  return res.status(201).json(newMessage);
}