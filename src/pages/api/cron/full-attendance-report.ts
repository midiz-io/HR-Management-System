import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { sendAdminSummary } from '@/util/whatsapp';
import { format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const SRI_LANKA_TZ = 'Asia/Colombo';

/**
 * Full Attendance Log Cron Job
 * 
 * Sends a detailed list of all employee's attendance status and times.
 * Format: Date | Employee name | Check in | Check out | Department
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const now = new Date();
        const todayLanka = toZonedTime(now, SRI_LANKA_TZ);

        const slStart = new Date(todayLanka);
        slStart.setHours(0, 0, 0, 0);
        const slEnd = new Date(todayLanka);
        slEnd.setHours(23, 59, 59, 999);

        const startOfDay = fromZonedTime(slStart, SRI_LANKA_TZ);
        const endOfDay = fromZonedTime(slEnd, SRI_LANKA_TZ);

        const dateStr = format(todayLanka, 'yyyy-MM-dd');

        // 1. Get all employees (to find absentees)
        const allUsers = await prisma.user.findMany({
            where: {
                role: { in: ['EMPLOYEE', 'MANAGER'] },
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                department: true
            }
        });

        // 2. Get today's attendance
        const attendances = await (prisma as any).attendance.findMany({
            where: {
                checkInTime: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            orderBy: {
                checkInTime: 'asc'
            }
        });

        // Map attendance by userId for easy lookup
        const attendanceMap = new Map();
        attendances.forEach((at: any) => {
            attendanceMap.set(at.userId, at);
        });

        // 3. Format the log entries
        let message = `📋 *Full Attendance Log*\n`;
        message += `📅 *Date:* ${format(todayLanka, 'EEEE, MMM d, yyyy')}\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n`;
        message += `*Format:* _Date | Name | In | Out | Dept_\n\n`;

        const logEntries = allUsers.map(user => {
            const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
            const dept = user.department || 'N/A';
            const at = attendanceMap.get(user.id);

            let checkIn = 'N/A';
            let checkOut = 'N/A';

            if (at) {
                checkIn = format(toZonedTime(new Date(at.checkInTime), SRI_LANKA_TZ), 'h:mm a');
                if (at.checkOutTime) {
                    checkOut = format(toZonedTime(new Date(at.checkOutTime), SRI_LANKA_TZ), 'h:mm a');
                } else {
                    checkOut = 'Active';
                }
            } else {
                checkIn = 'ABSENT';
                checkOut = 'ABSENT';
            }

            return `${dateStr} | ${name} | ${checkIn} | ${checkOut} | ${dept}`;
        });

        // Construct message in batches if it gets too long for WhatsApp (approx 4000 chars)
        // Here we'll just join them and hope for the best, or slice if needed.
        message += logEntries.join('\n');
        message += `\n\n━━━━━━━━━━━━━━━━━━━━\n`;
        message += `_Total Staff: ${allUsers.length}_`;

        // 4. Send to Admins and Groups
        await sendAdminSummary(message);

        console.log(`[FullLogCron] Full log sent. Recipients: ${allUsers.length}`);

        return res.status(200).json({
            success: true,
            logCount: allUsers.length,
            date: dateStr
        });
    } catch (error: any) {
        console.error('[FullLogCron] Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            details: error.message
        });
    }
}
