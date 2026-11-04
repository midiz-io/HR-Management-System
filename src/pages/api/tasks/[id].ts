import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
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

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Task ID is required' });
  }

  try {
    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return await getTask(req, res, id, user.id);
      case 'PUT':
        return await updateTask(req, res, id, user.id, dbUser.role);
      case 'DELETE':
        return await deleteTask(req, res, id, user.id, dbUser.role);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Task API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Get a specific task
async function getTask(req: NextApiRequest, res: NextApiResponse, taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
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
          role: true,
        },
      },
    },
  });

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Check if user has access to this task
  if (task.assignedToId !== userId && task.assignedById !== userId) {
    return res.status(403).json({ error: 'You do not have access to this task' });
  }

  return res.status(200).json(task);
}

// Update a specific task
async function updateTask(req: NextApiRequest, res: NextApiResponse, taskId: string, userId: string, userRole: string) {
  const { status, proofImageUrl, rejectionReason, title, description, startDate, deadline, duration } = req.body;

  // Get the task to check permissions
  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const context = await getSectionalHeadContext(userId);
  const isSuperAdminOrHR = context?.isSuperAdminOrHR || userRole === 'SUPER_ADMIN';
  const isSectionalHead = (userRole as string) === 'SECTIONAL_HEAD' || context?.isSectionalHead;
  const managedDeptId = context?.managedDepartment?.id;

  // Fetch assignee info to check if assignee is a Sectional Head or department employee
  const assignee = await prisma.user.findUnique({
    where: { id: task.assignedToId },
    select: { id: true, role: true, departmentId: true, managedDepartment: true }
  });
  const isAssigneeSectionalHead = (assignee?.role as string) === 'SECTIONAL_HEAD' || !!assignee?.managedDepartment;
  const isDeptEmployeeTask = isSectionalHead && managedDeptId && assignee?.departmentId === managedDeptId && task.assignedToId !== userId;

  // RULE: Sectional Heads should not be allowed to edit their own assigned tasks
  if (isSectionalHead && task.assignedToId === userId && (title || description || startDate || deadline || duration)) {
    return res.status(403).json({ error: 'Sectional Heads are not permitted to edit their own assigned tasks' });
  }

  // RULE: Only HR should have access to mark tasks assigned to Sectional Heads as completed
  if (isAssigneeSectionalHead && status === 'COMPLETED' && !isSuperAdminOrHR) {
    return res.status(403).json({ error: 'Only HR (Super Admin) has access to mark tasks assigned to Sectional Heads as completed' });
  }

  // Prepare update data
  const updateData: any = {};

  // Admin/manager or Sectional Head of employee's dept can update task details
  const canEditTaskDetails = (
    isSuperAdminOrHR ||
    ((userRole === 'ADMIN' || userRole === 'MANAGER') && task.assignedById === userId) ||
    isDeptEmployeeTask
  );

  if (canEditTaskDetails) {
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (startDate) updateData.startDate = new Date(startDate);
    if (deadline) updateData.deadline = new Date(deadline);
    if (duration) updateData.duration = parseInt(duration);
  }

  // Status updates permissions
  if (status) {
    if (status === 'IN_PROGRESS') {
      if (task.assignedToId !== userId) {
        return res.status(403).json({ error: 'Only the assigned employee can mark task as in progress' });
      }
      updateData.status = status;
    } else if (status === 'COMPLETED') {
      // Allowed if:
      // 1. HR / Super Admin
      // 2. Sectional Head for employees in their department
      // 3. Regular assigned employee (unless employee is a Sectional Head, which is checked above)
      const canComplete = isSuperAdminOrHR || isDeptEmployeeTask || (task.assignedToId === userId && !isAssigneeSectionalHead);
      if (!canComplete) {
        return res.status(403).json({ error: 'You do not have permission to mark this task as completed' });
      }
      updateData.status = status;
    } else if (status === 'APPROVED' || status === 'REJECTED') {
      // Task creator, Sectional Head of dept, or HR can approve or reject
      const canApprove = isSuperAdminOrHR || isDeptEmployeeTask || task.assignedById === userId;
      if (!canApprove) {
        return res.status(403).json({ error: 'Only the task creator, Sectional Head, or HR can approve or reject tasks' });
      }

      // Rejection requires a reason
      if (status === 'REJECTED' && !rejectionReason) {
        return res.status(400).json({ error: 'Rejection reason is required' });
      }

      updateData.status = status;
      updateData.reviewedAt = new Date();

      if (rejectionReason) {
        updateData.rejectionReason = rejectionReason;
      }
    }
  }

  // Proof image can only be added by the assignee
  if (proofImageUrl && task.assignedToId === userId) {
    updateData.proofImageUrl = proofImageUrl;
  }

  // If no valid updates were provided
  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: 'No valid updates provided' });
  }

  // Update the task
  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: updateData,
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
  });

  return res.status(200).json(updatedTask);
}

// Delete a task (admin/manager only)
async function deleteTask(req: NextApiRequest, res: NextApiResponse, taskId: string, userId: string, userRole: string) {
  // Only admins, super admins, and managers can delete tasks
  if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN' && userRole !== 'MANAGER') {
    return res.status(403).json({ error: 'Only admins, super admins, and managers can delete tasks' });
  }

  // Get the task to check permissions
  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Only the creator can delete the task
  if (task.assignedById !== userId) {
    return res.status(403).json({ error: 'Only the task creator can delete this task' });
  }

  // Delete all messages for this task first
  await prisma.taskMessage.deleteMany({
    where: { taskId },
  });

  // Delete the task
  await prisma.task.delete({
    where: { id: taskId },
  });

  return res.status(200).json({ message: 'Task deleted successfully' });
}