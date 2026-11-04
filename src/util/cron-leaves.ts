import prisma from '@/lib/prisma';
import { toZonedTime, format } from 'date-fns-tz';

const SRI_LANKA_TZ = 'Asia/Colombo';

export async function runAnnualLeaveReset(now: Date) {
  const slNow = toZonedTime(now, SRI_LANKA_TZ);
  const currentYear = parseInt(format(slNow, 'yyyy'));

  const users = await prisma.user.findMany({
    where: { role: { not: 'SUPER_ADMIN' } } // Assuming Super Admins don't need leave tracking
  });

  const leaveTypes = await prisma.leaveType.findMany({
    where: { defaultAllocation: { not: null } }
  });

  let createdCount = 0;

  for (const user of users) {
    for (const type of leaveTypes) {
      if (type.defaultAllocation !== null) {
        await prisma.leaveBalance.upsert({
          where: {
            userId_leaveTypeId_year: {
              userId: user.id,
              leaveTypeId: type.id,
              year: currentYear
            }
          },
          update: {
            totalDays: type.defaultAllocation, // Or carry forward logic if needed
            usedDays: 0,
            pendingDays: 0
          },
          create: {
            userId: user.id,
            leaveTypeId: type.id,
            year: currentYear,
            totalDays: type.defaultAllocation,
            usedDays: 0,
            pendingDays: 0
          }
        });
        createdCount++;
      }
    }
  }

  return { status: 'success', createdCount, year: currentYear };
}
