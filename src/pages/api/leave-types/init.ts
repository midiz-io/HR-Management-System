import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

// The 4 fixed leave types for the system
const STANDARD_LEAVE_TYPES = [
  {
    name: 'Annual Leave',
    description: 'Annual paid leave entitlement',
    color: '#3b82f6', // blue
    defaultAllocation: 14,
  },
  {
    name: 'Casual Leave',
    description: 'Casual leave for personal matters',
    color: '#10b981', // green
    defaultAllocation: 7,
  },
  {
    name: 'Medical Leave',
    description: 'Medical leave as approved by management',
    color: '#f59e0b', // amber
    defaultAllocation: null, // As approved
  },
  {
    name: 'No-Pay Leave',
    description: 'Unpaid leave with salary deduction',
    color: '#ef4444', // red
    defaultAllocation: null, // Unlimited
  },
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Create Supabase client
  const supabase = createClient(req, res);

  // Get user from session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    // Fallback to authorization header
    const userId = req.headers.authorization;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role !== 'ADMIN' && (user.role as any) !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only admins can initialize leave types' });
    }
  } else {
    const userId = session.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role !== 'ADMIN' && (user.role as any) !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only admins can initialize leave types' });
    }
  }

  try {
    // Upsert each standard leave type
    const upsertedTypes = [];
    for (const lt of STANDARD_LEAVE_TYPES) {
      // Try to find existing by name
      const existing = await prisma.leaveType.findFirst({
        where: { name: lt.name },
      });

      if (existing) {
        // Update existing
        const updated = await prisma.leaveType.update({
          where: { id: existing.id },
          data: {
            description: lt.description,
            color: lt.color,
            defaultAllocation: lt.defaultAllocation,
          },
        });
        upsertedTypes.push(updated);
      } else {
        // Create new
        const created = await prisma.leaveType.create({
          data: {
            name: lt.name,
            description: lt.description,
            color: lt.color,
            defaultAllocation: lt.defaultAllocation,
          },
        });
        upsertedTypes.push(created);
      }
    }

    // Delete leave types that are NOT one of the 4 standard types and have no requests
    const standardNames = STANDARD_LEAVE_TYPES.map((lt) => lt.name);
    const allLeaveTypes = await prisma.leaveType.findMany();
    let deletedCount = 0;

    for (const lt of allLeaveTypes) {
      if (!standardNames.includes(lt.name)) {
        // Check if this leave type has any requests
        const requestCount = await prisma.leaveRequest.count({
          where: { leaveTypeId: lt.id },
        });

        if (requestCount === 0) {
          // Safe to delete - first remove any balances
          await prisma.leaveBalance.deleteMany({
            where: { leaveTypeId: lt.id },
          });
          await prisma.leaveType.delete({
            where: { id: lt.id },
          });
          deletedCount++;
        }
      }
    }

    return res.status(201).json({
      message: `Leave types initialized successfully. ${deletedCount} unused types removed.`,
      deleted: deletedCount,
      leaveTypes: upsertedTypes,
    });
  } catch (error) {
    console.error('Error initializing leave types:', error);
    return res.status(500).json({ error: 'Failed to initialize leave types' });
  }
}