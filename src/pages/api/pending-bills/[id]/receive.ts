import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { ensureSectionalHeadAndNewTables } from '@/lib/sectionalHeadDb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  await ensureSectionalHeadAndNewTables();
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Valid order ID is required' });
  }

  const supabase = createClient(req, res);
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const orders: any[] = await prisma.$queryRawUnsafe(`
      SELECT * FROM "SeafoodOrder" WHERE "id" = $1 LIMIT 1
    `, id);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];

    // Must be the owner of the order to confirm receipt
    if (order.userId !== authUser.id) {
      return res.status(403).json({ error: 'Only the ordering employee can confirm receipt of this order' });
    }

    // Mark received by employee
    const isNowDispatched = order.isDispatchedBySales;
    const newStatus = isNowDispatched ? 'DELIVERED' : order.status;

    await prisma.$executeRawUnsafe(`
      UPDATE "SeafoodOrder"
      SET "isReceivedByEmployee" = true,
          "receivedAt" = CURRENT_TIMESTAMP,
          "status" = $1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $2
    `, newStatus, id);

    // If BOTH Sales and Employee have now confirmed:
    // Update or create employee's PendingBillAccount for this month!
    if (isNowDispatched) {
      const orderDate = new Date(order.createdAt);
      const month = orderDate.getMonth() + 1;
      const year = orderDate.getFullYear();
      const amount = order.totalAmount;

      await prisma.$executeRawUnsafe(`
        INSERT INTO "PendingBillAccount" (
          "id", "userId", "month", "year", "totalBilled", "cashPaid", "outstandingBalance", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid()::text, $1::uuid, $2, $3, $4, 0, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT ("userId", "month", "year")
        DO UPDATE SET
          "totalBilled" = "PendingBillAccount"."totalBilled" + $4,
          "outstandingBalance" = "PendingBillAccount"."outstandingBalance" + $4,
          "updatedAt" = CURRENT_TIMESTAMP
      `, order.userId, month, year, amount);
    }

    return res.status(200).json({
      success: true,
      message: isNowDispatched
        ? 'Receipt confirmed! Dual confirmation complete — order is marked DELIVERED and added to your pending bills account.'
        : 'Order receipt confirmed. Awaiting Sales Department dispatch confirmation.',
      status: newStatus,
      isDispatchedBySales: isNowDispatched,
      isReceivedByEmployee: true,
    });
  } catch (error: any) {
    console.error('Error confirming receipt:', error);
    return res.status(500).json({ error: error.message || 'Failed to confirm receipt' });
  }
}
