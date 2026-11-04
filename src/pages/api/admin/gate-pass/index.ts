import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, department: true }
  });

  const departmentManaged = await prisma.department.findFirst({
    where: { headId: session.user.id }
  });

  const isAuthorized = user && (
    user.role === 'ADMIN' || 
    user.role === 'SUPER_ADMIN' || 
    user.department === 'HR' || 
    !!departmentManaged
  );

  if (!isAuthorized) {
    return res.status(403).json({ error: 'Forbidden. Admin, HR, or Sectional Head only.' });
  }

  if (req.method === 'GET') {
    try {
      let whereClause: any = {};
      
      // If the user is NOT a global admin/HR but is a sectional head, filter requests
      const isGlobalAdminOrHR = user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.department === 'HR');
      if (!isGlobalAdminOrHR && departmentManaged) {
        whereClause = {
          user: {
            departmentId: departmentManaged.id
          }
        };
      }

      const requests = await prisma.gatePassRequest.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              department: true,
              position: true,
              departmentId: true,
            }
          },
          reviewer: {
            select: {
              firstName: true,
              lastName: true
            }
          },
          checkout: true
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.status(200).json(requests);
    } catch (error) {
      console.error('Error fetching admin gate pass requests:', error);
      return res.status(500).json({ error: 'Failed to fetch requests' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
