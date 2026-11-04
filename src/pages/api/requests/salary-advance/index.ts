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
      const requests = await prisma.salaryAdvanceRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });
      return res.status(200).json(requests);
    } catch (error) {
      console.error('Error fetching salary advance requests:', error);
      return res.status(500).json({ error: 'Failed to fetch requests' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { amount, requestDate, transferDate, reason } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Valid amount is required' });
      }

      if (amount > 15000) {
        return res.status(400).json({ error: 'Amount exceeds maximum limit. Please contact HR.' });
      }

      const newRequest = await prisma.salaryAdvanceRequest.create({
        data: {
          userId,
          amount: parseFloat(amount),
          requestDate: new Date(requestDate),
          transferDate: transferDate ? new Date(transferDate) : undefined,
          reason
        }
      });

      return res.status(201).json(newRequest);
    } catch (error) {
      console.error('Error creating salary advance request:', error);
      return res.status(500).json({ error: 'Failed to create request' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
