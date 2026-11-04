import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { checkAndUpdateLateAttendanceStreak, resetLateAttendanceStreak } from '@/util/notifications';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const SRI_LANKA_TZ = 'Asia/Colombo';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // Authentication check can be added here

    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const now = new Date();
        const todayLanka = toZonedTime(now, SRI_LANKA_TZ);

        const slStart = new Date(todayLanka);
        slStart.setHours(0, 0, 0, 0);

        const today = fromZonedTime(slStart, SRI_LANKA_TZ);

        // 1. Find all employees who checked in today
        // We use (prisma as any) just in case the client hasn't been regenerated yet
        const attendances = await (prisma as any).attendance.findMany({
            where: {
                checkInTime: {
                    gte: today,
                },
            },
            select: {
                userId: true,
                status: true,
            },
        });

        // Use a Map to keep track of user status for today
        // If a user has any LATE record, they are considered late for the day
        const userStatusMap = new Map<string, string>();

        attendances.forEach((a: any) => {
            const existingStatus = userStatusMap.get(a.userId);
            if (a.status === 'LATE' || !existingStatus) {
                userStatusMap.set(a.userId, a.status);
            }
        });

        let lateCount = 0;
        let onTimeCount = 0;

        // 2. Process all users who checked in today
        for (const [userId, status] of Array.from(userStatusMap.entries())) {
            if (status === 'LATE') {
                await checkAndUpdateLateAttendanceStreak(userId, today);
                lateCount++;
            } else if (status === 'PRESENT') {
                await resetLateAttendanceStreak(userId);
                onTimeCount++;
            }
        }

        return res.status(200).json({
            success: true,
            processed: {
                late: lateCount,
                onTime: onTimeCount,
                total: userStatusMap.size
            },
            date: today.toISOString(),
        });
    } catch (error: any) {
        console.error('Error in daily-late-check cron:', error);
        return res.status(500).json({
            error: 'Failed to run daily late check',
            details: error.message
        });
    }
}

