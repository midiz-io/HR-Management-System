import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { getSectionalHeadContext } from '@/lib/sectionalHeadDb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Create Supabase client
  const supabase = createClient(req, res);

  // Get the user from the session
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get user with role from database
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true }
  });

  if (!dbUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  try {
    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return await getTasks(req, res, user.id, dbUser.role);
      case 'POST':
        return await createTask(req, res, user.id, dbUser.role);
      case 'PUT':
        return await updateTask(req, res, user.id, dbUser.role);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Task API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Get tasks based on user role
async function getTasks(req: NextApiRequest, res: NextApiResponse, userId: string, userRole: string) {
  const { status, employeeId } = req.query;

  let whereClause: any = {};

  // Filter by status if provided
  if (status && status !== 'ALL') {
    whereClause.status = status;
  }

  const context = await getSectionalHeadContext(userId);
  const isSectionalHead = (userRole as string) === 'SECTIONAL_HEAD' || context?.isSectionalHead;
  const isGlobalAdmin = userRole === 'ADMIN' || userRole === 'MANAGER' || (userRole as any) === 'SUPER_ADMIN';

  // For admin/manager/super_admin/sectional_head
  if (isGlobalAdmin || isSectionalHead) {
    if (employeeId && employeeId !== 'ALL_EMPLOYEES') {
      whereClause.assignedToId = employeeId as string;
    } else if (isSectionalHead && context?.managedDepartment) {
      // Sectional Head sees tasks assigned to self, created by self, or assigned to employees in own department
      whereClause.OR = [
        { assignedToId: userId },
        { assignedById: userId },
        { assignedTo: { departmentId: context.managedDepartment.id } },
      ];
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json(tasks);
  } else {
    // For employees, only show tasks assigned to them
    const tasks = await prisma.task.findMany({
      where: {
        ...whereClause,
        assignedToId: userId,
      },
      include: {
        assignedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json(tasks);
  }
}

// Create a new task (admin/manager/super_admin/sectional_head)
async function createTask(req: NextApiRequest, res: NextApiResponse, userId: string, userRole: string) {
  const context = await getSectionalHeadContext(userId);
  const isSectionalHead = (userRole as string) === 'SECTIONAL_HEAD' || context?.isSectionalHead;
  const isGlobalAdmin = userRole === 'ADMIN' || userRole === 'MANAGER' || (userRole as any) === 'SUPER_ADMIN';

  if (!isGlobalAdmin && !isSectionalHead) {
    return res.status(403).json({ error: 'Only admins, managers, super admins, and sectional heads can create tasks' });
  }

  const { title, description, assignedToId, assignToAll, startDate, deadline, duration } = req.body;

  // Validate required fields
  if (!title || !description || (!assignedToId && !assignToAll) || !startDate || !deadline || !duration) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Sectional Head restriction: Can only assign to employees in their own department or to themselves
  if (isSectionalHead && !isGlobalAdmin) {
    if (assignToAll) {
      return res.status(403).json({ error: 'Sectional Heads cannot assign tasks to all company employees' });
    }
    if (assignedToId !== userId) {
      const targetUser = await prisma.user.findUnique({
        where: { id: assignedToId },
        select: { departmentId: true }
      });
      if (!context?.managedDepartment || targetUser?.departmentId !== context.managedDepartment.id) {
        return res.status(403).json({ error: 'Sectional Heads can only assign tasks to employees within their own department or to themselves' });
      }
    }
  }

  const parsedDuration = parseInt(String(duration), 10);

  // If assignToAll or assignedToId === 'ALL_EMPLOYEES', assign to all active employees
  if (assignToAll || assignedToId === 'ALL_EMPLOYEES') {
    const allEmployees = await prisma.user.findMany({
      where: {
        role: { in: ['EMPLOYEE', 'ADMIN'] }
      },
      select: { id: true }
    });

    const tasksData = allEmployees.map(emp => ({
      title,
      description,
      assignedToId: emp.id,
      assignedById: userId,
      startDate: new Date(startDate),
      deadline: new Date(deadline),
      duration: parsedDuration,
      status: 'ASSIGNED' as const,
    }));

    await prisma.task.createMany({
      data: tasksData,
    });

    broadcastRealtimeEvent('TASK_UPDATED', { action: 'BULK_CREATE', count: tasksData.length });
    return res.status(201).json({ message: `Tasks successfully created for ${tasksData.length} employees` });
  }

  // Single employee task creation
  const task = await prisma.task.create({
    data: {
      title,
      description,
      assignedToId,
      assignedById: userId,
      startDate: new Date(startDate),
      deadline: new Date(deadline),
      duration: parsedDuration,
      status: 'ASSIGNED',
    },
  });

  broadcastRealtimeEvent('TASK_UPDATED', { action: 'CREATE', taskId: task.id });
  return res.status(201).json(task);
}

// Update a task
async function updateTask(req: NextApiRequest, res: NextApiResponse, userId: string, userRole: string) {
  const { id, status, proofImageUrl, rejectionReason } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Task ID is required' });
  }

  // Get the task to check permissions
  const task = await prisma.task.findUnique({
    where: { id },
  });

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Check permissions based on the update being performed
  if (status === 'IN_PROGRESS' || status === 'COMPLETED') {
    // Only the assigned employee can mark as in progress or completed
    if (task.assignedToId !== userId) {
      return res.status(403).json({ error: 'Only the assigned employee can update this task status' });
    }
  } else if (status === 'APPROVED' || status === 'REJECTED') {
    // User must be either the assignee, the creator of the task, or a super admin
    const userData = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (task.assignedToId !== userId && task.assignedById !== userId && (userData?.role as any) !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'You do not have access to this task' });
    }

    // Rejection requires a reason
    if (status === 'REJECTED' && !rejectionReason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }
  }

  // Prepare update data
  const updateData: any = {};

  if (status) {
    updateData.status = status;
  }

  if (proofImageUrl) {
    updateData.proofImageUrl = proofImageUrl;
  }

  if (rejectionReason) {
    updateData.rejectionReason = rejectionReason;
  }

  // Add reviewedAt timestamp for approval/rejection
  if (status === 'APPROVED' || status === 'REJECTED') {
    updateData.reviewedAt = new Date();
  }

  // Update the task
  const updatedTask = await prisma.task.update({
    where: { id },
    data: updateData,
  });

  broadcastRealtimeEvent('TASK_UPDATED', { action: 'UPDATE', taskId: updatedTask.id, status: updatedTask.status });
  return res.status(200).json(updatedTask);
}