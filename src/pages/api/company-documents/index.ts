import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import {
  ensureCompanyDocumentTables,
  dbFindManyDocuments,
  dbCreateDocument,
} from '@/lib/companyDocumentsDb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureCompanyDocumentTables();
  } catch (initErr) {
    console.warn('DB init notice:', initErr);
  }

  const supabase = createClient(req, res);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, role: true, department: true },
  });

  if (!dbUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  const isAdmin = dbUser.role === 'ADMIN' || (dbUser.role as any) === 'SUPER_ADMIN' || dbUser.role === 'MANAGER';

  try {
    switch (req.method) {
      case 'GET':
        return await getDocuments(req, res, dbUser.id, isAdmin);
      case 'POST':
        if (!isAdmin) {
          return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }
        return await createDocument(req, res, dbUser.id);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (error: any) {
    console.error('Company Documents API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// GET all documents or pending documents for employee
async function getDocuments(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  isAdmin: boolean
) {
  const { category, search, includeInactive, pendingOnly } = req.query;

  // Total active non-resigned employees count for stats
  const totalEmployees = await prisma.user.count({
    where: {
      isResigned: false,
    },
  });

  const rawDocs = await dbFindManyDocuments({
    category: category as string,
    search: search as string,
    includeInactive: isAdmin && includeInactive === 'true',
    userId,
  });

  // Format documents with acknowledgement info
  let documents = rawDocs.map((doc: any) => {
    const acks = doc.acknowledgements || [];
    const userAcks = acks.filter((ack: any) => ack.userId === userId);
    const hasAcknowledgedAny = userAcks.length > 0;
    const latestUserAck = userAcks.sort(
      (a: any, b: any) => new Date(b.acknowledgedAt).getTime() - new Date(a.acknowledgedAt).getTime()
    )[0];

    const isLatestVersionAcknowledged = latestUserAck ? latestUserAck.version === doc.version : false;

    // Acknowledgements for the CURRENT latest version of the document
    const currentVersionAcks = acks.filter((ack: any) => ack.version === doc.version);
    const acknowledgedCount = currentVersionAcks.length;
    const pendingCount = Math.max(0, totalEmployees - acknowledgedCount);
    const acknowledgementRate = totalEmployees > 0 
      ? Math.round((acknowledgedCount / totalEmployees) * 100) 
      : 0;

    return {
      id: doc.id,
      title: doc.title,
      description: doc.description,
      category: doc.category,
      customCategory: doc.customCategory,
      companyScope: doc.companyScope || 'ALL',
      fileUrl: doc.fileUrl,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      fileType: doc.fileType,
      version: doc.version,
      versionNotes: doc.versionNotes,
      effectiveDate: doc.effectiveDate,
      isActive: doc.isActive,
      isRequired: doc.isRequired,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      createdBy: doc.createdBy,
      userAcknowledgement: {
        hasAcknowledged: isLatestVersionAcknowledged,
        hasAcknowledgedPreviousVersion: hasAcknowledgedAny && !isLatestVersionAcknowledged,
        acknowledgedVersion: latestUserAck?.version || null,
        acknowledgedAt: latestUserAck?.acknowledgedAt || null,
      },
      stats: {
        totalEmployees,
        acknowledgedCount,
        pendingCount,
        acknowledgementRate,
      },
    };
  });

  if (pendingOnly === 'true') {
    documents = documents.filter((d) => d.isActive && d.isRequired && !d.userAcknowledgement.hasAcknowledged);
  }

  // Calculate overall summary stats for employee
  const totalRequired = documents.filter((d) => d.isRequired && d.isActive).length;
  const userAcknowledgedTotal = documents.filter(
    (d) => d.isRequired && d.isActive && d.userAcknowledgement.hasAcknowledged
  ).length;
  const pendingActions = totalRequired - userAcknowledgedTotal;

  return res.status(200).json({
    documents,
    summary: {
      totalDocuments: documents.length,
      totalRequired,
      userAcknowledgedTotal,
      pendingActions: Math.max(0, pendingActions),
    },
  });
}

// POST create new document
async function createDocument(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
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

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Document title is required' });
  }

  if (!fileUrl || !fileUrl.trim()) {
    return res.status(400).json({ error: 'Document file URL is required' });
  }

  const validCategories = ['HR_POLICY', 'CODE_OF_CONDUCT', 'ACCOMMODATION_CODE_OF_CONDUCT', 'GENERAL'];
  const docCategory = validCategories.includes(category) ? category : 'HR_POLICY';

  const newDoc = await dbCreateDocument({
    title: title.trim(),
    description: description ? description.trim() : null,
    category: docCategory,
    customCategory: customCategory ? customCategory.trim() : null,
    companyScope: companyScope || 'ALL',
    fileUrl: fileUrl.trim(),
    fileName: fileName || 'document.pdf',
    fileSize: fileSize || null,
    fileType: fileType || 'application/pdf',
    version: version ? version.trim() : 'v1.0',
    versionNotes: versionNotes ? versionNotes.trim() : null,
    effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
    isRequired: isRequired !== undefined ? Boolean(isRequired) : true,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    userId,
  });

  return res.status(201).json({
    success: true,
    document: newDoc,
  });
}
