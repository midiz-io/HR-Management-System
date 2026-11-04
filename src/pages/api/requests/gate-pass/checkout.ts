import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.body;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Gate Pass Request ID is required' });
  }

  try {
    const request = await prisma.gatePassRequest.findUnique({
      where: { id },
      include: { 
        checkout: true,
        user: {
          select: {
            id: true,
            role: true
          }
        }
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Gate Pass request not found.' });
    }

    // Check if the user is authorized to check out:
    // Either they are the owner of the gate pass, or they are an admin
    const isOwner = request.userId === session.user.id;
    const adminUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, department: true }
    });
    const isAuthorized = isOwner || (adminUser && (adminUser.role === 'ADMIN' || adminUser.role === 'SUPER_ADMIN' || adminUser.department === 'HR'));

    if (!isAuthorized) {
      return res.status(403).json({ error: 'You are not authorized to check out this gate pass.' });
    }

    // Must be in APPROVED status
    if (request.status !== 'APPROVED') {
      return res.status(400).json({ error: `Gate pass status is '${request.status.replace(/_/g, ' ')}'. You can only checkout an APPROVED gate pass.` });
    }

    // If already checked out, just return it
    if (request.checkout) {
      return res.status(200).json({ message: 'Already checked out', request });
    }

    // Record the checkout
    const checkout = await prisma.gatePassCheckout.create({
      data: {
        gatePassId: id,
        actualTimeOut: new Date()
      }
    });

    const updatedRequest = await prisma.gatePassRequest.findUnique({
      where: { id },
      include: { checkout: true }
    });

    return res.status(200).json({ message: 'Checkout successful', request: updatedRequest });
  } catch (error) {
    console.error('Error during gate pass checkout:', error);
    return res.status(500).json({ error: 'Failed to process checkout: ' + (error.message || String(error)) });
  }
}
