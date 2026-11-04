import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  if (req.method === 'GET') {
    try {
      const requests = await prisma.gatePassRequest.findMany({
        where: { userId },
        include: { checkout: true },
        orderBy: { createdAt: 'desc' }
      });
      return res.status(200).json(requests);
    } catch (error) {
      console.error('Error fetching gate pass requests:', error);
      return res.status(500).json({ error: 'Failed to fetch requests' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { date, timeOut, expectedTimeIn, purpose } = req.body;

      if (!date || !timeOut || !purpose) {
        return res.status(400).json({ error: 'Date, Time Out, and Purpose are required' });
      }

      // Check if user has an assigned department
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true }
      });

      if (!user || !user.departmentId) {
        return res.status(400).json({ 
          error: 'You must be assigned to a department to request a gate pass. Please contact your administrator.' 
        });
      }

      const newRequest = await prisma.gatePassRequest.create({
        data: {
          userId,
          date: new Date(date),
          timeOut,
          expectedTimeIn,
          purpose
        }
      });

      return res.status(201).json(newRequest);
    } catch (error) {
      console.error('Error creating gate pass request:', error);
      return res.status(500).json({ error: 'Failed to create request: ' + (error.message || String(error)) });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
