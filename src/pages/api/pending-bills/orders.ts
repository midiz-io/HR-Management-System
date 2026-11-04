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

  // Check if user is part of Sales or Admin/HR
  const isSalesOrAdmin = isSuperAdminOrHR || 
    user.role === 'ADMIN' || 
    (user.department && user.department.toLowerCase().includes('sales'));

  // GET: Fetch orders and current pending bill balance
  if (req.method === 'GET') {
    try {
      const { all, month, year } = req.query;
      const currentMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;
      const currentYear = year ? parseInt(year as string) : new Date().getFullYear();

      const canViewAll = isSalesOrAdmin && all === 'true';

      // Automatically clean up any failed/empty orders that have no items
      try {
        await prisma.$executeRawUnsafe(`
          DELETE FROM "SeafoodOrder"
          WHERE "id" NOT IN (SELECT DISTINCT "orderId" FROM "SeafoodOrderItem")
        `);
      } catch (cleanupErr) {
        // Ignore
      }

      let ordersQuery = `
        SELECT 
          o."id",
          o."invoiceNo",
          o."userId",
          o."totalAmount",
          o."status",
          o."isDispatchedBySales",
          o."dispatchedAt",
          o."isReceivedByEmployee",
          o."receivedAt",
          o."notes",
          o."createdAt",
          u."firstName",
          u."lastName",
          u."email",
          u."department",
          u."phoneNumber",
          disp."firstName" as "dispatchedByFirstName",
          disp."lastName" as "dispatchedByLastName"
        FROM "SeafoodOrder" o
        JOIN "User" u ON o."userId" = u."id"
        LEFT JOIN "User" disp ON o."dispatchedById" = disp."id"
        WHERE 1=1
      `;

      const params: any[] = [];
      if (!canViewAll) {
        params.push(authUser.id);
        ordersQuery += ` AND o."userId" = $1::uuid`;
      }

      ordersQuery += ` ORDER BY o."createdAt" DESC LIMIT 100`;

      const ordersRows: any[] = await prisma.$queryRawUnsafe(ordersQuery, ...params);

      // Fetch items for each order
      const orderIds = ordersRows.map(o => o.id);
      let itemsByOrder: Record<string, any[]> = {};

      if (orderIds.length > 0) {
        const itemRows: any[] = await prisma.$queryRawUnsafe(`
          SELECT 
            oi."id",
            oi."orderId",
            oi."itemId",
            oi."quantity",
            oi."unitPrice",
            oi."subtotal",
            si."name" as "itemName",
            si."unit" as "itemUnit"
          FROM "SeafoodOrderItem" oi
          LEFT JOIN "SeafoodItem" si ON oi."itemId" = si."id"
          WHERE oi."orderId" = ANY($1::text[])
        `, orderIds);

        itemRows.forEach(item => {
          if (!itemsByOrder[item.orderId]) itemsByOrder[item.orderId] = [];
          itemsByOrder[item.orderId].push({
            ...item,
            totalPrice: item.subtotal,
            seafoodItem: {
              name: item.itemName,
              unit: item.itemUnit || 'kg',
              category: 'Seafood',
            }
          });
        });
      }

      const orders = ordersRows.map(o => ({
        id: o.id,
        invoiceNo: o.invoiceNo,
        invoiceNumber: o.invoiceNo,
        userId: o.userId,
        totalAmount: o.totalAmount,
        status: o.status,
        isDispatchedBySales: o.isDispatchedBySales,
        dispatchedAt: o.dispatchedAt,
        isReceivedByEmployee: o.isReceivedByEmployee,
        receivedAt: o.receivedAt,
        notes: o.notes,
        createdAt: o.createdAt,
        user: {
          id: o.userId,
          firstName: o.firstName,
          lastName: o.lastName,
          email: o.email,
          department: o.department,
          phoneNumber: o.phoneNumber,
        },
        dispatchedBy: o.dispatchedByFirstName ? {
          firstName: o.dispatchedByFirstName,
          lastName: o.dispatchedByLastName,
        } : null,
        items: itemsByOrder[o.id] || [],
      }));

      // Also get current user's monthly pending bill account summary
      const accountRows: any[] = await prisma.$queryRawUnsafe(`
        SELECT * FROM "PendingBillAccount"
        WHERE "userId" = $1::uuid AND "month" = $2 AND "year" = $3
        LIMIT 1
      `, authUser.id, currentMonth, currentYear);

      const accountSummary = accountRows.length > 0 ? accountRows[0] : {
        month: currentMonth,
        year: currentYear,
        totalBilled: 0,
        cashPaid: 0,
        outstandingBalance: 0,
        isSalaryDeductionConfirmed: false,
      };

      return res.status(200).json({
        orders,
        accountSummary,
        isSalesOrAdmin,
      });
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      return res.status(500).json({ error: 'Failed to fetch seafood orders' });
    }
  }

  // POST: Place a new seafood order & auto-generate invoice
  if (req.method === 'POST') {
    try {
      const { items, notes } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'At least one seafood item must be selected' });
      }

      // Fetch seafood items from database to get accurate metadata & prices
      const itemIds = items.map((i: any) => i.id || i.itemId || i.seafoodItemId).filter(Boolean);
      const dbItems: any[] = await prisma.$queryRawUnsafe(`
        SELECT * FROM "SeafoodItem" WHERE "id" = ANY($1::text[])
      `, itemIds);
      const dbItemsMap: Record<string, any> = {};
      dbItems.forEach(di => { dbItemsMap[di.id] = di; });

      // Calculate totals and validate items
      let totalAmount = 0;
      const orderItemsToInsert: any[] = [];

      for (const item of items) {
        const seafoodId = item.id || item.itemId || item.seafoodItemId;
        if (!seafoodId) {
          return res.status(400).json({ error: 'Seafood item identifier is missing' });
        }

        const dbItem = dbItemsMap[seafoodId];
        const qty = parseFloat(item.quantity);
        if (isNaN(qty) || qty <= 0) {
          return res.status(400).json({ error: `Invalid quantity for item ${dbItem?.name || seafoodId}` });
        }

        const price = dbItem ? parseFloat(dbItem.unitPrice) : (parseFloat(item.unitPrice) || 0);
        const subtotal = qty * price;
        totalAmount += subtotal;

        orderItemsToInsert.push({
          itemId: seafoodId,
          quantity: qty,
          unitPrice: price,
          subtotal,
          seafoodItem: {
            name: dbItem?.name || item.name || 'Fresh Seafood Item',
            unit: dbItem?.unit || item.unit || 'kg',
            category: dbItem?.category || 'Seafood',
          }
        });
      }

      // Generate Invoice Number (e.g., INV-YYYYMM-XXXX)
      const now = new Date();
      const yearStr = now.getFullYear();
      const monthStr = String(now.getMonth() + 1).padStart(2, '0');
      const randomSeq = Math.floor(1000 + Math.random() * 9000);
      const invoiceNo = `INV-${yearStr}${monthStr}-${randomSeq}`;

      const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // Insert Order
      await prisma.$executeRawUnsafe(`
        INSERT INTO "SeafoodOrder" (
          "id", "invoiceNo", "userId", "totalAmount", "status", "notes", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3::uuid, $4, 'ORDERED', $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `, orderId, invoiceNo, authUser.id, totalAmount, notes ? notes.trim() : null);

      // Insert Order Items with rollback safeguard
      try {
        for (const item of orderItemsToInsert) {
          const itemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
          await prisma.$executeRawUnsafe(`
            INSERT INTO "SeafoodOrderItem" (
              "id", "orderId", "itemId", "quantity", "unitPrice", "subtotal"
            ) VALUES (
              $1, $2, $3, $4, $5, $6
            )
          `, itemId, orderId, item.itemId, item.quantity, item.unitPrice, item.subtotal);
        }
      } catch (insertError: any) {
        // Rollback created order to prevent orphaned records
        await prisma.$executeRawUnsafe(`DELETE FROM "SeafoodOrder" WHERE "id" = $1`, orderId);
        throw insertError;
      }

      const createdOrder = {
        id: orderId,
        orderId,
        invoiceNo,
        invoiceNumber: invoiceNo,
        userId: authUser.id,
        totalAmount,
        status: 'ORDERED',
        isDispatchedBySales: false,
        isReceivedByEmployee: false,
        notes: notes ? notes.trim() : null,
        createdAt: new Date().toISOString(),
        user: {
          id: authUser.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          department: user.department,
          position: user.position,
        },
        items: orderItemsToInsert.map((oi, index) => ({
          id: `item_${Date.now()}_${index}`,
          orderId,
          itemId: oi.itemId,
          quantity: oi.quantity,
          unitPrice: oi.unitPrice,
          totalPrice: oi.subtotal,
          subtotal: oi.subtotal,
          seafoodItem: oi.seafoodItem,
        })),
      };

      return res.status(201).json(createdOrder);
    } catch (error: any) {
      console.error('Error placing seafood order:', error);
      return res.status(500).json({ error: error.message || 'Failed to place order' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}
