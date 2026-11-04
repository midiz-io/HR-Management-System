import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { ensureSectionalHeadAndNewTables } from '@/lib/sectionalHeadDb';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });

  if (!userData) {
    return res.status(404).json({ error: 'User not found' });
  }

  const userRole = userData.role;

  // GET - List departments
  if (req.method === 'GET') {
    try {
      const departments = await prisma.department.findMany({
        include: {
          head: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          _count: {
            select: { employees: true }
          }
        },
        orderBy: { name: 'asc' }
      });
      return res.status(200).json(departments);
    } catch (error) {
      console.error('Error fetching departments:', error);
      return res.status(500).json({ error: 'Failed to fetch departments' });
    }
  }

  // POST - Create department (Super Admin only)
  if (req.method === 'POST') {
    if (userRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Super Admin access required' });
    }

    try {
      await ensureSectionalHeadAndNewTables();
      const { name, description, headId } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Department name is required' });
      }

      const department = await prisma.department.create({
        data: {
          name,
          description,
          headId: headId || null
        }
      });

      // Update head's role and position if assigned
      if (headId) {
        await prisma.user.updateMany({
          where: { id: headId, role: { notIn: ['SUPER_ADMIN', 'ADMIN'] } },
          data: { 
            role: 'SECTIONAL_HEAD' as any,
            position: 'Sectional Head',
            department: department.name,
            departmentId: department.id
          }
        });
      }

      return res.status(201).json(department);
    } catch (error: any) {
      console.error('Error creating department:', error);
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Department with this name already exists' });
      }
      return res.status(500).json({ error: 'Failed to create department' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
