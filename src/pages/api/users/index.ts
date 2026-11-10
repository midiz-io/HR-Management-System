import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

async function attachPasswordsToUsers(users: any[]) {
  let passwordsMap: Record<string, string> = {};
  try {
    const pwdSetting = await prisma.systemSetting.findUnique({
      where: { key: 'USER_PASSWORDS' },
    });
    if (pwdSetting?.value) {
      passwordsMap = JSON.parse(pwdSetting.value);
    }
  } catch (e) {
    console.warn('Could not load USER_PASSWORDS setting:', e);
  }

  return users.map((u) => {
    const cleanEmail = (u.email || '').trim().toLowerCase();
    const savedPassword = passwordsMap[u.id] || passwordsMap[u.email] || passwordsMap[cleanEmail];
    let defaultPwd = 'User@123';
    if (u.role === 'SUPER_ADMIN') defaultPwd = 'SuperAdmin@2026';
    else if (u.role === 'ADMIN') defaultPwd = 'Admin@2026';
    else if (u.role === 'MANAGER') defaultPwd = 'Manager@2026';
    else {
      const prefix = (u.firstName || u.email.split('@')[0] || 'User').replace(/[^a-zA-Z0-9]/g, '');
      defaultPwd = `${prefix}@123`;
    }

    return {
      ...u,
      password: savedPassword || defaultPwd,
    };
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check if cookies exist in the request
  if (!req.cookies || Object.keys(req.cookies).length === 0) {
    return res.status(401).json({ error: 'No authentication cookies found' });
  }

  let user;
  try {
    // Get the user from the request
    const supabase = createClient(req, res);
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      console.error('Authentication error:', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    user = data.user;

    // Check if the user is an admin (by ID or case-insensitive email fallback)
    let userData = await prisma.user.findUnique({
      where: { id: user.id },
    });
    if (!userData && user.email) {
      userData = await prisma.user.findFirst({
        where: { email: { equals: user.email.trim(), mode: 'insensitive' } },
      });
    }

    if (!userData || ((userData.role as any) !== 'ADMIN' && (userData.role as any) !== 'SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
  } catch (authError) {
    console.error('Error in authentication:', authError);
    return res.status(401).json({ error: 'Authentication failed' });
  }

  // Handle GET request - Get all users
  if (req.method === 'GET') {
    try {
      const { resignedOnly, role } = req.query;
      const isResignedFilter = resignedOnly === 'true' ? true : false;
      
      const whereClause: any = { isResigned: isResignedFilter };
      if (role && typeof role === 'string') {
        whereClause.role = role;
      }
      
      try {
        const users = await prisma.user.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
        });
        const usersWithPasswords = await attachPasswordsToUsers(users);
        return res.status(200).json(usersWithPasswords);
      } catch (prismaError: any) {
        if (prismaError.code === 'P2022' && prismaError.message && prismaError.message.includes('isResigned')) {
          console.log('Detected missing isResigned column. Attempting self-healing...');
          await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "isResigned" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "resignedAt" TIMESTAMP(3)`);
          console.log('Self-healing of isResigned column successful.');
          const users = await prisma.user.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
          });
          const usersWithPasswords = await attachPasswordsToUsers(users);
          return res.status(200).json(usersWithPasswords);
        } else {
          throw prismaError;
        }
      }
    } catch (error: any) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ error: 'Failed to fetch users', details: error.message, stack: error.stack });
    }
  }

  // Handle POST request - Create a new user (for admin to create users)
  if (req.method === 'POST') {
    try {
      const { email, firstName, lastName, role, department, position } = req.body;

      // Validate required fields
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }

      // Create user in database
      const newUser = await prisma.user.create({
        data: {
          id: 'placeholder', // This would be the Supabase user ID in a real implementation
          email,
          firstName,
          lastName,
          role: role || 'EMPLOYEE',
          department,
          position,
        },
      });

      return res.status(201).json(newUser);
    } catch (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({ error: 'Failed to create user' });
    }
  }

  // Return 405 for other methods
  return res.status(405).json({ error: 'Method not allowed' });
}
