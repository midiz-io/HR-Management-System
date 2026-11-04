import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the user from the request
    const supabase = createClient(req, res);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if the user is an admin
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!userData || ((userData.role as any) !== 'ADMIN' && (userData.role as any) !== 'SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    const format = (req.query.format as string) || 'json';

    // Fetch all data from the database
    const [
      users,
      locations,
      attendances,
      leaveTypes,
      leaveRequests,
      leaveBalances,
      leaveDocuments,
      workShifts,
      rosters,
      notificationSubscriptions,
      notifications,
      dailyReports,
      tasks,
      taskMessages,
    ] = await Promise.all([
      prisma.user.findMany({
        include: {
          attendances: true,
          locations: true,
          leaveRequests: true,
          leaveBalances: true,
          reviewedLeaves: true,
          workShifts: true,
          rosters: true,
          notifications: true,
          assignedTasks: true,
          createdTasks: true,
          taskMessages: true,
        },
      }),
      prisma.location.findMany({
        include: {
          attendances: true,
          admins: true,
        },
      }),
      prisma.attendance.findMany({
        include: {
          user: true,
          location: true,
        },
      }),
      prisma.leaveType.findMany({
        include: {
          leaveRequests: true,
          leaveBalances: true,
        },
      }),
      prisma.leaveRequest.findMany({
        include: {
          user: true,
          leaveType: true,
          reviewer: true,
          documents: true,
        },
      }),
      prisma.leaveBalance.findMany({
        include: {
          user: true,
          leaveType: true,
        },
      }),
      prisma.leaveDocument.findMany({
        include: {
          leaveRequest: true,
        },
      }),
      prisma.workShift.findMany({
        include: {
          employees: true,
          rosters: true,
        },
      }),
      prisma.roster.findMany({
        include: {
          user: true,
          workShift: true,
        },
      }),
      prisma.notificationSubscription.findMany({
        include: {
          user: true,
        },
      }),
      prisma.notification.findMany(),
      prisma.dailyReport.findMany(),
      prisma.task.findMany({
        include: {
          assignedTo: true,
          assignedBy: true,
          taskMessages: true,
        },
      }),
      prisma.taskMessage.findMany({
        include: {
          task: true,
          user: true,
        },
      }),
    ]);

    const backup = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: '1.0',
        databaseType: 'PostgreSQL',
        recordCounts: {
          users: users.length,
          locations: locations.length,
          attendances: attendances.length,
          leaveTypes: leaveTypes.length,
          leaveRequests: leaveRequests.length,
          leaveBalances: leaveBalances.length,
          leaveDocuments: leaveDocuments.length,
          workShifts: workShifts.length,
          rosters: rosters.length,
          notificationSubscriptions: notificationSubscriptions.length,
          notifications: notifications.length,
          dailyReports: dailyReports.length,
          tasks: tasks.length,
          taskMessages: taskMessages.length,
        },
      },
      data: {
        users,
        locations,
        attendances,
        leaveTypes,
        leaveRequests,
        leaveBalances,
        leaveDocuments,
        workShifts,
        rosters,
        notificationSubscriptions,
        notifications,
        dailyReports,
        tasks,
        taskMessages,
      },
    };

    if (format === 'json') {
      // Return JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=database_backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.json`
      );
      return res.status(200).json(backup);
    }

    return res.status(200).json(backup);
  } catch (error) {
    console.error('Database backup error:', error);
    return res.status(500).json({
      error: 'Failed to create database backup',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
