import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getSectionalHeadContext, ensureSectionalHeadAndNewTables } from '@/lib/sectionalHeadDb';

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

  const context = await getSectionalHeadContext(authUser.id);
  if (!context) {
    return res.status(404).json({ error: 'User profile not found' });
  }

  const { user, isSuperAdminOrHR } = context;
  const isSalesOrAdmin = isSuperAdminOrHR || 
    user.role === 'ADMIN' || 
    (user.department && user.department.toLowerCase().includes('sales'));

  if (!isSalesOrAdmin) {
    return res.status(403).json({ error: 'Access denied: Only Sales Department or HR can confirm order dispatch' });
  }

  try {
    const orders: any[] = await prisma.$queryRawUnsafe(`
      SELECT * FROM "SeafoodOrder" WHERE "id" = $1 LIMIT 1
    `, id);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];

    // Mark dispatched by sales
    const isNowReceived = order.isReceivedByEmployee;
    const newStatus = isNowReceived ? 'DELIVERED' : 'DISPATCHED';

    await prisma.$executeRawUnsafe(`
      UPDATE "SeafoodOrder"
      SET "isDispatchedBySales" = true,
          "dispatchedAt" = CURRENT_TIMESTAMP,
          "dispatchedById" = $1::uuid,
          "status" = $2,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $3
    `, authUser.id, newStatus, id);

    // If BOTH Sales and Employee have now confirmed:
    // Update or create employee's PendingBillAccount for this month!
    if (isNowReceived) {
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
      message: isNowReceived 
        ? 'Dispatch confirmed! Dual confirmation complete — order is marked DELIVERED and added to employee pending bills.'
        : 'Order dispatch confirmed. Awaiting employee receipt confirmation.',
      status: newStatus,
      isDispatchedBySales: true,
      isReceivedByEmployee: isNowReceived,
    });
  } catch (error: any) {
    console.error('Error confirming dispatch:', error);
    return res.status(500).json({ error: error.message || 'Failed to confirm dispatch' });
  }
}
