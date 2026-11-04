import prisma from '@/lib/prisma';
import { format } from 'date-fns';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { getUserActiveShiftInfo } from './attendance-logic';

const SRI_LANKA_TZ = 'Asia/Colombo';

export async function runAutoMarkAbsences(now: Date) {
  const slNow = toZonedTime(now, SRI_LANKA_TZ);
  const slStart = new Date(slNow);
  slStart.setHours(0, 0, 0, 0);
  const slEnd = new Date(slNow);
  slEnd.setHours(23, 59, 59, 999);

  const todayStart = fromZonedTime(slStart, SRI_LANKA_TZ);
  const todayEnd = fromZonedTime(slEnd, SRI_LANKA_TZ);

  const users = await prisma.user.findMany({
    where: { locationId: { not: null } },
    include: {
      attendances: {
        where: {
          checkInTime: { gte: todayStart, lte: todayEnd }
        }
      },
      leaveRequests: {
        where: {
          status: 'APPROVED',
          startDate: { lte: todayEnd },
          endDate: { gte: todayStart }
        }
      },
      rosters: {
        where: {
          AND: [
            { startDate: { lte: now } },
            { OR: [{ endDate: { gte: now } }, { endDate: null }] }
          ]
        },
        include: { workShift: true }
      }
    }
  });

  let markedCount = 0;

  for (const user of users) {
    if (user.attendances.length > 0) continue; // Already has attendance
    if (user.leaveRequests.length > 0) continue; // On approved leave

    const shiftInfo = getUserActiveShiftInfo(now, user);

    if (shiftInfo.hasShift && shiftInfo.isShiftEnded) {
      // Shift is over and they never checked in -> ABSENT
      await prisma.attendance.create({
        data: {
          userId: user.id,
          locationId: user.locationId!,
          checkInTime: shiftInfo.shiftStartDateTime || now,
          checkOutTime: shiftInfo.shiftEndDateTime || now,
          checkInLatitude: 0,
          checkInLongitude: 0,
          status: 'ABSENT',
          notes: 'Auto-marked: Absent (Did not check in)'
        }
      });
      markedCount++;
    }
  }

  return { status: 'success', markedCount };
}

export async function runAutoRejectExpired(now: Date) {
  const slNow = toZonedTime(now, SRI_LANKA_TZ);
  const slStart = new Date(slNow);
  slStart.setHours(0, 0, 0, 0);
  const todayStart = fromZonedTime(slStart, SRI_LANKA_TZ);

  // Reject expired leaves
  const leaves = await prisma.leaveRequest.updateMany({
    where: { status: 'PENDING', endDate: { lt: todayStart } },
    data: { status: 'REJECTED', rejectionReason: 'Auto-rejected: Request expired' }
  });

  // Reject expired OTs
  const ots = await prisma.oTRequest.updateMany({
    where: { status: 'PENDING', date: { lt: todayStart } },
    data: { status: 'REJECTED', rejectionReason: 'Auto-rejected: Request expired' }
  });

  // Reject expired GatePasses
  const passes = await prisma.gatePassRequest.updateMany({
    where: { 
      status: { in: ['PENDING_SECTIONAL_HEAD', 'PENDING_HR'] }, 
      date: { lt: todayStart } 
    },
    data: { status: 'REJECTED', rejectionReason: 'Auto-rejected: Request expired' }
  });

  // Reject expired ShortLeaves
  const shorts = await prisma.shortLeaveRequest.updateMany({
    where: { status: 'PENDING', date: { lt: todayStart } },
    data: { status: 'REJECTED', rejectionReason: 'Auto-rejected: Request expired' }
  });

  return { 
    status: 'success', 
    rejected: { 
      leaves: leaves.count, 
      ots: ots.count, 
      passes: passes.count, 
      shorts: shorts.count 
    } 
  };
}

export async function runTaskReminders(now: Date) {
  const slNow = toZonedTime(now, SRI_LANKA_TZ);
  const todayEnd = new Date(slNow);
  todayEnd.setHours(23, 59, 59, 999);
  const tomorrowEnd = new Date(slNow);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const utcTodayEnd = fromZonedTime(todayEnd, SRI_LANKA_TZ);
  const utcTomorrowEnd = fromZonedTime(tomorrowEnd, SRI_LANKA_TZ);

  const pendingTasks = await prisma.task.findMany({
    where: { status: { in: ['ASSIGNED', 'IN_PROGRESS'] } }
  });

  let remindersSent = 0;

  for (const task of pendingTasks) {
    if (task.deadline < now) {
      // Overdue
      await prisma.notification.create({
        data: {
          title: 'Task Overdue!',
          body: `The task "${task.title}" is overdue. Please complete it ASAP.`,
          userId: task.assignedToId,
        }
      });
      remindersSent++;
    } else if (task.deadline <= utcTodayEnd) {
      // Due today
      await prisma.notification.create({
        data: {
          title: 'Task Due Today',
          body: `The task "${task.title}" is due today.`,
          userId: task.assignedToId,
        }
      });
      remindersSent++;
    } else if (task.deadline <= utcTomorrowEnd) {
      // Due tomorrow
      await prisma.notification.create({
        data: {
          title: 'Task Due Tomorrow',
          body: `The task "${task.title}" is due tomorrow.`,
          userId: task.assignedToId,
        }
      });
      remindersSent++;
    }
  }

  return { status: 'success', remindersSent };
}

export async function runLateProcessor(now: Date) {
  const slNow = toZonedTime(now, SRI_LANKA_TZ);
  const slStart = new Date(slNow);
  slStart.setHours(0, 0, 0, 0);
  const slEnd = new Date(slNow);
  slEnd.setHours(23, 59, 59, 999);

  const todayStart = fromZonedTime(slStart, SRI_LANKA_TZ);
  const todayEnd = fromZonedTime(slEnd, SRI_LANKA_TZ);

  // Find all attendances marked as LATE today
  const lateAttendances = await prisma.attendance.findMany({
    where: {
      status: 'LATE',
      checkInTime: { gte: todayStart, lte: todayEnd }
    },
    include: { user: true }
  });

  let processed = 0;

  for (const att of lateAttendances) {
    // Find previous day's attendance
    const prevDayStart = new Date(slStart);
    prevDayStart.setDate(prevDayStart.getDate() - 1);
    const prevDayEnd = new Date(slEnd);
    prevDayEnd.setDate(prevDayEnd.getDate() - 1);

    const prevAtt = await prisma.attendance.findFirst({
      where: {
        userId: att.userId,
        checkInTime: { 
          gte: fromZonedTime(prevDayStart, SRI_LANKA_TZ),
          lte: fromZonedTime(prevDayEnd, SRI_LANKA_TZ)
        }
      }
    });

    let tracker = await prisma.lateAttendanceTracker.findUnique({ where: { userId: att.userId } });
    if (!tracker) {
      tracker = await prisma.lateAttendanceTracker.create({
        data: { userId: att.userId, consecutiveLateCount: 1, lastLateDate: att.checkInTime }
      });
    } else {
      let count = tracker.consecutiveLateCount;
      if (prevAtt && prevAtt.status === 'LATE') {
        count += 1;
      } else {
        count = 1;
      }
      
      tracker = await prisma.lateAttendanceTracker.update({
        where: { id: tracker.id },
        data: { consecutiveLateCount: count, lastLateDate: att.checkInTime }
      });
    }

    if (tracker.consecutiveLateCount === 3) {
      // Send warning
      await prisma.notification.create({
        data: {
          title: 'Late Attendance Warning',
          body: `You have been late for 3 consecutive days. Further lateness may result in salary deductions.`,
          userId: att.userId
        }
      });
    } else if (tracker.consecutiveLateCount > 3) {
      // Trigger deduction (can be integrated into Payroll logic later, for now just notify Admin)
      await prisma.notification.create({
        data: {
          title: 'Salary Deduction Warning',
          body: `You have been late for ${tracker.consecutiveLateCount} consecutive days. A salary deduction has been noted.`,
          userId: att.userId
        }
      });
    }
    processed++;
  }

  return { status: 'success', processed };
}

export async function runDailyCanteenSummary(now: Date) {
  const slNow = toZonedTime(now, SRI_LANKA_TZ);
  const slStart = new Date(slNow);
  slStart.setHours(0, 0, 0, 0);
  const slEnd = new Date(slNow);
  slEnd.setHours(23, 59, 59, 999);

  const todayStart = fromZonedTime(slStart, SRI_LANKA_TZ);
  const todayEnd = fromZonedTime(slEnd, SRI_LANKA_TZ);

  const orders = await prisma.foodOrder.findMany({
    where: {
      date: { gte: todayStart, lte: todayEnd },
      status: 'APPROVED'
    }
  });

  const summary: Record<string, number> = {};
  orders.forEach(o => {
    summary[o.mealType] = (summary[o.mealType] || 0) + 1;
  });

  const summaryText = Object.entries(summary).map(([k, v]) => `${k}: ${v}`).join(', ');

  if (summaryText.length > 0) {
    const admins = await prisma.user.findMany({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } });
    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          title: 'Daily Canteen Summary',
          body: `Approved orders for today - ${summaryText}`,
          userId: admin.id
        }
      });
    }
  }

  return { status: 'success', totalOrders: orders.length, summary };
}

export async function runAutoCheckout(now: Date = new Date()) {
  try {
    const openAttendances = await prisma.attendance.findMany({
      where: {
        checkOutTime: null,
      },
      include: {
        user: true,
        location: true,
      },
    });

    let checkedOutCount = 0;
    const checkedOutUsers: string[] = [];

    for (const att of openAttendances) {
      if (!att.user || !(att.user as any).autoCheckoutEnabled) {
        continue;
      }

      const configuredHours = (att.user as any).autoCheckoutHours || 8.0;
      // Enforce absolute minimum 15 minutes (0.25 hrs) stay
      const requiredHours = Math.max(0.25, configuredHours);
      const checkInMs = att.checkInTime.getTime();
      const currentMs = now.getTime();
      const elapsedHours = (currentMs - checkInMs) / (1000 * 60 * 60);

      if (elapsedHours >= requiredHours) {
        const autoCheckoutTime = new Date(checkInMs + requiredHours * 60 * 60 * 1000);

        await prisma.attendance.update({
          where: { id: att.id },
          data: {
            checkOutTime: autoCheckoutTime,
            checkOutLatitude: att.checkInLatitude,
            checkOutLongitude: att.checkInLongitude,
            isAutoCheckedOut: true,
            notes: `Auto Checked Out (Scheduled after ${requiredHours} hrs)`,
          },
        });

        try {
          await prisma.notification.create({
            data: {
              title: 'Auto Checked Out',
              body: `You were automatically checked out after ${requiredHours} hours.`,
              userId: att.userId,
            },
          });
        } catch (e) {
          console.warn('Notification error in auto-checkout:', e);
        }

        checkedOutCount++;
        checkedOutUsers.push(`${att.user.firstName || ''} ${att.user.lastName || att.user.email}`);
      }
    }

    return {
      status: 'success',
      checkedOutCount,
      checkedOutUsers,
    };
  } catch (error: any) {
    console.error('Error running auto checkout:', error);
    return { status: 'error', error: error.message };
  }
}


export interface LocationsPortalEmployeeConfig {
  enabled: boolean;
  locationId?: string;
  locationName: string;
  checkInTime?: string;
  checkOutTime?: string;
  updatedAt?: string;
}

export async function resolveOrCreateLocation(locationName: string, locationId?: string) {
  const trimmedName = (locationName || '').trim();
  if (locationId) {
    const byId = await prisma.location.findUnique({ where: { id: locationId } });
    if (byId && (!trimmedName || byId.name.toLowerCase() === trimmedName.toLowerCase())) {
      return byId;
    }
  }

  if (!trimmedName) {
    const fallback = await prisma.location.findFirst();
    if (fallback) return fallback;
    return prisma.location.create({
      data: {
        name: 'Head Office',
        address: 'Head Office',
        latitude: 6.9271,
        longitude: 79.8612,
        radius: 50,
      },
    });
  }

  const existing = await prisma.location.findFirst({
    where: {
      name: {
        equals: trimmedName,
        mode: 'insensitive',
      },
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.location.create({
    data: {
      name: trimmedName,
      address: trimmedName,
      latitude: 6.9271,
      longitude: 79.8612,
      radius: 50,
    },
  });
}

export async function runLocationsPortalAutoAttendance(
  now: Date = new Date(),
  options?: {
    forcePhase?: 'CHECK_IN' | 'CHECK_OUT' | 'BOTH';
    targetDateStr?: string;
  }
) {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'LOCATIONS_PORTAL_CRON_ENABLED',
            'LOCATIONS_PORTAL_CHECKIN_TIME',
            'LOCATIONS_PORTAL_CHECKOUT_TIME',
            'LOCATIONS_PORTAL_EMPLOYEES',
          ],
        },
      },
    });

    const settingsMap = settings.reduce((acc: Record<string, string>, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    const cronEnabled = settingsMap['LOCATIONS_PORTAL_CRON_ENABLED'] !== 'false';
    if (!cronEnabled && !options?.forcePhase) {
      return {
        status: 'skipped',
        reason: 'Locations portal cron schedule is disabled',
        checkedInCount: 0,
        checkedOutCount: 0,
      };
    }

    const globalCheckInTime = settingsMap['LOCATIONS_PORTAL_CHECKIN_TIME'] || '08:30';
    const globalCheckOutTime = settingsMap['LOCATIONS_PORTAL_CHECKOUT_TIME'] || '17:00';

    let employeeConfigs: Record<string, LocationsPortalEmployeeConfig> = {};
    if (settingsMap['LOCATIONS_PORTAL_EMPLOYEES']) {
      try {
        employeeConfigs = JSON.parse(settingsMap['LOCATIONS_PORTAL_EMPLOYEES']);
      } catch (e) {
        console.error('Failed to parse LOCATIONS_PORTAL_EMPLOYEES:', e);
      }
    }

    const activeUserIds = Object.keys(employeeConfigs).filter(
      (uid) => employeeConfigs[uid]?.enabled && (employeeConfigs[uid]?.locationName || employeeConfigs[uid]?.locationId)
    );

    if (activeUserIds.length === 0) {
      return {
        status: 'success',
        message: 'No active employees configured in /locations portal',
        checkedInCount: 0,
        checkedOutCount: 0,
      };
    }

    const slNow = toZonedTime(now, SRI_LANKA_TZ);
    const dateStr = options?.targetDateStr || format(slNow, 'yyyy-MM-dd');
    const currentMinutes = slNow.getHours() * 60 + slNow.getMinutes();

    const dayStartUTC = fromZonedTime(`${dateStr} 00:00:00`, SRI_LANKA_TZ);
    const dayEndUTC = fromZonedTime(`${dateStr} 23:59:59`, SRI_LANKA_TZ);

    const users = await prisma.user.findMany({
      where: {
        id: { in: activeUserIds },
        isResigned: false,
      },
      include: {
        attendances: {
          where: {
            checkInTime: {
              gte: dayStartUTC,
              lte: dayEndUTC,
            },
          },
          orderBy: { checkInTime: 'desc' },
        },
      },
    });

    let checkedInCount = 0;
    let checkedOutCount = 0;
    const processedUsers: string[] = [];

    const parseTimeToMins = (t: string) => {
      const [h, m] = (t || '08:30').split(':').map(Number);
      return (isNaN(h) ? 8 : h) * 60 + (isNaN(m) ? 30 : m);
    };

    for (const user of users) {
      const cfg = employeeConfigs[user.id];
      if (!cfg || !cfg.enabled) continue;

      const empCheckInTime = cfg.checkInTime || globalCheckInTime || '08:30';
      const empCheckOutTime = cfg.checkOutTime || globalCheckOutTime || '17:00';

      const checkInMins = parseTimeToMins(empCheckInTime);
      const checkOutMins = parseTimeToMins(empCheckOutTime);

      const shouldCheckIn =
        options?.forcePhase === 'CHECK_IN' ||
        options?.forcePhase === 'BOTH' ||
        (!options?.forcePhase && currentMinutes >= checkInMins);

      const shouldCheckOut =
        options?.forcePhase === 'CHECK_OUT' ||
        options?.forcePhase === 'BOTH' ||
        (!options?.forcePhase && currentMinutes >= checkOutMins);

      if (!shouldCheckIn && !shouldCheckOut) {
        continue;
      }

      const location = await resolveOrCreateLocation(cfg.locationName, cfg.locationId);

      // Keep user's default location synced
      if (user.locationId !== location.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { locationId: location.id },
        }).catch(() => {});
      }

      const scheduledCheckInUTC = fromZonedTime(`${dateStr} ${empCheckInTime}:00`, SRI_LANKA_TZ);
      let scheduledCheckOutUTC = fromZonedTime(`${dateStr} ${empCheckOutTime}:00`, SRI_LANKA_TZ);
      if (scheduledCheckOutUTC.getTime() <= scheduledCheckInUTC.getTime()) {
        scheduledCheckOutUTC = new Date(scheduledCheckOutUTC.getTime() + 24 * 60 * 60 * 1000);
      }

      const existingAtt = user.attendances[0];
      const empLabel = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

      if (!existingAtt) {
        if (shouldCheckIn || shouldCheckOut) {
          await prisma.attendance.create({
            data: {
              userId: user.id,
              locationId: location.id,
              checkInTime: scheduledCheckInUTC,
              checkOutTime: shouldCheckOut ? scheduledCheckOutUTC : null,
              checkInLatitude: location.latitude,
              checkInLongitude: location.longitude,
              checkOutLatitude: shouldCheckOut ? location.latitude : null,
              checkOutLongitude: shouldCheckOut ? location.longitude : null,
              status: 'PRESENT',
              isAutoCheckedOut: false,
              notes: null,
            },
          });
          checkedInCount++;
          if (shouldCheckOut) checkedOutCount++;
          processedUsers.push(empLabel);
        }
      } else {
        // Record exists for today
        const needsAbsentOverride = existingAtt.status === 'ABSENT';
        const needsCheckOut = shouldCheckOut && !existingAtt.checkOutTime;
        const needsForceUpdate = Boolean(options?.forcePhase);

        if (needsAbsentOverride || needsCheckOut || needsForceUpdate) {
          const updatedCheckIn =
            needsAbsentOverride || options?.forcePhase === 'CHECK_IN' || options?.forcePhase === 'BOTH'
              ? scheduledCheckInUTC
              : existingAtt.checkInTime;

          const updatedCheckOut = shouldCheckOut
            ? scheduledCheckOutUTC
            : existingAtt.checkOutTime;

          await prisma.attendance.update({
            where: { id: existingAtt.id },
            data: {
              locationId: location.id,
              checkInTime: updatedCheckIn,
              checkOutTime: updatedCheckOut,
              checkInLatitude: location.latitude,
              checkInLongitude: location.longitude,
              checkOutLatitude: updatedCheckOut ? location.latitude : null,
              checkOutLongitude: updatedCheckOut ? location.longitude : null,
              status: 'PRESENT',
              isAutoCheckedOut: false,
              notes: null,
            },
          });

          if (needsAbsentOverride || options?.forcePhase === 'CHECK_IN') checkedInCount++;
          if (needsCheckOut || options?.forcePhase === 'CHECK_OUT' || options?.forcePhase === 'BOTH') checkedOutCount++;
          processedUsers.push(empLabel);
        }
      }
    }

    if (checkedInCount > 0 || checkedOutCount > 0) {
      await prisma.systemSetting.upsert({
        where: { key: 'LAST_RUN_LOCATIONS_AUTO' },
        update: { value: new Date().toISOString() },
        create: { key: 'LAST_RUN_LOCATIONS_AUTO', value: new Date().toISOString() },
      });
      broadcastRealtimeEvent('ATTENDANCE_UPDATED', { source: 'locations-portal-cron' });
    }

    return {
      status: 'success',
      date: dateStr,
      checkedInCount,
      checkedOutCount,
      processedUsers,
    };
  } catch (error: any) {
    console.error('Error in runLocationsPortalAutoAttendance:', error);
    return {
      status: 'error',
      error: error.message,
      checkedInCount: 0,
      checkedOutCount: 0,
    };
  }
}
