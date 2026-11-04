import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { FoodOrderStatus } from '@prisma/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const supabase = createClient(req, res);
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Fetch full user record to check role
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'MANAGER';

  // GET: Fetch food orders
  if (req.method === 'GET') {
    try {
      const { userId, date } = req.query;

      const where: any = {};
      
      // If not admin, only show own orders
      if (!isAdmin) {
        where.userId = user.id;
      } else if (userId) {
        where.userId = userId as string;
      }

      if (date) {
        const queryDate = new Date(date as string);
        const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));
        where.date = {
          gte: startOfDay,
          lte: endOfDay,
        };
      }

      const orders = await prisma.foodOrder.findMany({
        where,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              department: true,
            }
          },
          approvedBy: {
            select: {
              firstName: true,
              lastName: true,
            }
          }
        },
        orderBy: {
          date: 'desc',
        }
      });

      return res.status(200).json(orders);
    } catch (error) {
      console.error('Error fetching food orders:', error);
      return res.status(500).json({ error: 'Failed to fetch food orders' });
    }
  }

  // POST: Create a food order
  if (req.method === 'POST') {
    try {
      const { mealType, date, notes, location } = req.body;

      if (!mealType || !date || !location) {
        return res.status(400).json({ error: 'Meal type, date, and location are required' });
      }

      const orderDate = new Date(date);
      
      // Check for existing order for this meal on this day
      const existingOrder = await prisma.foodOrder.findUnique({
        where: {
          userId_date_mealType: {
            userId: user.id,
            date: orderDate,
            mealType,
          }
        }
      });

      if (existingOrder) {
        return res.status(400).json({ error: 'Order already exists for this meal on this day' });
      }

      const newOrder = await prisma.foodOrder.create({
        data: {
          userId: user.id,
          date: orderDate,
          mealType,
          location,
          notes,
          status: 'PENDING',
        }
      });

      return res.status(201).json(newOrder);
    } catch (error) {
      console.error('Error creating food order:', error);
      return res.status(500).json({ error: 'Failed to create food order' });
    }
  }

  // PATCH: Update order status (Approve/Reject)
  if (req.method === 'PATCH') {
    if (!isAdmin) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    try {
      const { id, ids, status, notes } = req.body;

      if ((!id && !ids) || !status) {
        return res.status(400).json({ error: 'Order ID(s) and status are required' });
      }

      if (!Object.values(FoodOrderStatus).includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      if (ids && Array.isArray(ids)) {
        // Bulk update
        const updatedOrders = await prisma.foodOrder.updateMany({
          where: { id: { in: ids } },
          data: {
            status,
            approvedById: status === 'APPROVED' ? user.id : undefined,
            approvedAt: status === 'APPROVED' ? new Date() : undefined,
          }
        });
        return res.status(200).json(updatedOrders);
      } else {
        // Single update
        const updatedOrder = await prisma.foodOrder.update({
          where: { id },
          data: {
            status,
            notes: notes || undefined,
            approvedById: status === 'APPROVED' ? user.id : undefined,
            approvedAt: status === 'APPROVED' ? new Date() : undefined,
          }
        });
        return res.status(200).json(updatedOrder);
      }
    } catch (error) {
      console.error('Error updating food order:', error);
      return res.status(500).json({ error: 'Failed to update food order' });
    }
  }

  // DELETE: Delete food orders
  if (req.method === 'DELETE') {
    try {
      const { id, ids } = req.body;

      if (!id && !ids) {
        return res.status(400).json({ error: 'Order ID(s) are required' });
      }

      const targetIds = ids && Array.isArray(ids) ? ids : [id];

      // If not admin, only allow deleting own PENDING orders
      if (!isAdmin) {
        const ownPendingCount = await prisma.foodOrder.count({
          where: {
            id: { in: targetIds },
            userId: user.id,
            status: 'PENDING'
          }
        });

        if (ownPendingCount !== targetIds.length) {
          return res.status(403).json({ error: 'Forbidden: You can only delete your own pending orders' });
        }
      }

      const deleted = await prisma.foodOrder.deleteMany({
        where: {
          id: { in: targetIds }
        }
      });

      return res.status(200).json({ message: 'Orders deleted successfully', count: deleted.count });
    } catch (error) {
      console.error('Error deleting food orders:', error);
      return res.status(500).json({ error: 'Failed to delete food orders' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
