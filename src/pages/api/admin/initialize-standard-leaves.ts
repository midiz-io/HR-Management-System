import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const supabase = createClient(req, res);
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
        where: { id: authUser.id },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    const standardLeaves = [
        { name: 'Annual Leave', totalDays: 14, color: '#4caf50', description: 'Standard annual leave allocation' },
        { name: 'Casual Leave', totalDays: 7, color: '#2196f3', description: 'Standard casual leave allocation' },
        { name: 'Medical Leave', totalDays: 30, color: '#f44336', description: 'Medical leave as approved' },
        { name: 'No-Pay Leave', totalDays: 365, color: '#9e9e9e', description: 'Unlimited no-pay leave' },
    ];

    try {
        const results = [];
        const currentYear = new Date().getFullYear();

        for (const leave of standardLeaves) {
            // Upsert LeaveType
            const leaveType = await prisma.leaveType.upsert({
                where: { id: leave.name.toLowerCase().replace(/\s+/g, '-') }, // Using a slug-like ID for simplicity in this script
                update: {
                    name: leave.name,
                    color: leave.color,
                    description: leave.description,
                },
                create: {
                    id: leave.name.toLowerCase().replace(/\s+/g, '-'),
                    name: leave.name,
                    color: leave.color,
                    description: leave.description,
                },
            });

            // Also ensure balances are set for the current user for testing if needed
            // But typically this would be done via a trigger or a separate bulk process.
            // For now, let's just return the created types.
            results.push(leaveType);
        }

        return res.status(200).json({
            message: 'Standard leave types initialized/updated successfully',
            leaveTypes: results,
        });
    } catch (error: any) {
        console.error('Error initializing leaves:', error);
        return res.status(500).json({ error: 'Failed to initialize leaves', message: error.message });
    }
}
