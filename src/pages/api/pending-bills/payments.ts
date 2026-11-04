import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getSectionalHeadContext, ensureSectionalHeadAndNewTables } from '@/lib/sectionalHeadDb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureSectionalHeadAndNewTables();
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

  // GET: Fetch payment history for a user or account
  if (req.method === 'GET') {
    try {
      const { accountId, userId } = req.query;

      let query = `
        SELECT 
          p."id",
          p."accountId",
          p."amount",
          p."paymentType",
          p."receiptNo",
          p."notes",
          p."paidAt",
          u."firstName" as "recordedByFirstName",
          u."lastName" as "recordedByLastName"
        FROM "PendingBillPayment" p
        LEFT JOIN "User" u ON p."recordedById" = u."id"
        WHERE 1=1
      `;
      const params: any[] = [];

      if (accountId) {
        params.push(accountId);
        query += ` AND p."accountId" = $${params.length}`;
      }

      query += ` ORDER BY p."paidAt" DESC LIMIT 100`;

      const payments = await prisma.$queryRawUnsafe(query, ...params);
      return res.status(200).json({ payments });
    } catch (error: any) {
      console.error('Error fetching payments:', error);
      return res.status(500).json({ error: 'Failed to load payments' });
    }
  }

  // POST: Record a cash payment (Sales Department or HR)
  if (req.method === 'POST') {
    if (!isSalesOrAdmin) {
      return res.status(403).json({ error: 'Access denied: Only Sales Department or HR can record cash payments' });
    }

    try {
      const { accountId, userId, month, year, amount, notes, receiptNo } = req.body;

      const paymentAmount = parseFloat(amount);
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        return res.status(400).json({ error: 'Valid positive payment amount is required' });
      }

      let targetAccountId = accountId;

      if (!targetAccountId) {
        if (!userId || !month || !year) {
          return res.status(400).json({ error: 'Account ID or userId + month + year is required' });
        }

        const accounts: any[] = await prisma.$queryRawUnsafe(`
          SELECT "id", "outstandingBalance" FROM "PendingBillAccount"
          WHERE "userId" = $1::uuid AND "month" = $2 AND "year" = $3
          LIMIT 1
        `, userId, parseInt(month), parseInt(year));

        if (accounts.length === 0) {
          return res.status(404).json({ error: 'No pending bill account found for this employee in the specified month' });
        }
        targetAccountId = accounts[0].id;
      }

      const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const receipt = receiptNo || `RCP-${Date.now().toString().slice(-6)}`;

      // Insert payment record
      await prisma.$executeRawUnsafe(`
        INSERT INTO "PendingBillPayment" (
          "id", "accountId", "amount", "paymentType", "recordedById", "receiptNo", "notes", "paidAt"
        ) VALUES (
          $1, $2, $3, 'CASH', $4::uuid, $5, $6, CURRENT_TIMESTAMP
        )
      `, paymentId, targetAccountId, paymentAmount, authUser.id, receipt, notes ? notes.trim() : null);

      // Update account balances
      await prisma.$executeRawUnsafe(`
        UPDATE "PendingBillAccount"
        SET "cashPaid" = "cashPaid" + $1,
            "outstandingBalance" = GREATEST(0, "outstandingBalance" - $1),
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $2
      `, paymentAmount, targetAccountId);

      return res.status(200).json({
        success: true,
        message: `Cash payment of LKR ${paymentAmount.toLocaleString()} recorded successfully. Outstanding balance updated.`,
        receiptNo: receipt,
      });
    } catch (error: any) {
      console.error('Error recording payment:', error);
      return res.status(500).json({ error: error.message || 'Failed to record cash payment' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}
