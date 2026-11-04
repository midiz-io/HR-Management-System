import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { ensureSectionalHeadAndNewTables } from '@/lib/sectionalHeadDb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  await ensureSectionalHeadAndNewTables();
  const supabase = createClient(req, res);
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { noticeId, noticeIds } = req.body;

    const idsToMark: string[] = [];
    if (noticeId) idsToMark.push(noticeId);
    if (noticeIds && Array.isArray(noticeIds)) {
      noticeIds.forEach((id: string) => {
        if (id && !idsToMark.includes(id)) idsToMark.push(id);
      });
    }

    if (idsToMark.length === 0) {
      return res.status(400).json({ error: 'Notice ID(s) required' });
    }

    for (const nId of idsToMark) {
      const readId = `read_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await prisma.$executeRawUnsafe(`
        INSERT INTO "NoticeReadStatus" ("id", "noticeId", "userId", "readAt")
        VALUES ($1, $2, $3::uuid, CURRENT_TIMESTAMP)
        ON CONFLICT ("noticeId", "userId") DO NOTHING
      `, readId, nId, authUser.id);
    }

    return res.status(200).json({ success: true, count: idsToMark.length });
  } catch (error: any) {
    console.error('Error dismissing notice:', error);
    return res.status(500).json({ error: error.message || 'Failed to dismiss notice' });
  }
}
