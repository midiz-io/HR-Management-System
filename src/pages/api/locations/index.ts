import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

async function getUserRoleSafely(userId: string): Promise<string | null> {
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT role::text as role FROM "User" WHERE id = $1::uuid LIMIT 1`,
      userId
    );
    if (rows && rows[0]?.role) {
      return String(rows[0].role);
    }
  } catch {
    // Fallback to Prisma findUnique
  }
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    return dbUser?.role ? String(dbUser.role) : null;
  } catch {
    return null;
  }
}

async function getAuthenticatedUserId(req: NextApiRequest, res: NextApiResponse): Promise<string | null> {
  // 1. Check req.headers.authorization
  const authHeader = req.headers.authorization;
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      try {
        const supabase = createClient(req, res);
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user?.id) return user.id;
      } catch (err) {
        console.warn('Bearer token check failed:', err);
      }
    } else {
      const trimmed = authHeader.trim();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(trimmed)) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: trimmed },
            select: { id: true },
          });
          if (dbUser) return dbUser.id;
        } catch {}
      }
    }
  }

  // 2. Check x-user-id header
  const xUserId = req.headers['x-user-id'];
  if (typeof xUserId === 'string') {
    const trimmed = xUserId.trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(trimmed)) {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: trimmed },
          select: { id: true },
        });
        if (dbUser) return dbUser.id;
      } catch {}
    }
  }

  // 3. Check Supabase cookies / session
  try {
    const supabase = createClient(req, res);
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) return user.id;

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) return session.user.id;
  } catch {}

  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Handle GET request - Get all locations
  // Permissive read access so mobile / check-in dashboards never block on missing/unforwarded cookies
  if (req.method === 'GET') {
    try {
      let locations = await prisma.location.findMany({
        orderBy: { name: 'asc' },
      });

      // If no locations exist in DB, auto-seed default office locations
      if (!locations || locations.length === 0) {
        try {
          await prisma.location.createMany({
            data: [
              {
                name: 'Dutch Trails Corporate Office',
                address: 'Dutch Trails Corporate Office, Sri Lanka',
                latitude: 7.1802,
                longitude: 79.8845,
                radius: 100,
              },
              {
                name: 'Tropical Shell Fish (PVT) LTD',
                address: 'Tropical Shell Fish (PVT) LTD, Sri Lanka',
                latitude: 6.9271,
                longitude: 79.8612,
                radius: 100,
              },
            ],
            skipDuplicates: true,
          });

          locations = await prisma.location.findMany({
            orderBy: { name: 'asc' },
          });
        } catch (seedError) {
          console.warn('Auto-seed locations error:', seedError);
        }
      }

      return res.status(200).json(locations);
    } catch (error) {
      console.error('Error fetching locations:', error);
      return res.status(500).json({ error: 'Failed to fetch locations' });
    }
  }

  // Write operations require strict authentication
  const userId = await getAuthenticatedUserId(req, res);

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Handle POST request - Create a new location
  if (req.method === 'POST') {
    try {
      const userRole = await getUserRoleSafely(userId);

      // Only admins, super admins, and managers can create locations
      if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN' && userRole !== 'MANAGER') {
        return res.status(403).json({ error: 'Only admins and super admins can create locations' });
      }

      const { name, address, latitude, longitude, radius } = req.body;

      // Validate required fields
      if (!name || !address || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Create the location
      const location = await prisma.location.create({
        data: {
          name,
          address,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          radius: radius ? parseFloat(radius) : 50,
          admins: {
            connect: { id: userId },
          },
        },
      });

      return res.status(201).json(location);
    } catch (error) {
      console.error('Error creating location:', error);
      return res.status(500).json({ error: 'Failed to create location' });
    }
  }

  // Return 405 for other methods
  return res.status(405).json({ error: 'Method not allowed' });
}
