import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import {
  ensureCompanyDocumentTables,
  dbFindUniqueDocument,
  dbUpsertAcknowledgement,
} from '@/lib/companyDocumentsDb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    await ensureCompanyDocumentTables();
  } catch (e) {
    // ignore
  }

  const supabase = createClient(req, res);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Valid document ID is required' });
  }

  try {
    const doc = await dbFindUniqueDocument(id);

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (!doc.isActive) {
      return res.status(400).json({ error: 'This document is no longer active' });
    }

    const { notes } = req.body || {};
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null;

    const ack = await dbUpsertAcknowledgement({
      documentId: doc.id,
      userId: user.id,
      version: doc.version,
      ipAddress: typeof ipAddress === 'string' ? ipAddress.split(',')[0].trim() : null,
      notes: notes || null,
    });

    return res.status(200).json({
      success: true,
      message: `You have successfully acknowledged "${doc.title}" (${doc.version})`,
      acknowledgement: ack,
    });
  } catch (error: any) {
    console.error('Error acknowledging document:', error);
    return res.status(500).json({ error: error.message || 'Failed to acknowledge document' });
  }
}
