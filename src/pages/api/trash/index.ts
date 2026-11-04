import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const records = await prisma.trashRecord.findMany({
        orderBy: { deletedAt: 'desc' },
      });
      return res.status(200).json(records);
    } catch (error: any) {
      console.error('Error fetching trash records:', error);
      return res.status(500).json({ error: 'Failed to fetch trash records' });
    }
  }

  if (req.method === 'POST') {
    // Restore record
    try {
      const { id } = req.body;
      const trashRecord = await prisma.trashRecord.findUnique({
        where: { id },
      });

      if (!trashRecord) {
        return res.status(404).json({ error: 'Trash record not found' });
      }

      // Re-insert into original table using $executeRawUnsafe to bypass typed client 
      // if needed, or if Prisma supports dynamic creates.
      // But we don't have a reliable way to map json back to typed create dynamically easily
      // Let's use standard prisma dynamic model access
      const modelName = trashRecord.tableName;
      const modelClient = (prisma as any)[modelName];
      
      if (!modelClient) {
        return res.status(400).json({ error: `Model ${modelName} not found` });
      }

      const dataToRestore = trashRecord.recordData as any;
      
      // Clean up metadata that shouldn't be restored directly, though id should be kept
      // if the table relies on generated fields. Actually Prisma allows setting id if it's explicitly provided.

      try {
        await modelClient.create({
          data: dataToRestore,
        });
      } catch (insertError: any) {
         // If it fails (e.g. duplicate constraint), we might want to log it
         console.error('Insert error:', insertError);
         return res.status(500).json({ error: 'Failed to restore: ' + insertError.message });
      }

      // Delete the trash record
      await prisma.trashRecord.delete({
        where: { id },
      });

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('Error restoring trash record:', error);
      return res.status(500).json({ error: 'Failed to restore trash record' });
    }
  }

  if (req.method === 'DELETE') {
    // Permanently delete from trash
    try {
      const { id } = req.query;
      
      if (id === 'all') {
        await prisma.trashRecord.deleteMany();
      } else {
        await prisma.trashRecord.delete({
          where: { id: String(id) },
        });
      }

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('Error permanently deleting trash record:', error);
      return res.status(500).json({ error: 'Failed to delete trash record' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
