import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { checkAndUpdateLateAttendanceStreak } from '@/util/notifications';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // Verify authentication
    const supabase = createClient(req, res);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const userData = await prisma.user.findUnique({
        where: { id: user.id },
    });

    if (!userData || ((userData.role as any) !== 'ADMIN' && (userData.role as any) !== 'SUPER_ADMIN')) {
        return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    if (req.method === 'POST') {
        try {
            const { userId, date, isLate } = req.body;

            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            const checkDate = date ? new Date(date) : new Date();

            if (isLate === false) {
                // Just reset or don't increment
                return res.status(200).json({ message: 'Only late attendance is tracked for streaks in this endpoint' });
            }

            const result = await checkAndUpdateLateAttendanceStreak(userId, checkDate);

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in check-late-attendance API:', error);
            return res.status(500).json({ error: 'Failed to process late attendance check' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
