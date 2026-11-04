import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Admin / HR verification
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, department: true }
  });

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.department !== 'HR')) {
    return res.status(403).json({ error: 'Forbidden. Admin or HR only.' });
  }

  if (req.method === 'GET') {
    try {
      const requests = await prisma.salaryAdvanceRequest.findMany({
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              department: true,
              position: true,
            }
          },
          reviewer: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.status(200).json(requests);
    } catch (error) {
      console.error('Error fetching admin salary advance requests:', error);
      return res.status(500).json({ error: 'Failed to fetch requests' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
