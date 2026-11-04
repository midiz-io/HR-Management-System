import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = req.headers.authorization;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const requester = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });

  if (!requester) {
    return res.status(401).json({ error: 'User not found' });
  }

  if (req.method === 'GET') {
    const { month, year, targetUserId } = req.query;

    try {
      let whereClause: any = {};

      // If not super admin, check if payslips are hidden globally
      if (requester.role !== 'SUPER_ADMIN') {
        const setting = await prisma.systemSetting.findUnique({
          where: { key: 'hide_payslips' }
        });
        const hidePayslips = setting ? setting.value === 'true' : true;

        if (hidePayslips) {
          return res.status(200).json([]);
        }

        whereClause.userId = userId;
      } else if (targetUserId) {
        whereClause.userId = targetUserId as string;
      }

      if (month) whereClause.month = parseInt(month as string);
      if (year) whereClause.year = parseInt(year as string);

      const payrolls = await prisma.payroll.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              position: true,
              department: true
            }
          }
        },
        orderBy: [
          { year: 'desc' },
          { month: 'desc' }
        ]
      });

      return res.status(200).json(payrolls);
    } catch (error) {
      console.error('Error fetching payrolls:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
