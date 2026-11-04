import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import {
  ensureCompanyDocumentTables,
  dbFindUniqueDocument,
  dbUpdateDocument,
  dbDeleteDocument,
} from '@/lib/companyDocumentsDb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, role: true },
  });

  if (!dbUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  const isAdmin = dbUser.role === 'ADMIN' || (dbUser.role as any) === 'SUPER_ADMIN' || dbUser.role === 'MANAGER';

  try {
    switch (req.method) {
      case 'GET':
        return await getDocumentById(res, id, dbUser.id);
      case 'PUT':
        if (!isAdmin) {
          return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }
        return await updateDocument(req, res, id);
      case 'DELETE':
        if (!isAdmin) {
          return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }
        return await deleteDocument(res, id);
      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (error: any) {
    console.error('Company Document [id] API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

async function getDocumentById(res: NextApiResponse, id: string, userId: string) {
  const doc = await dbFindUniqueDocument(id);

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const userAck = (doc.acknowledgements || []).find((ack: any) => ack.version === doc.version && ack.userId === userId);

  return res.status(200).json({
    document: {
      ...doc,
      userAcknowledgement: {
        hasAcknowledged: Boolean(userAck),
        acknowledgedVersion: userAck?.version || null,
        acknowledgedAt: userAck?.acknowledgedAt || null,
      },
    },
  });
}

async function updateDocument(req: NextApiRequest, res: NextApiResponse, id: string) {
  const {
    title,
    description,
    category,
    customCategory,
    companyScope,
    fileUrl,
    fileName,
    fileSize,
    fileType,
    version,
    versionNotes,
    effectiveDate,
    isRequired,
    isActive,
  } = req.body;

  const updateData: any = {};
  if (title !== undefined) updateData.title = title.trim();
  if (description !== undefined) updateData.description = description ? description.trim() : null;
  if (category !== undefined) updateData.category = category;
  if (customCategory !== undefined) updateData.customCategory = customCategory ? customCategory.trim() : null;
  if (companyScope !== undefined) updateData.companyScope = companyScope;
  if (fileUrl !== undefined) updateData.fileUrl = fileUrl.trim();
  if (fileName !== undefined) updateData.fileName = fileName.trim();
  if (fileSize !== undefined) updateData.fileSize = fileSize;
  if (fileType !== undefined) updateData.fileType = fileType;
  if (version !== undefined) updateData.version = version.trim();
  if (versionNotes !== undefined) updateData.versionNotes = versionNotes ? versionNotes.trim() : null;
  if (effectiveDate !== undefined) updateData.effectiveDate = new Date(effectiveDate);
  if (isRequired !== undefined) updateData.isRequired = Boolean(isRequired);
  if (isActive !== undefined) updateData.isActive = Boolean(isActive);

  const updatedDoc = await dbUpdateDocument(id, updateData);

  return res.status(200).json({
    success: true,
    document: updatedDoc,
  });
}

async function deleteDocument(res: NextApiResponse, id: string) {
  await dbDeleteDocument(id);

  return res.status(200).json({
    success: true,
    message: 'Document deleted successfully',
  });
}
