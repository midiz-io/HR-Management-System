import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { ensureSectionalHeadAndNewTables } from '@/lib/sectionalHeadDb';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;
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

  if (!userData || userData.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Super Admin access required' });
  }

  // PATCH - Update department
  if (req.method === 'PATCH') {
    try {
      await ensureSectionalHeadAndNewTables();
      const { name, description, headId, employeeIds } = req.body;

      // Check previous head
      const previousDept = await prisma.department.findUnique({
        where: { id: id as string },
        select: { headId: true }
      });
      const previousHeadId = previousDept?.headId;
      const effectiveHeadId = headId === 'none' ? null : headId;

      // Update basic info
      const department = await prisma.department.update({
        where: { id: id as string },
        data: {
          name,
          description,
          headId: effectiveHeadId
        }
      });

      // If previous head was replaced, restore them to EMPLOYEE if they were SECTIONAL_HEAD
      if (previousHeadId && previousHeadId !== effectiveHeadId) {
        await prisma.user.updateMany({
          where: { id: previousHeadId, role: 'SECTIONAL_HEAD' as any },
          data: {
            role: 'EMPLOYEE' as any,
            position: 'Employee'
          }
        });
      }

      // Update new head's role and position
      if (effectiveHeadId) {
        await prisma.user.updateMany({
          where: { id: effectiveHeadId, role: { notIn: ['SUPER_ADMIN', 'ADMIN'] } },
          data: { 
            role: 'SECTIONAL_HEAD' as any,
            position: 'Sectional Head',
            department: department.name,
            departmentId: department.id
          }
        });
      }

      // If employeeIds are provided, update their departmentId
      if (employeeIds && Array.isArray(employeeIds)) {
        // First, remove existing employees from this department (optional, depends on logic)
        // Actually, we should just set departmentId for the selected employees
        // and maybe unset for others who were in this department but not in the list?
        // Let's just set for the ones in the list.
        
        await prisma.user.updateMany({
          where: { id: { in: employeeIds } },
          data: { 
            departmentId: department.id,
            department: department.name // Sync string field for compatibility
          }
        });
      }

      return res.status(200).json(department);
    } catch (error: any) {
      console.error('Error updating department:', error);
      return res.status(500).json({ error: error?.message || 'Failed to update department' });
    }
  }

  // DELETE - Delete department
  if (req.method === 'DELETE') {
    try {
      // Unset departmentId for users in this department first
      await prisma.user.updateMany({
        where: { departmentId: id as string },
        data: { departmentId: null }
      });

      await prisma.department.delete({
        where: { id: id as string }
      });

      return res.status(204).end();
    } catch (error) {
      console.error('Error deleting department:', error);
      return res.status(500).json({ error: 'Failed to delete department' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
