import prisma from '@/lib/prisma';
import webpush from 'web-push';
import { toZonedTime } from 'date-fns-tz';

// Initialize web-push with VAPID keys
export const initWebPush = () => {
  if (!process.env.VAPID_SUBJECT || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    throw new Error('VAPID environment variables are not set');
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
};

// Send notification to a specific user
export const sendNotificationToUser = async (
  userId: string,
  title: string,
  body: string,
  options: {
    icon?: string;
    url?: string;
    tag?: string;
    requireInteraction?: boolean;
    data?: any;
  } = {}
) => {
  try {
    // Initialize web-push
    initWebPush();

    // Get user's subscriptions
    const subscriptions = await prisma.notificationSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) {
      console.log(`No subscriptions found for user ${userId}`);
      return { success: false, error: 'No subscriptions found' };
    }

    // Create notification payload
    const payload = JSON.stringify({
      title,
      body,
      icon: options.icon || '/favicon.ico',
      tag: options.tag || 'default',
      requireInteraction: options.requireInteraction || false,
      data: {
        url: options.url || '/dashboard',
        ...options.data,
      },
      timestamp: Date.now(),
    });

    // Send notification to all user's devices
    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          // Validate subscription data
          if (!subscription.endpoint || !subscription.p256dh || !subscription.auth) {
            console.error(`Invalid subscription data for user ${userId}`);

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
          console.log(`Successfully sent notification to ${userId} at ${subscription.endpoint}`);

          return {
            success: true,
            endpoint: subscription.endpoint
          };
        } catch (error: any) {
          console.error(`Error sending notification to ${userId} at ${subscription.endpoint}:`, error);

          // If subscription is expired or invalid, remove it
          if (error.statusCode === 404 || error.statusCode === 410) {
            await prisma.notificationSubscription.delete({
              where: { id: subscription.id },
            });
            console.log(`Deleted invalid subscription for user ${userId}`);
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
        title,
        body,
        icon: options.icon || '/favicon.ico',
        url: options.url || '/dashboard',
        tag: options.tag,
        userId,
      },
    });

    // Check if any notifications were successfully sent
    const successfulNotifications = results.filter(
      result => result.status === 'fulfilled' && result.value.success
    );

    return {
      success: successfulNotifications.length > 0,
      results,
      sentCount: successfulNotifications.length,
      totalCount: results.length
    };
  } catch (error) {
    console.error('Error in sendNotificationToUser:', error);
    return { success: false, error };
  }
};

// Send notification to all users with a specific role
export const sendNotificationToRole = async (
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE',
  title: string,
  body: string,
  options: {
    icon?: string;
    url?: string;
    tag?: string;
    requireInteraction?: boolean;
    data?: any;
  } = {}
) => {
  try {
    // Get all users with the specified role
    const users = await prisma.user.findMany({
      where: { role },
      select: { id: true },
    });

    if (users.length === 0) {
      console.log(`No users found with role ${role}`);
      return { success: false, error: `No users found with role ${role}` };
    }

    // Send notification to each user
    const results = await Promise.allSettled(
      users.map((user) => sendNotificationToUser(user.id, title, body, options))
    );

    // Count successful notifications
    const successfulNotifications = results.filter(
      result => result.status === 'fulfilled' && result.value.success
    );

    return {
      success: successfulNotifications.length > 0,
      results,
      sentCount: successfulNotifications.length,
      totalCount: users.length
    };
  } catch (error) {
    console.error('Error in sendNotificationToRole:', error);
    return { success: false, error };
  }
};

// Send notification to all users
export const sendNotificationToAll = async (
  title: string,
  body: string,
  options: {
    icon?: string;
    url?: string;
    tag?: string;
    requireInteraction?: boolean;
    data?: any;
  } = {}
) => {
  try {
    // Get all users
    const users = await prisma.user.findMany({
      select: { id: true },
    });

    if (users.length === 0) {
      console.log('No users found');
      return { success: false, error: 'No users found' };
    }

    // Send notification to each user
    const results = await Promise.allSettled(
      users.map((user) => sendNotificationToUser(user.id, title, body, options))
    );

    // Count successful notifications
    const successfulNotifications = results.filter(
      result => result.status === 'fulfilled' && result.value.success
    );

    return {
      success: successfulNotifications.length > 0,
      results,
      sentCount: successfulNotifications.length,
      totalCount: users.length
    };
  } catch (error) {
    console.error('Error in sendNotificationToAll:', error);
    return { success: false, error };
  }
};

// Send notification for check-in events
export const sendCheckInNotification = async (
  userId: string,
  locationName: string,
  checkInTime: Date
) => {
  try {
    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        role: true
      },
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    // Format time in Sri Lankan timezone (Asia/Colombo)
    const formattedTime = new Date(checkInTime).toLocaleTimeString('en-US', {
      timeZone: 'Asia/Colombo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    // Send notification to the user who checked in
    await sendNotificationToUser(
      userId,
      'Check-in Successful',
      `You checked in at ${locationName} at ${formattedTime}`,
      {
        url: '/dashboard?tab=my-attendance',
        tag: 'check-in',
      }
    );

    // If the user is not an admin, also notify admins
    if (user.role !== 'ADMIN') {
      await sendNotificationToRole(
        'ADMIN',
        'Employee Check-in',
        `${userName} checked in at ${locationName} at ${formattedTime}`,
        {
          url: '/admin-dashboard?tab=overview',
          tag: 'employee-check-in',
        }
      );
    }

    return { success: true };
  } catch (error) {
    console.error('Error sending check-in notification:', error);
    return { success: false, error };
  }
};

// Send notification for check-out events
export const sendCheckOutNotification = async (
  userId: string,
  locationName: string,
  checkOutTime: Date,
  duration: number // duration in minutes
) => {
  try {
    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        role: true
      },
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    // Format time in Sri Lankan timezone (Asia/Colombo)
    const formattedTime = new Date(checkOutTime).toLocaleTimeString('en-US', {
      timeZone: 'Asia/Colombo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    // Format duration
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    const durationText = hours > 0
      ? `${hours} hour${hours !== 1 ? 's' : ''} ${minutes > 0 ? `${minutes} minute${minutes !== 1 ? 's' : ''}` : ''}`
      : `${minutes} minute${minutes !== 1 ? 's' : ''}`;

    // Send notification to the user who checked out
    await sendNotificationToUser(
      userId,
      'Check-out Successful',
      `You checked out from ${locationName} at ${formattedTime}. Total duration: ${durationText}`,
      {
        url: '/dashboard?tab=my-attendance',
        tag: 'check-out',
      }
    );

    // If the user is not an admin, also notify admins
    if (user.role !== 'ADMIN') {
      await sendNotificationToRole(
        'ADMIN',
        'Employee Check-out',
        `${userName} checked out from ${locationName} at ${formattedTime}. Total duration: ${durationText}`,
        {
          url: '/admin-dashboard?tab=overview',
          tag: 'employee-check-out',
        }
      );
    }

    return { success: true };
  } catch (error) {
    console.error('Error sending check-out notification:', error);
    return { success: false, error };
  }
};

// Send notification for leave request submission
export const sendLeaveRequestNotification = async (
  leaveRequestId: string
) => {
  try {
    // Get leave request details with user and leave type
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: leaveRequestId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        leaveType: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!leaveRequest) {
      return { success: false, error: 'Leave request not found' };
    }

    const userName = `${leaveRequest.user.firstName || ''} ${leaveRequest.user.lastName || ''}`.trim() || leaveRequest.user.email;
    const startDate = new Date(leaveRequest.startDate).toLocaleDateString();
    const endDate = new Date(leaveRequest.endDate).toLocaleDateString();
    const leaveTypeName = leaveRequest.leaveType.name;

    // Notify admins about the new leave request
    await sendNotificationToRole(
      'ADMIN',
      'New Leave Request',
      `${userName} has requested ${leaveRequest.totalDays} day(s) of ${leaveTypeName} leave from ${startDate} to ${endDate}`,
      {
        url: '/admin-dashboard?tab=leave',
        tag: 'leave-request',
        requireInteraction: true,
      }
    );

    return { success: true };
  } catch (error) {
    console.error('Error sending leave request notification:', error);
    return { success: false, error };
  }
};

// Send notification for leave request status update
export const sendLeaveStatusUpdateNotification = async (
  leaveRequestId: string
) => {
  try {
    // Get leave request details with user, reviewer and leave type
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: leaveRequestId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reviewer: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        leaveType: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!leaveRequest) {
      return { success: false, error: 'Leave request not found' };
    }

    const startDate = new Date(leaveRequest.startDate).toLocaleDateString();
    const endDate = new Date(leaveRequest.endDate).toLocaleDateString();
    const leaveTypeName = leaveRequest.leaveType.name;
    const reviewerName = leaveRequest.reviewer
      ? `${leaveRequest.reviewer.firstName || ''} ${leaveRequest.reviewer.lastName || ''}`.trim() || leaveRequest.reviewer.email
      : 'An administrator';

    let title = '';
    let body = '';

    switch (leaveRequest.status) {
      case 'APPROVED':
        title = 'Leave Request Approved';
        body = `Your request for ${leaveRequest.totalDays} day(s) of ${leaveTypeName} leave from ${startDate} to ${endDate} has been approved by ${reviewerName}`;
        break;
      case 'REJECTED':
        title = 'Leave Request Rejected';
        body = `Your request for ${leaveRequest.totalDays} day(s) of ${leaveTypeName} leave from ${startDate} to ${endDate} has been rejected by ${reviewerName}${leaveRequest.rejectionReason ? `. Reason: ${leaveRequest.rejectionReason}` : ''}`;
        break;
      case 'CANCELLED':
        title = 'Leave Request Cancelled';
        body = `Your request for ${leaveRequest.totalDays} day(s) of ${leaveTypeName} leave from ${startDate} to ${endDate} has been cancelled`;
        break;
      default:
        return { success: false, error: 'Invalid leave status for notification' };
    }

    // Notify the employee about their leave request status
    await sendNotificationToUser(
      leaveRequest.userId,
      title,
      body,
      {
        url: '/dashboard?tab=leave',
        tag: 'leave-status',
        requireInteraction: true,
      }
    );

    return { success: true };
  } catch (error) {
    console.error('Error sending leave status update notification:', error);
    return { success: false, error };
  }
};

// Generate and send daily attendance report
export const generateAndSendDailyAttendanceReport = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all attendance records for today
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        checkInTime: {
          gte: today,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        location: true,
      },
      orderBy: {
        checkInTime: 'asc',
      },
    });

    if (attendanceRecords.length === 0) {
      console.log('No attendance records found for today');
      return { success: false, error: 'No attendance records found for today' };
    }

    // Calculate statistics
    const totalEmployees = await prisma.user.count({
      where: {
        role: 'EMPLOYEE',
      },
    });

    const checkedInCount = new Set(attendanceRecords.map(record => record.userId)).size;
    const lateCount = attendanceRecords.filter(record => record.status === 'LATE').length;
    const checkedOutCount = attendanceRecords.filter(record => record.checkOutTime !== null).length;

    // Create report data
    const reportData = {
      date: today.toISOString(),
      totalEmployees,
      checkedInCount,
      lateCount,
      checkedOutCount,
      attendanceRate: Math.round((checkedInCount / totalEmployees) * 100),
      records: attendanceRecords.map(record => ({
        employeeName: `${record.user.firstName || ''} ${record.user.lastName || ''}`.trim() || record.user.email,
        location: record.location.name,
        checkInTime: record.checkInTime.toISOString(),
        checkOutTime: record.checkOutTime?.toISOString() || null,
        status: record.status,
        duration: record.checkOutTime
          ? Math.round((record.checkOutTime.getTime() - record.checkInTime.getTime()) / (1000 * 60))
          : null,
      })),
    };

    // Save report to database
    const savedReport = await prisma.dailyReport.create({
      data: {
        date: today,
        reportType: 'ATTENDANCE',
        reportData: reportData as any,
      },
    });

    // Send notification to admins
    const notificationResult = await sendNotificationToRole(
      'ADMIN',
      'Daily Attendance Report',
      `Attendance Rate: ${reportData.attendanceRate}% (${checkedInCount}/${totalEmployees}). ${lateCount} employees were late.`,
      {
        url: '/admin-dashboard?tab=reports',
        tag: 'daily-report',
        requireInteraction: true,
        data: {
          reportId: savedReport.id,
          reportType: 'ATTENDANCE',
        },
      }
    );

    // Mark report as sent
    await prisma.dailyReport.update({
      where: {
        id: savedReport.id,
      },
      data: {
        sentToUsers: true,
      },
    });

    return {
      success: true,
      reportId: savedReport.id,
      notificationResult
    };
  } catch (error) {
    console.error('Error generating and sending daily attendance report:', error);
    return { success: false, error };
  }
};

/**
 * Sends a warning notification after 4 days of consecutive late attendance
 */
export const sendLateAttendanceWarning = async (userId: string, count: number) => {
  return sendNotificationToUser(
    userId,
    '⚠️ Late Attendance Warning',
    `You have been late for ${count} consecutive days. Please ensure timely arrival to avoid salary deduction.`,
    {
      tag: 'late-warning',
      requireInteraction: true,
      url: '/dashboard?tab=my-attendance',
    }
  );
};

/**
 * Sends a salary deduction notification after 5 days of consecutive late attendance
 */
export const sendSalaryDeductionNotification = async (userId: string, count: number) => {
  return sendNotificationToUser(
    userId,
    '🛑 Salary Deduction Notice',
    `Attention: Due to ${count} consecutive days of late attendance, a salary deduction will be applied according to company policy.`,
    {
      tag: 'salary-deduction',
      requireInteraction: true,
      url: '/dashboard?tab=my-attendance',
    }
  );
};

/**
 * Tracks consecutive late attendance for a user and sends notifications
 * after 4 days (warning) and 5 days (salary deduction).
 */
export const checkAndUpdateLateAttendanceStreak = async (
  userId: string,
  checkInDate: Date
) => {
  try {
    // 1. Check if user was late today
    // We already know this is called when someone is late or during daily check
    // For simplicity, let's assume the caller knows if they are late

    // Get or create the tracker
    let tracker = await (prisma as any).lateAttendanceTracker.findUnique({
      where: { userId },
    });

    const today = toZonedTime(checkInDate, 'Asia/Colombo');
    today.setHours(0, 0, 0, 0);

    if (!tracker) {
      tracker = await (prisma as any).lateAttendanceTracker.create({
        data: {
          userId,
          consecutiveLateCount: 1,
          lastLateDate: today,
        },
      });
      return { success: true, count: 1 };
    }

    // If already updated today, skip
    if (tracker.lastLateDate) {
      const lastLate = new Date(tracker.lastLateDate);
      lastLate.setHours(0, 0, 0, 0);
      if (lastLate.getTime() === today.getTime()) {
        return { success: true, count: tracker.consecutiveLateCount, updated: false };
      }
    }

    // Check if it's consecutive (yesterday was also late)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    let newCount = 1;
    if (tracker.lastLateDate) {
      const lastLate = new Date(tracker.lastLateDate);
      lastLate.setHours(0, 0, 0, 0);

      if (lastLate.getTime() === yesterday.getTime()) {
        newCount = tracker.consecutiveLateCount + 1;
      }
    }

    // Update tracker
    const updatedTracker = await (prisma as any).lateAttendanceTracker.update({
      where: { userId },
      data: {
        consecutiveLateCount: newCount,
        lastLateDate: today,
        // Reset notification flags if streak is new
        warningNotificationSent: newCount < 4 ? false : undefined,
        deductionNotificationSent: newCount < 5 ? false : undefined,
      },
    });

    // Handle notifications
    if (newCount === 4 && !updatedTracker.warningNotificationSent) {
      await sendLateAttendanceWarning(userId, newCount);
      await (prisma as any).lateAttendanceTracker.update({
        where: { userId },
        data: {
          warningNotificationSent: true,
          lastWarningDate: new Date()
        },
      });
    } else if (newCount >= 5 && !updatedTracker.deductionNotificationSent) {
      await sendSalaryDeductionNotification(userId, newCount);
      await (prisma as any).lateAttendanceTracker.update({
        where: { userId },
        data: {
          deductionNotificationSent: true,
          lastDeductionDate: new Date()
        },
      });
    }

    return { success: true, count: newCount };
  } catch (error) {
    console.error('Error in checkAndUpdateLateAttendanceStreak:', error);
    return { success: false, error };
  }
};

/**
 * Resets the late attendance streak if an employee is on time
 */
export const resetLateAttendanceStreak = async (userId: string) => {
  try {
    await (prisma as any).lateAttendanceTracker.updateMany({
      where: { userId },
      data: {
        consecutiveLateCount: 0,
        warningNotificationSent: false,
        deductionNotificationSent: false,
      },
    });
    return { success: true };
  } catch (error) {
    console.error('Error resetting late attendance streak:', error);
    return { success: false, error };
  }
};

