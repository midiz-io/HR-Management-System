import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Initialize Supabase client
    const supabase = createClient(req, res);

    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify the caller's role (must be Admin, Super Admin, Manager, or Dept Head)
    let currentUser;
    try {
      currentUser = await prisma.user.findUnique({
        where: { email: session.user.email! }
      });
    } catch (prismaError: any) {
      if (prismaError.code === 'P2022' && prismaError.message && prismaError.message.includes('isResigned')) {
        console.log('Detected missing isResigned column in resign.ts. Attempting self-healing...');
        await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "isResigned" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "resignedAt" TIMESTAMP(3)`);
        currentUser = await prisma.user.findUnique({
          where: { email: session.user.email! }
        });
      } else {
        throw prismaError;
      }
    }

    if (!currentUser || (currentUser.role === 'EMPLOYEE')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Perform operations in a transaction
    await prisma.$transaction(async (tx) => {
      // We only update the user status to resigned. 
      // Historical records like attendance, payroll, leaves, etc., are kept intact.
      await tx.user.update({
        where: { id },
        data: {
          isResigned: true,
          resignedAt: new Date()
        }
      });
    });

    return res.status(200).json({ message: 'Employee resigned successfully' });
  } catch (error: any) {
    console.error('Error in resign API:', error);
    // Send back the specific error message to help debug what Prisma is failing on
    return res.status(500).json({ 
      error: error?.message ? `Failed to resign user: ${error.message}` : 'Internal server error during resignation'
    });
  }
}
