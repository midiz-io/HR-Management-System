import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { toZonedTime, format } from 'date-fns-tz';
import { 
  runAutoMarkAbsences, 
  runAutoRejectExpired, 
  runTaskReminders, 
  runLateProcessor, 
  runDailyCanteenSummary,
  runAutoCheckout,
  runLocationsPortalAutoAttendance
} from '@/util/cron-tasks';

const SRI_LANKA_TZ = 'Asia/Colombo';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const now = new Date();
    const slNow = toZonedTime(now, SRI_LANKA_TZ);
    const currentHourMinute = format(slNow, 'HH:mm');
    const todayDateStr = format(slNow, 'yyyy-MM-dd');
    const currentDayOfMonth = format(slNow, 'dd');
    const isFirstDayOfYear = format(slNow, 'MM-dd') === '01-01';

    const settings = await prisma.systemSetting.findMany();
    const settingsMap = settings.reduce((acc: any, s) => ({ ...acc, [s.key]: s.value }), {});

    const shouldRun = async (taskKey: string, configuredTime: string) => {
      if (!configuredTime) return false;
      const [cHour, cMin] = configuredTime.split(':').map(Number);
      const [nHour, nMin] = currentHourMinute.split(':').map(Number);
      const cTotal = cHour * 60 + cMin;
      const nTotal = nHour * 60 + nMin;

      if (nTotal >= cTotal) {
        const lastRunKey = `LAST_RUN_${taskKey}`;
        const lastRun = settingsMap[lastRunKey];
        if (lastRun !== todayDateStr) {
          // Mark as run for today
          await prisma.systemSetting.upsert({
            where: { key: lastRunKey },
            update: { value: todayDateStr },
            create: { key: lastRunKey, value: todayDateStr }
          });
          return true;
        }
      }
      return false;
    };

    const results: any = {};

    // 0. Run /locations portal daily auto check-in & check-out first (before absence marking)
    results.locationsPortal = await runLocationsPortalAutoAttendance(now);

    // 1. Auto-Mark Absences
    if (await shouldRun('ABSENCES', settingsMap['CRON_TIME_ABSENCES'] || '20:00')) {
       results.absences = await runAutoMarkAbsences(now);
    }

    // 2. Auto-Reject Expired Requests
    if (await shouldRun('EXPIRED_REJECT', settingsMap['CRON_TIME_EXPIRED_REJECT'] || '23:30')) {
       results.expired = await runAutoRejectExpired(now);
    }

    // 3. Task Reminders
    if (await shouldRun('TASK_REMINDER', settingsMap['CRON_TIME_TASK_REMINDER'] || '08:00')) {
       results.tasks = await runTaskReminders(now);
    }

    // 4. Late Attendance Processor
    if (await shouldRun('LATE_PROCESSOR', settingsMap['CRON_TIME_LATE_PROCESSOR'] || '21:00')) {
       results.late = await runLateProcessor(now);
    }

    // 5. Daily Canteen Summary
    if (await shouldRun('CANTEEN', settingsMap['CRON_TIME_CANTEEN'] || '09:30')) {
       results.canteen = await runDailyCanteenSummary(now);
    }

    // Always run auto checkout checks for active open shifts
    results.autoCheckout = await runAutoCheckout(now);

    // 6. Monthly Payroll Generator (Runs on 25th)
    if (currentDayOfMonth === '25') {
       if (await shouldRun('PAYROLL', '00:00')) {
         // Import dynamically to avoid clutter if not used
         const { runMonthlyPayroll } = await import('@/util/cron-payroll');
         results.payroll = await runMonthlyPayroll(now);
       }
    }

    // 7. Annual Leave Quota Reset (Runs Jan 1st)
    if (isFirstDayOfYear) {
       if (await shouldRun('ANNUAL_LEAVE', '00:00')) {
         const { runAnnualLeaveReset } = await import('@/util/cron-leaves');
         results.annualLeave = await runAnnualLeaveReset(now);
       }
    }

    return res.status(200).json({
      success: true,
      timestamp: now.toISOString(),
      executed: Object.keys(results),
      results
    });

  } catch (error: any) {
    console.error('Dispatcher error:', error);
    return res.status(500).json({ error: 'Dispatcher failed', details: error.message });
  }
}
