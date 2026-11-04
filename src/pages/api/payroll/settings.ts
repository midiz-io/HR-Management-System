import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = req.headers.authorization;

  if (req.method === 'GET') {
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: 'hide_payslips' },
      });

      // Default to true (hidden) if setting does not exist yet
      const hidePayslips = setting ? setting.value === 'true' : true;
      return res.status(200).json({ hidePayslips });
    } catch (error) {
      console.error('Error fetching payroll settings:', error);
      // Fallback to true (hidden) on error for safety
      return res.status(200).json({ hidePayslips: true });
    }
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const requester = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });

      if (!requester || requester.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Forbidden. Only Super Admin can change payslip visibility settings.' });
      }

      const { hidePayslips } = req.body;
      const strValue = hidePayslips ? 'true' : 'false';

      const updated = await prisma.systemSetting.upsert({
        where: { key: 'hide_payslips' },
        update: { value: strValue },
        create: { key: 'hide_payslips', value: strValue },
      });

      return res.status(200).json({
        hidePayslips: updated.value === 'true',
        message: `Payslips are now ${updated.value === 'true' ? 'hidden from' : 'visible to'} admins and employees.`
      });
    } catch (error) {
      console.error('Error updating payroll settings:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
