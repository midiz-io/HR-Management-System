import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const supabase = createClient(req, res);
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Fetch full user record to check role
  const adminUser = await prisma.user.findUnique({
    where: { id: authUser.id },
  });

  if (!adminUser || (adminUser.role !== 'SUPER_ADMIN' && adminUser.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  if (req.method === 'GET') {
    try {
      try {
        const users = await prisma.user.findMany({
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            phoneNumber: true,
          },
          orderBy: {
            firstName: 'asc'
          }
        });
        return res.status(200).json(users);
      } catch (prismaError) {
        // Fallback if phoneNumber column is missing
        console.warn('Prisma query failed, likely missing phoneNumber column. Falling back...');
        const users = await prisma.user.findMany({
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
          orderBy: {
            firstName: 'asc'
          }
        });
        return res.status(200).json(users);
      }
    } catch (error) {
      console.error('Error fetching user list:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
