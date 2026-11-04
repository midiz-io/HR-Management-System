import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const users = await prisma.user.findMany({
      where: { isResigned: false }
    });
    return res.status(200).json({ success: true, count: users.length });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message, code: error.code });
  }
}
