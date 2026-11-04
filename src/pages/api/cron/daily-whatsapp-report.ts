import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { sendAdminSummary } from '@/util/whatsapp';
import { format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const SRI_LANKA_TZ = 'Asia/Colombo';

/**
 * Daily WhatsApp Report Cron Job
 * 
 * This endpoint identifies employees who were late or absent today
 * and sends a summarized WhatsApp message to the configured admin numbers.
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // We allow both POST (for automated cron) and GET (for manual testing)
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const now = new Date();
        const todayLanka = toZonedTime(now, SRI_LANKA_TZ);

        // Define the start and end of "Today" in UTC for the database query
        const slStart = new Date(todayLanka);
        slStart.setHours(0, 0, 0, 0);
        const slEnd = new Date(todayLanka);
        slEnd.setHours(23, 59, 59, 999);

        const startOfDay = fromZonedTime(slStart, SRI_LANKA_TZ);
        const endOfDay = fromZonedTime(slEnd, SRI_LANKA_TZ);

        console.log(`[WhatsAppCron] Running daily report for ${format(todayLanka, 'yyyy-MM-dd HH:mm:ss')}...`);

        // 1. Get all employees and managers (who are expected to check in)
        const employees = await prisma.user.findMany({
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

        // 2. Get today's attendance records
        // We cast to any for safety if the client generation is pending
        const attendances = await (prisma as any).attendance.findMany({
            where: {
                checkInTime: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        department: true
                    }
                }
            },
            orderBy: {
                checkInTime: 'asc'
            }
        });

        // 3. Filter Late employees
        const lateEmployees = attendances
            .filter((a: any) => a.status === 'LATE')
            .map((a: any) => ({
                name: `${a.user.firstName || ''} ${a.user.lastName || ''}`.trim() || a.user.email,
                time: format(toZonedTime(new Date(a.checkInTime), SRI_LANKA_TZ), 'h:mm a'),
                dept: a.user.department || 'N/A'
            }));

        // 4. Identify Absent employees (No attendance record found for today)
        const presentUserIds = new Set(attendances.map((a: any) => a.userId));
        const absentEmployees = employees
            .filter(e => !presentUserIds.has(e.id))
            .map(e => ({
                name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email,
                dept: e.department || 'N/A'
            }));

        // 5. Construct the WhatsApp message
        let message = `📝 *Daily Attendance Summary*\n`;
        message += `📅 *Date:* ${format(todayLanka, 'EEEE, MMM d, yyyy')}\n\n`;

        message += `📊 *Staff Statistics:*\n`;
        message += `• Total Staff: ${employees.length}\n`;
        message += `• Present Today: ${presentUserIds.size}\n`;
        message += `• Late Today: ${lateEmployees.length}\n`;
        message += `• Absent Today: ${absentEmployees.length}\n\n`;

        if (lateEmployees.length > 0) {
            message += `⏰ *LATE EMPLOYEES:*\n`;
            lateEmployees.forEach((emp: any, i: number) => {
                message += `${i + 1}. *${emp.name}* (${emp.dept}) - _${emp.time}_\n`;
            });
            message += `\n`;
        } else {
            message += `⏰ *LATE EMPLOYEES:* None ✅\n\n`;
        }

        if (absentEmployees.length > 0) {
            message += `❌ *ABSENT EMPLOYEES:*\n`;
            absentEmployees.forEach((emp: any, i: number) => {
                message += `${i + 1}. *${emp.name}* (${emp.dept})\n`;
            });
            message += `\n`;
        } else {
            message += `❌ *ABSENT EMPLOYEES:* None ✅\n\n`;
        }

        message += `_This automated report was generated at ${format(todayLanka, 'h:mm a')}_`;

        // 6. Send the report to configured administrators
        await sendAdminSummary(message);

        console.log(`[WhatsAppCron] Report sent successfully. Late: ${lateEmployees.length}, Absent: ${absentEmployees.length}`);

        return res.status(200).json({
            success: true,
            summary: {
                date: format(todayLanka, 'yyyy-MM-dd'),
                totalCount: employees.length,
                presentCount: presentUserIds.size,
                lateCount: lateEmployees.length,
                absentCount: absentEmployees.length
            }
        });
    } catch (error: any) {
        console.error('[WhatsAppCron] Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            details: error.message
        });
    }
}
