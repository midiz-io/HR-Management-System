import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import {
  ensureCompanyDocumentTables,
  dbFindUniqueDocument,
  dbGetAcknowledgementsForDoc,
} from '@/lib/companyDocumentsDb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
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

  // Admin access check
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (!dbUser || (dbUser.role !== 'ADMIN' && (dbUser.role as any) !== 'SUPER_ADMIN' && dbUser.role !== 'MANAGER')) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
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

    const acknowledgements = await dbGetAcknowledgementsForDoc(id);

    // Get all active employees to compute who is pending
    const allUsers = await prisma.user.findMany({
      where: {
        isResigned: false,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        department: true,
        position: true,
        role: true,
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' },
      ],
    });

    const userAckMap = new Map<string, any>();
    acknowledgements.forEach((ack: any) => {
      userAckMap.set(ack.userId, ack);
    });

    const auditList = allUsers.map((emp) => {
      const ack = userAckMap.get(emp.id);
      const isAcknowledged = Boolean(ack && ack.version === doc.version);
      const isOldVersion = Boolean(ack && ack.version !== doc.version);

      return {
        id: emp.id,
        name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email,
        email: emp.email,
        department: emp.department || 'General',
        position: emp.position || emp.role,
        isAcknowledged,
        isOldVersion,
        acknowledgedVersion: ack ? ack.version : null,
        acknowledgedAt: ack ? ack.acknowledgedAt : null,
        ipAddress: ack ? ack.ipAddress : null,
      };
    });

    const acknowledgedCount = auditList.filter((a) => a.isAcknowledged).length;
    const totalCount = auditList.length;

    return res.status(200).json({
      document: {
        id: doc.id,
        title: doc.title,
        version: doc.version,
        category: doc.category,
      },
      stats: {
        totalEmployees: totalCount,
        acknowledgedCount,
        pendingCount: Math.max(0, totalCount - acknowledgedCount),
        rate: totalCount > 0 ? Math.round((acknowledgedCount / totalCount) * 100) : 0,
      },
      employees: auditList,
    });
  } catch (error: any) {
    console.error('Error fetching document acknowledgements:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
