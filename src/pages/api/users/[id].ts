import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { syncSupabaseAuthCredentials } from '@/pages/api/auth/sync-credentials';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Get the user from the request
  const supabase = createClient(req, res);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

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

  // Get the user ID from the URL
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  // Handle GET request - Get a specific user
  if (req.method === 'GET') {
    try {
      const targetUser = await prisma.user.findUnique({
        where: { id },
        include: {
          salaryConfig: {
            select: { offDaysCount: true, basicSalary: true },
          },
        },
      });

      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json(targetUser);
    } catch (error) {
      console.error('Error fetching user:', error);
      return res.status(500).json({ error: 'Failed to fetch user' });
    }
  }

  // Handle PATCH request - Update a user
  if (req.method === 'PATCH') {
    try {
      const { firstName, lastName, role, department, position, joinDate, locationId, offDaysCount } =
        req.body;

      // Handle the joinDate update with raw SQL to bypass Prisma model validation issues
      if (joinDate !== undefined) {
        try {
          const joinDateVal = joinDate ? new Date(joinDate) : null;
          // Explicitly cast the ID to UUID to avoid type mismatch errors
          await prisma.$executeRaw`UPDATE "User" SET "joinDate" = ${joinDateVal} WHERE "id" = ${id}::uuid`;
        } catch (rawError) {
          console.error('Raw SQL JoinDate update failed:', rawError);
          // Attempt self-healing by adding the column if missing
          try {
            await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "joinDate" TIMESTAMP WITH TIME ZONE`;
            const joinDateVal = joinDate ? new Date(joinDate) : null;
            await prisma.$executeRaw`UPDATE "User" SET "joinDate" = ${joinDateVal} WHERE "id" = ${id}::uuid`;
          } catch (retryError) {
            console.error('Self-healing failed:', retryError);
          }
        }
      }

      // Handle the locationId update with raw SQL to bypass Prisma client sync issues
      if (locationId !== undefined) {
        try {
          await prisma.$executeRaw`UPDATE "User" SET "locationId" = ${locationId} WHERE "id" = ${id}::uuid`;
        } catch (locError) {
          console.error('Raw SQL LocationId update failed:', locError);
          // Attempt self-healing by adding the column if missing
          try {
            await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "locationId" TEXT`;
            await prisma.$executeRaw`UPDATE "User" SET "locationId" = ${locationId} WHERE "id" = ${id}::uuid`;
          } catch (retryError) {
            console.error('Self-healing failed for locationId:', retryError);
          }
        }
      }

      // Handle the phoneNumber update
      if (req.body.phoneNumber !== undefined) {
        try {
          await prisma.$executeRaw`UPDATE "User" SET "phoneNumber" = ${req.body.phoneNumber} WHERE "id" = ${id}::uuid`;
        } catch (phoneError) {
          console.error('Raw SQL PhoneNumber update failed:', phoneError);
          // Attempt self-healing by adding the column if missing
          try {
            await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT`;
            await prisma.$executeRaw`UPDATE "User" SET "phoneNumber" = ${req.body.phoneNumber} WHERE "id" = ${id}::uuid`;
          } catch (retryError) {
            console.error('Self-healing failed for phoneNumber:', retryError);
          }
        }
      }

      if (offDaysCount !== undefined) {
        const count = Math.max(0, parseFloat(offDaysCount) || 0);
        const existingConfig = await prisma.salaryConfig.findUnique({
          where: { userId: id },
        });
        if (existingConfig) {
          await prisma.salaryConfig.update({
            where: { userId: id },
            data: { offDaysCount: count },
          });
        } else {
          await prisma.salaryConfig.create({
            data: {
              userId: id,
              basicSalary: 0,
              offDaysCount: count,
            },
          });
        }
      }

      // Prepare data object for regular Prisma update
      const updateData: any = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (role !== undefined) updateData.role = role;
      if (department !== undefined) updateData.department = department;
      if (position !== undefined) updateData.position = position;

      // Perform regular Prisma update for other fields
      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
      });

      // If role was updated (e.g. to ADMIN), ensure auth.users is confirmed and synced with displayed password if no custom password is set
      if (role !== undefined && updatedUser.email) {
        try {
          const pwdSetting = await prisma.systemSetting.findUnique({
            where: { key: 'USER_PASSWORDS' },
          });
          const passwordsMap: Record<string, string> = pwdSetting?.value ? JSON.parse(pwdSetting.value) : {};
          const cleanEmail = updatedUser.email.trim().toLowerCase();
          const existingSavedPwd = passwordsMap[id] || passwordsMap[updatedUser.email] || passwordsMap[cleanEmail];

          if (!existingSavedPwd && (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'MANAGER')) {
            const targetPwd =
              role === 'SUPER_ADMIN' ? 'SuperAdmin@2026' : role === 'ADMIN' ? 'Admin@2026' : 'Manager@2026';
            await syncSupabaseAuthCredentials(id, cleanEmail, targetPwd);
          } else if (existingSavedPwd) {
            await syncSupabaseAuthCredentials(id, cleanEmail, existingSavedPwd);
          }
        } catch (rolePwdSyncErr) {
          console.warn('Warning syncing role default password to auth.users:', rolePwdSyncErr);
        }
      }

      // Manually add the official joinDate and locationId back to the response since Prisma might ignore them if model is old
      try {
        const rawData: any[] = await prisma.$queryRaw`SELECT "joinDate", "locationId" FROM "User" WHERE id = ${id}::uuid`;
        if (rawData && rawData.length > 0) {
          (updatedUser as any).joinDate = rawData[0].joinDate;
          (updatedUser as any).locationId = rawData[0].locationId;
        }
      } catch (rawErr) {
        console.error('Failed to attach raw fields to response:', rawErr);
      }

      return res.status(200).json(updatedUser);
    } catch (error: any) {
      console.error('Error updating user detail:', error);
      if (error.code) {
        console.error('Prisma error code:', error.code);
        console.error('Prisma error meta:', error.meta);
      }
      return res.status(500).json({ 
        error: 'Failed to update user',
        details: error.message 
      });
    }
  }

  // Handle DELETE request - Delete a user
  if (req.method === 'DELETE') {
    try {
      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Prevent deleting yourself
      if (existingUser.id === user.id) {
        return res.status(400).json({ error: 'You cannot delete your own account' });
      }

      // Prevent deleting the last admin
      if (existingUser.role === 'ADMIN') {
        const adminCount = await prisma.user.count({
          where: { role: 'ADMIN' },
        });
        if (adminCount <= 1) {
          return res.status(400).json({ error: 'Cannot delete the last admin user' });
        }
      }

      // Delete related records first (cascading delete)
      // Delete attendances
      await prisma.attendance.deleteMany({
        where: { userId: id },
      });

      // Delete leave requests
      await prisma.leaveRequest.deleteMany({
        where: { userId: id },
      });

      // Delete leave balances
      await prisma.leaveBalance.deleteMany({
        where: { userId: id },
      });

      // Delete rosters
      await prisma.roster.deleteMany({
        where: { userId: id },
      });

      // Delete notification subscriptions
      await prisma.notificationSubscription.deleteMany({
        where: { userId: id },
      });

      // Delete tasks assigned to this user
      await prisma.task.deleteMany({
        where: { assignedToId: id },
      });

      // Delete tasks created by this user
      await prisma.task.deleteMany({
        where: { assignedById: id },
      });

      // Delete task messages
      await prisma.taskMessage.deleteMany({
        where: { userId: id },
      });

      // Remove user from location admins (many-to-many relation)
      // Use Prisma disconnect to avoid replica identity issues
      try {
        const locations = await prisma.location.findMany({
          where: {
            admins: {
              some: { id },
            },
          },
          select: { id: true },
        });

        for (const location of locations) {
          await prisma.location.update({
            where: { id: location.id },
            data: {
              admins: {
                disconnect: { id },
              },
            },
          });
        }
      } catch (locationError) {
        // If disconnect fails, try to set replica identity and retry, or continue
        console.warn('Warning: Could not disconnect user from locations:', locationError);
      }

      // Remove user from work shifts (many-to-many relation)
      try {
        const workShifts = await prisma.workShift.findMany({
          where: {
            employees: {
              some: { id },
            },
          },
          select: { id: true },
        });

        for (const workShift of workShifts) {
          await prisma.workShift.update({
            where: { id: workShift.id },
            data: {
              employees: {
                disconnect: { id },
              },
            },
          });
        }
      } catch (workShiftError) {
        console.warn('Warning: Could not disconnect user from work shifts:', workShiftError);
      }

      // Set replica identity for join tables if needed, then delete user
      // This allows deletion even with replication enabled
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "_LocationAdmins" REPLICA IDENTITY FULL;
        `);
      } catch (alterError) {
        // Table might already have replica identity set, continue
        console.warn('Warning: Could not set replica identity for _LocationAdmins:', alterError);
      }

      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "_EmployeeWorkShifts" REPLICA IDENTITY FULL;
        `);
      } catch (alterError) {
        // Table might already have replica identity set, continue
        console.warn('Warning: Could not set replica identity for _EmployeeWorkShifts:', alterError);
      }

      // Finally, delete the user
      await prisma.user.delete({
        where: { id },
      });

      return res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      return res.status(500).json({ error: 'Failed to delete user' });
    }
  }

  // Return 405 for other methods
  return res.status(405).json({ error: 'Method not allowed' });
}