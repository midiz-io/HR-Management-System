import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { ensureSectionalHeadAndNewTables } from '@/lib/sectionalHeadDb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureSectionalHeadAndNewTables();

  // GET: Fetch all seafood price list items
  if (req.method === 'GET') {
    try {
      const items = await prisma.$queryRawUnsafe(`
        SELECT * FROM "SeafoodItem" ORDER BY "category" ASC, "name" ASC
      `);
      return res.status(200).json(items);
    } catch (error: any) {
      console.error('Error fetching seafood catalog:', error);
      return res.status(500).json({ error: 'Failed to load seafood catalog' });
    }
  }

  // POST: Add or update seafood item (Admin / Sales / HR)
  if (req.method === 'POST') {
    const supabase = createClient(req, res);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const { id, name, description, category, unit, unitPrice, inStock, imageUrl } = req.body;

      if (!name || unitPrice === undefined) {
        return res.status(400).json({ error: 'Item name and unit price are required' });
      }

      if (id) {
        // Update existing item
        await prisma.$executeRawUnsafe(`
          UPDATE "SeafoodItem"
          SET "name" = $1, "description" = $2, "category" = $3, "unit" = $4,
              "unitPrice" = $5, "inStock" = $6, "imageUrl" = $7, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $8
        `, name, description || null, category || 'Fish', unit || 'kg', parseFloat(unitPrice), inStock !== false, imageUrl || null, id);
      } else {
        // Create new item
        const newId = `sea_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await prisma.$executeRawUnsafe(`
          INSERT INTO "SeafoodItem" (
            "id", "name", "description", "category", "unit", "unitPrice", "inStock", "imageUrl", "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `, newId, name, description || null, category || 'Fish', unit || 'kg', parseFloat(unitPrice), inStock !== false, imageUrl || null);
      }

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('Error saving seafood item:', error);
      return res.status(500).json({ error: error.message || 'Failed to save seafood item' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}
