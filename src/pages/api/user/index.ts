import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

function getOfflineUserId(req: NextApiRequest): string | null {
  try {
    for (const key of Object.keys(req.cookies)) {
      if (
        (key.startsWith('sb-') && (key.endsWith('-auth-token') || key.endsWith('-access-token'))) ||
        key === 'sb-access-token'
      ) {
        const val = req.cookies[key];
        if (val) {
          let token: string = val.trim();
          try {
            const parsed = JSON.parse(token);
            if (Array.isArray(parsed)) {
              token = parsed[0];
            } else if (parsed && typeof parsed === 'object') {
              token = parsed.access_token || parsed.token || null;
            } else if (typeof parsed === 'string') {
              token = parsed;
            }
          } catch {
            // Keep original
          }
          
          if (token) {
            token = token.trim();
            if (token.startsWith('"') && token.endsWith('"')) {
              token = token.slice(1, -1);
            }
            if (token.includes('.')) {
              const parts = token.split('.');
              if (parts.length === 3) {
                const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
                if (payload && payload.sub) {
                  return payload.sub;
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Offline JWT decoding error:', err);
  }
  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // If 'id' is provided in query and it's a GET request, allow it (Public Verification)
  if (req.method === 'GET' && req.query.id) {
    return handleUserRequest(req, res, req.query.id as string);
  }

  // Try to get user from authorization header first
  const userId = req.headers.authorization;

  // If no authorization header, try to get from Supabase cookies
  if (!userId) {
    // Check if cookies exist in the request
    if (!req.cookies || Object.keys(req.cookies).length === 0) {
      // In development mode, allow offline bypass even if no cookies exist
      if (process.env.NODE_ENV === 'development') {
        try {
          const devUser = await prisma.user.findFirst();
          if (devUser) {
            console.log('Premium Offline Development Bypass (No Cookies): Authenticated as first database user:', devUser.id);
            await handleUserRequest(req, res, devUser.id);
            return;
          }
        } catch (dbErr) {
          console.error('Database query failed in cookies check:', dbErr);
        }
      }
      return res.status(401).json({ error: 'No authentication found' });
    }

    try {
      const supabase = createClient(req, res);
      const { data: { session }, error } = await supabase.auth.getSession();
      const user = session?.user || null;

      if (error || !user) {
        console.error('Authentication error:', error);

        // Offline / Connection Timeout Fallback:
        // If Supabase API fetch failed (e.g. timeout, DNS, offline), we decode the JWT locally.
        let offlineUserId = getOfflineUserId(req);
        if (!offlineUserId && process.env.NODE_ENV === 'development') {
          try {
            const devUser = await prisma.user.findFirst();
            if (devUser) {
              offlineUserId = devUser.id;
              console.log('Premium Offline Development Fallback: Authenticated as first database user:', offlineUserId);
            }
          } catch (dbErr) {
            console.error('Failed to fetch development fallback user:', dbErr);
          }
        }

        if (offlineUserId) {
          await handleUserRequest(req, res, offlineUserId);
          return;
        }

        return res.status(401).json({ error: 'Unauthorized' });
      }

      await handleUserRequest(req, res, user.id);
    } catch (error) {
      console.error('Error in API handler:', error);

      // Fallback if auth.getUser throws directly
      let offlineUserId = getOfflineUserId(req);
      if (!offlineUserId && process.env.NODE_ENV === 'development') {
        try {
          const devUser = await prisma.user.findFirst();
          if (devUser) {
            offlineUserId = devUser.id;
            console.log('Premium Offline Development Fallback (catch block): Authenticated as first database user:', offlineUserId);
          }
        } catch (dbErr) {
          console.error('Failed to fetch development fallback user in catch block:', dbErr);
        }
      }

      if (offlineUserId) {
        await handleUserRequest(req, res, offlineUserId);
        return;
      }

      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    // Use the user ID from the authorization header
    await handleUserRequest(req, res, userId);
  }
}

async function handleUserRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {

  // Handle GET request - Get user data
  if (req.method === 'GET') {
    try {
      // First try to get user from Prisma
      let userData;
      try {
        userData = await prisma.user.findUnique({
          where: { id: userId },
        });
      } catch (prismaError: any) {
        // Self-healing: If we find the 'SUPERADMIN' typo error, try to fix it
        if (prismaError.message && prismaError.message.includes("'SUPERADMIN' not found")) {
          console.log('Detected Role Typo. Attempting self-healing...');
          try {
            // 1. Ensure SUPER_ADMIN exists in the enum
            try {
              await prisma.$executeRawUnsafe(`ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN'`);
            } catch (enumError) {
              // Ignore if it already exists
            }
            // 2. Use raw SQL to fix the typo since the Client won't allow the typo value
            await prisma.$executeRawUnsafe(`UPDATE "User" SET "role" = 'SUPER_ADMIN' WHERE "role"::text = 'SUPERADMIN'`);
            console.log('Self-healing successful.');
            // Retry the original request
            userData = await prisma.user.findUnique({
              where: { id: userId },
            });
          } catch (fixError) {
            console.error('Self-healing failed:', fixError);
            throw prismaError; // Re-throw original error if fix failed
          }
        } else if (prismaError.code === 'P2022' && prismaError.message && prismaError.message.includes('isResigned')) {
          console.log('Detected missing isResigned column. Attempting self-healing...');
          try {
            await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "isResigned" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "resignedAt" TIMESTAMP(3)`);
            console.log('Self-healing of isResigned column successful.');
            // Retry the original request
            userData = await prisma.user.findUnique({
              where: { id: userId },
            });
          } catch (fixError) {
            console.error('Self-healing failed for isResigned:', fixError);
            throw prismaError;
          }
        } else {
          throw prismaError;
        }
      }

      if (userData) {
        // Manually fetch fields that might not be in the Prisma Client yet
        try {
          const rawData: any[] = await prisma.$queryRaw`SELECT "joinDate", "profileImage", "sequentialId", "nic", "dob", "phoneNumber", "idCardStyle", "idCardLogoScale" FROM "User" WHERE id = ${userId}::uuid`;
          if (rawData && rawData.length > 0) {
            if (rawData[0].joinDate) (userData as any).joinDate = rawData[0].joinDate;
            if (rawData[0].profileImage) (userData as any).profileImage = rawData[0].profileImage;
            if (rawData[0].sequentialId) (userData as any).sequentialId = rawData[0].sequentialId;
            if (rawData[0].nic) (userData as any).nic = rawData[0].nic;
            if (rawData[0].dob) (userData as any).dob = rawData[0].dob;
            if (rawData[0].phoneNumber) (userData as any).phoneNumber = rawData[0].phoneNumber;
            if (rawData[0].idCardStyle) (userData as any).idCardStyle = rawData[0].idCardStyle;
            if (rawData[0].idCardLogoScale) (userData as any).idCardLogoScale = rawData[0].idCardLogoScale;
          }
        } catch (rawError) {
          // If query fails, columns likely don't exist yet, ignore
          console.error('Error fetching extra fields via raw SQL:', rawError);
        }
        return res.status(200).json(userData);
      }

      // If not found in Prisma, try to create the user
      // Get email from Supabase if available
      let email = '';
      try {
        const supabase = createClient(req, res);
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          email = session.user.email || '';
        }
      } catch (error) {
        console.error('Error getting user email from Supabase session:', error);
      }

      const newUser = await prisma.user.create({
        data: {
          id: userId,
          email: email,
          firstName: null,
          lastName: null,
          role: 'EMPLOYEE',
          department: null,
          position: null,
        },
      });

      return res.status(200).json(newUser);
    } catch (error) {
      console.error('Error fetching or creating user data:', error);
      return res.status(500).json({ error: 'Failed to fetch user data' });
    }
  }

  // Handle PATCH request - Update user data
  if (req.method === 'PATCH') {
    try {
      const { firstName, lastName, department, position, role, email, profileImage, joinDate, phoneNumber, nic, dob, idCardStyle, idCardLogoScale } = req.body;

      // First check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        // Create user if not exists
        const newUser = await prisma.user.create({
          data: {
            id: userId,
            email: email || '',
            firstName,
            lastName,
            department,
            position,
            profileImage,
            joinDate: joinDate ? new Date(joinDate) : null,
            role: role || 'EMPLOYEE',
            phoneNumber,
            nic,
            dob,
          },
        });
        return res.status(200).json(newUser);
      }

      // Update user data
      let updatedUser;
      try {
        updatedUser = await prisma.user.update({
          where: { id: userId },
          data: {
            ...(email && { email }),
            ...(firstName !== undefined && { firstName }),
            ...(lastName !== undefined && { lastName }),
            ...(department !== undefined && { department }),
            ...(position !== undefined && { position }),
            ...(profileImage !== undefined && { profileImage }),
            ...(joinDate !== undefined && { joinDate: joinDate ? new Date(joinDate) : null }),
            ...(role && { role }), // Only include role if it's provided
            ...(phoneNumber !== undefined && { phoneNumber }),
            ...(nic !== undefined && { nic }),
            ...(dob !== undefined && { dob }),
          },
        });

        // Always update extra custom fields via raw SQL since they aren't in Prisma schema yet
        if (idCardStyle !== undefined) {
          await prisma.$executeRawUnsafe(
            `UPDATE "User" SET "idCardStyle" = $1 WHERE id = $2::uuid`,
            idCardStyle,
            userId
          );
        }
        if (idCardLogoScale !== undefined) {
          await prisma.$executeRawUnsafe(
            `UPDATE "User" SET "idCardLogoScale" = $1 WHERE id = $2::uuid`,
            idCardLogoScale,
            userId
          );
        }
        
        // Re-fetch user to make sure we return updated custom fields
        updatedUser = await prisma.user.findUnique({
          where: { id: userId },
        });
      } catch (prismaUpdateError) {
        console.warn('Prisma update failed, attempting raw SQL fallback:', prismaUpdateError);
        
        // Fallback for fields that might not be in the Prisma client yet
        if (profileImage !== undefined) {
          await prisma.$executeRawUnsafe(
            `UPDATE "User" SET "profileImage" = $1 WHERE id = $2::uuid`,
            profileImage,
            userId
          );
        }
        
        if (joinDate !== undefined) {
          await prisma.$executeRawUnsafe(
            `UPDATE "User" SET "joinDate" = $1 WHERE id = $2::uuid`,
            joinDate ? new Date(joinDate) : null,
            userId
          );
        }

        if (phoneNumber !== undefined) {
          await prisma.$executeRawUnsafe(
            `UPDATE "User" SET "phoneNumber" = $1 WHERE id = $2::uuid`,
            phoneNumber,
            userId
          );
        }

        if (nic !== undefined) {
          await prisma.$executeRawUnsafe(
            `UPDATE "User" SET "nic" = $1 WHERE id = $2::uuid`,
            nic,
            userId
          );
        }

        if (dob !== undefined) {
          await prisma.$executeRawUnsafe(
            `UPDATE "User" SET "dob" = $1 WHERE id = $2::uuid`,
            dob,
            userId
          );
        }

        if (idCardStyle !== undefined) {
          await prisma.$executeRawUnsafe(
            `UPDATE "User" SET "idCardStyle" = $1 WHERE id = $2::uuid`,
            idCardStyle,
            userId
          );
        }

        if (idCardLogoScale !== undefined) {
          await prisma.$executeRawUnsafe(
            `UPDATE "User" SET "idCardLogoScale" = $1 WHERE id = $2::uuid`,
            idCardLogoScale,
            userId
          );
        }

        // Re-fetch to return the correct object
        updatedUser = await prisma.user.findUnique({
          where: { id: userId },
        });
      }

      return res.status(200).json(updatedUser);
    } catch (error) {
      console.error('Error updating user data:', error);
      return res.status(500).json({ error: 'Failed to update user data' });
    }
  }

  // Return 405 for other methods
  return res.status(405).json({ error: 'Method not allowed' });
}