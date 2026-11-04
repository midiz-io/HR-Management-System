import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import {
  LocationsPortalEmployeeConfig,
  resolveOrCreateLocation,
  runLocationsPortalAutoAttendance,
} from '@/util/cron-tasks';
import { broadcastRealtimeEvent } from '@/lib/realtime';

const SRI_LANKA_TZ = 'Asia/Colombo';

async function getPortalSettings() {
  const rows = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: [
          'LOCATIONS_PORTAL_CRON_ENABLED',
          'LOCATIONS_PORTAL_CHECKIN_TIME',
          'LOCATIONS_PORTAL_CHECKOUT_TIME',
          'LOCATIONS_PORTAL_EMPLOYEES',
          'LAST_RUN_LOCATIONS_AUTO',
        ],
      },
    },
  });

  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }

  let employeeConfigs: Record<string, LocationsPortalEmployeeConfig> = {};
  if (map['LOCATIONS_PORTAL_EMPLOYEES']) {
    try {
      employeeConfigs = JSON.parse(map['LOCATIONS_PORTAL_EMPLOYEES']);
    } catch (e) {
      console.error('Error parsing LOCATIONS_PORTAL_EMPLOYEES:', e);
    }
  }

  return {
    cronEnabled: map['LOCATIONS_PORTAL_CRON_ENABLED'] !== 'false',
    checkInTime: map['LOCATIONS_PORTAL_CHECKIN_TIME'] || '08:30',
    checkOutTime: map['LOCATIONS_PORTAL_CHECKOUT_TIME'] || '17:00',
    lastRunAt: map['LAST_RUN_LOCATIONS_AUTO'] || null,
    employeeConfigs,
  };
}

async function saveEmployeeConfigs(configs: Record<string, LocationsPortalEmployeeConfig>) {
  await prisma.systemSetting.upsert({
    where: { key: 'LOCATIONS_PORTAL_EMPLOYEES' },
    update: { value: JSON.stringify(configs) },
    create: { key: 'LOCATIONS_PORTAL_EMPLOYEES', value: JSON.stringify(configs) },
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const now = new Date();
      const slNow = toZonedTime(now, SRI_LANKA_TZ);
      const todayStr = format(slNow, 'yyyy-MM-dd');
      const targetDateStr =
        typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
          ? req.query.date
          : todayStr;

      // If viewing today, also run scheduled auto-attendance check if due
      if (targetDateStr === todayStr) {
        await runLocationsPortalAutoAttendance(now).catch((err) =>
          console.warn('Background auto-attendance check warning:', err)
        );
      }

      const dayStartUTC = fromZonedTime(`${targetDateStr} 00:00:00`, SRI_LANKA_TZ);
      const dayEndUTC = fromZonedTime(`${targetDateStr} 23:59:59`, SRI_LANKA_TZ);

      const [portalSettings, locations, users, attendancesForDate] = await Promise.all([
        getPortalSettings(),
        prisma.location.findMany({
          orderBy: { name: 'asc' },
        }),
        prisma.user.findMany({
          where: { isResigned: false },
          select: {
            id: true,
            sequentialId: true,
            firstName: true,
            lastName: true,
            email: true,
            position: true,
            department: true,
            profileImage: true,
            locationId: true,
            location: true,
            assignedDepartment: true,
            rosters: {
              where: {
                AND: [
                  { startDate: { lte: dayEndUTC } },
                  { OR: [{ endDate: { gte: dayStartUTC } }, { endDate: null }] },
                ],
              },
              include: { workShift: true },
              orderBy: { startDate: 'desc' },
            },
          },
          orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }, { email: 'asc' }],
        }),
        prisma.attendance.findMany({
          where: {
            checkInTime: {
              gte: dayStartUTC,
              lte: dayEndUTC,
            },
          },
          include: {
            location: true,
          },
          orderBy: { checkInTime: 'desc' },
        }),
      ]);

      // Map latest attendance per user for the target date
      const attByUser = new Map<string, any>();
      for (const att of attendancesForDate) {
        if (!attByUser.has(att.userId)) {
          attByUser.set(att.userId, att);
        }
      }

      const formattedEmployees = users.map((u) => {
        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
        const activeRoster = u.rosters?.[0]?.workShift;
        const portalCfg = portalSettings.employeeConfigs[u.id] || null;
        const att = attByUser.get(u.id) || null;

        const attCheckInSL = att?.checkInTime
          ? format(toZonedTime(new Date(att.checkInTime), SRI_LANKA_TZ), 'HH:mm')
          : null;
        const attCheckOutSL = att?.checkOutTime
          ? format(toZonedTime(new Date(att.checkOutTime), SRI_LANKA_TZ), 'HH:mm')
          : null;

        const effectiveLocationName =
          att?.location?.name ||
          portalCfg?.locationName ||
          u.location?.name ||
          '';

        const effectiveLocationId =
          att?.locationId ||
          portalCfg?.locationId ||
          u.locationId ||
          '';

        return {
          id: u.id,
          sequentialId: u.sequentialId,
          firstName: u.firstName,
          lastName: u.lastName,
          fullName,
          email: u.email,
          position: u.position || 'Employee',
          department: u.assignedDepartment?.name || u.department || 'General',
          role: 'EMPLOYEE',
          profileImage: u.profileImage,
          assignedLocationId: u.locationId,
          assignedLocationName: u.location?.name || '',
          effectiveLocationId,
          effectiveLocationName,
          rosterStartTime: activeRoster?.startTime || null,
          rosterEndTime: activeRoster?.endTime || null,
          portalConfig: portalCfg,
          isScheduledInPortal: Boolean(portalCfg?.enabled),
          attendance: att
            ? {
                id: att.id,
                locationId: att.locationId,
                locationName: att.location?.name || '',
                checkInTime: att.checkInTime,
                checkOutTime: att.checkOutTime,
                checkInTimeHHMM: attCheckInSL,
                checkOutTimeHHMM: attCheckOutSL,
                status: att.status === 'ABSENT' ? 'OFF DAY' : att.checkOutTime ? 'COMPLETED' : 'Currently Not Checked Out',
              }
            : null,
        };
      });

      return res.status(200).json({
        date: targetDateStr,
        currentSriLankaTime: format(slNow, 'HH:mm:ss'),
        scheduleSettings: {
          enabled: portalSettings.cronEnabled,
          checkInTime: portalSettings.checkInTime,
          checkOutTime: portalSettings.checkOutTime,
          lastRunAt: portalSettings.lastRunAt,
        },
        locations,
        employees: formattedEmployees,
      });
    }

    if (req.method === 'POST') {
      const { action } = req.body;

      // 1. Apply fake location & attendance (Check-In & Check-Out with timestamp + date)
      if (action === 'APPLY_ATTENDANCE') {
        const items: Array<{
          userId: string;
          locationName: string;
          locationId?: string;
          date: string;
          checkInTime: string;
          checkOutTime?: string | null;
          addToAutoSchedule?: boolean;
          mode?: 'BOTH' | 'CHECK_IN_ONLY' | 'CHECK_OUT_ONLY';
        }> = Array.isArray(req.body.items) ? req.body.items : [req.body];

        if (!items.length) {
          return res.status(400).json({ error: 'No employee items provided' });
        }

        const portalSettings = await getPortalSettings();
        const configs = { ...portalSettings.employeeConfigs };
        const appliedRecords: any[] = [];

        for (const item of items) {
          if (!item.userId || !item.date) continue;

          const location = await resolveOrCreateLocation(
            item.locationName || 'Head Office',
            item.locationId
          );

          // Update User's assigned locationId
          await prisma.user
            .update({
              where: { id: item.userId },
              data: { locationId: location.id },
            })
            .catch(() => {});

          const checkInHHMM = item.checkInTime || portalSettings.checkInTime || '08:30';
          const checkOutHHMM =
            item.mode === 'CHECK_IN_ONLY'
              ? ''
              : item.checkOutTime !== undefined
              ? item.checkOutTime || ''
              : portalSettings.checkOutTime || '17:00';

          // Save in /locations portal employee config so cron job also knows their fake location & times
          const shouldEnableInSchedule =
            item.addToAutoSchedule !== undefined
              ? Boolean(item.addToAutoSchedule)
              : configs[item.userId]?.enabled ?? true;

          configs[item.userId] = {
            enabled: shouldEnableInSchedule,
            locationId: location.id,
            locationName: location.name,
            checkInTime: checkInHHMM,
            checkOutTime: checkOutHHMM || portalSettings.checkOutTime || '17:00',
            updatedAt: new Date().toISOString(),
          };

          const dayStartUTC = fromZonedTime(`${item.date} 00:00:00`, SRI_LANKA_TZ);
          const dayEndUTC = fromZonedTime(`${item.date} 23:59:59`, SRI_LANKA_TZ);

          const checkInUTC = fromZonedTime(`${item.date} ${checkInHHMM}:00`, SRI_LANKA_TZ);
          let checkOutUTC = checkOutHHMM
            ? fromZonedTime(`${item.date} ${checkOutHHMM}:00`, SRI_LANKA_TZ)
            : null;

          if (checkOutUTC && checkOutUTC.getTime() <= checkInUTC.getTime()) {
            checkOutUTC = new Date(checkOutUTC.getTime() + 24 * 60 * 60 * 1000);
          }

          const existingAtt = await prisma.attendance.findFirst({
            where: {
              userId: item.userId,
              checkInTime: {
                gte: dayStartUTC,
                lte: dayEndUTC,
              },
            },
            orderBy: { checkInTime: 'desc' },
          });

          let savedAtt;
          if (existingAtt) {
            const finalCheckIn =
              item.mode === 'CHECK_OUT_ONLY' && existingAtt.status !== 'ABSENT'
                ? existingAtt.checkInTime
                : checkInUTC;
            const finalCheckOut =
              item.mode === 'CHECK_IN_ONLY' ? null : checkOutUTC;

            savedAtt = await prisma.attendance.update({
              where: { id: existingAtt.id },
              data: {
                locationId: location.id,
                checkInTime: finalCheckIn,
                checkOutTime: finalCheckOut,
                checkInLatitude: location.latitude,
                checkInLongitude: location.longitude,
                checkOutLatitude: finalCheckOut ? location.latitude : null,
                checkOutLongitude: finalCheckOut ? location.longitude : null,
                status: 'PRESENT',
                isAutoCheckedOut: false,
                notes: null,
              },
              include: { location: true },
            });
          } else {
            const finalCheckOut = item.mode === 'CHECK_IN_ONLY' ? null : checkOutUTC;
            savedAtt = await prisma.attendance.create({
              data: {
                userId: item.userId,
                locationId: location.id,
                checkInTime: checkInUTC,
                checkOutTime: finalCheckOut,
                checkInLatitude: location.latitude,
                checkInLongitude: location.longitude,
                checkOutLatitude: finalCheckOut ? location.latitude : null,
                checkOutLongitude: finalCheckOut ? location.longitude : null,
                status: 'PRESENT',
                isAutoCheckedOut: false,
                notes: null,
              },
              include: { location: true },
            });
          }

          appliedRecords.push(savedAtt);
        }

        await saveEmployeeConfigs(configs);
        broadcastRealtimeEvent('ATTENDANCE_UPDATED', {
          source: 'locations-portal-apply',
          count: appliedRecords.length,
        });

        return res.status(200).json({
          success: true,
          appliedCount: appliedRecords.length,
          records: appliedRecords,
        });
      }

      // 2. Update Employee's /locations portal config (Location & Auto-Cron Toggle)
      if (action === 'UPDATE_EMPLOYEE_CONFIG') {
        const { userId, locationName, locationId, enabled, checkInTime, checkOutTime, position } =
          req.body;

        if (!userId) {
          return res.status(400).json({ error: 'userId is required' });
        }

        const portalSettings = await getPortalSettings();
        const configs = { ...portalSettings.employeeConfigs };
        const existingCfg = configs[userId] || {
          enabled: true,
          locationName: 'Head Office',
        };

        let resolvedLocation = null;
        if (locationName || locationId) {
          resolvedLocation = await resolveOrCreateLocation(
            locationName || existingCfg.locationName || 'Head Office',
            locationId || existingCfg.locationId
          );
        }

        const userUpdateData: any = {};
        if (resolvedLocation) {
          userUpdateData.locationId = resolvedLocation.id;
        }
        if (position !== undefined) {
          userUpdateData.position = position;
        }
        if (Object.keys(userUpdateData).length > 0) {
          await prisma.user
            .update({
              where: { id: userId },
              data: userUpdateData,
            })
            .catch(() => {});
        }

        configs[userId] = {
          enabled: enabled !== undefined ? Boolean(enabled) : existingCfg.enabled,
          locationId: resolvedLocation ? resolvedLocation.id : existingCfg.locationId,
          locationName: resolvedLocation
            ? resolvedLocation.name
            : locationName || existingCfg.locationName || 'Head Office',
          checkInTime: checkInTime || existingCfg.checkInTime || portalSettings.checkInTime,
          checkOutTime: checkOutTime || existingCfg.checkOutTime || portalSettings.checkOutTime,
          updatedAt: new Date().toISOString(),
        };

        await saveEmployeeConfigs(configs);

        return res.status(200).json({
          success: true,
          config: configs[userId],
          location: resolvedLocation,
        });
      }

      // 3. Save Global Daily Cron Schedule Settings
      if (action === 'SAVE_SCHEDULE_SETTINGS') {
        const { enabled, checkInTime, checkOutTime } = req.body;

        const updates = [
          { key: 'LOCATIONS_PORTAL_CRON_ENABLED', value: String(enabled !== false) },
          { key: 'LOCATIONS_PORTAL_CHECKIN_TIME', value: String(checkInTime || '08:30') },
          { key: 'LOCATIONS_PORTAL_CHECKOUT_TIME', value: String(checkOutTime || '17:00') },
        ];

        for (const u of updates) {
          await prisma.systemSetting.upsert({
            where: { key: u.key },
            update: { value: u.value },
            create: { key: u.key, value: u.value },
          });
        }

        // Run auto-attendance check immediately in case the new time is already reached today
        const cronResult = await runLocationsPortalAutoAttendance(new Date());

        return res.status(200).json({
          success: true,
          scheduleSettings: {
            enabled: enabled !== false,
            checkInTime: checkInTime || '08:30',
            checkOutTime: checkOutTime || '17:00',
          },
          cronResult,
        });
      }

      // 4. Trigger Cron Job Manually Now (Check-In, Check-Out, or Both)
      if (action === 'TRIGGER_CRON_NOW') {
        const { phase, date } = req.body;
        const forcePhase =
          phase === 'CHECK_IN' || phase === 'CHECK_OUT' || phase === 'BOTH' ? phase : undefined;

        const result = await runLocationsPortalAutoAttendance(new Date(), {
          forcePhase,
          targetDateStr: date,
        });

        return res.status(200).json({
          success: true,
          ...result,
        });
      }

      return res.status(400).json({ error: 'Invalid action specified' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Error in /api/locations-portal:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
}

