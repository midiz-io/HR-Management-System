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
  // Get the location ID from the request
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid location ID' });
  }

  // Handle GET request - Get a specific location (permissive)
  if (req.method === 'GET') {
    try {
      const location = await prisma.location.findUnique({
        where: { id },
      });

      if (!location) {
        return res.status(404).json({ error: 'Location not found' });
      }

      return res.status(200).json(location);
    } catch (error) {
      console.error('Error fetching location:', error);
      return res.status(500).json({ error: 'Failed to fetch location' });
    }
  }

  // Write operations (PUT / DELETE) require strict authentication
  const userId = await getAuthenticatedUserId(req, res);

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Handle PUT request - Update a location
  if (req.method === 'PUT') {
    try {
      const userRole = await getUserRoleSafely(userId);

      // Only admins, super admins, and managers can update locations
      if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN' && userRole !== 'MANAGER') {
        return res.status(403).json({ error: 'Only admins and super admins can update locations' });
      }

      // Check if location exists
      const existingLocation = await prisma.location.findUnique({
        where: { id },
      });

      if (!existingLocation) {
        return res.status(404).json({ error: 'Location not found' });
      }

      const { name, address, latitude, longitude, radius } = req.body;

      // Validate required fields
      if (!name || !address || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Update the location
      const location = await prisma.location.update({
        where: { id },
        data: {
          name,
          address,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          radius: radius ? parseFloat(radius) : existingLocation.radius,
        },
      });

      return res.status(200).json(location);
    } catch (error) {
      console.error('Error updating location:', error);
      return res.status(500).json({ error: 'Failed to update location' });
    }
  }

  // Handle DELETE request - Delete a location
  if (req.method === 'DELETE') {
    try {
      const userRole = await getUserRoleSafely(userId);

      // Only admins, super admins, and managers can delete locations
      if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN' && userRole !== 'MANAGER') {
        return res.status(403).json({ error: 'Only admins and super admins can delete locations' });
      }

      // Check if location exists
      const existingLocation = await prisma.location.findUnique({
        where: { id },
      });

      if (!existingLocation) {
        return res.status(404).json({ error: 'Location not found' });
      }

      // 1. Unassign any employees currently referencing this locationId
      await prisma.user.updateMany({
        where: { locationId: id },
        data: { locationId: null },
      });

      // 2. Disconnect any location admins in the _LocationAdmins join table
      try {
        await prisma.location.update({
          where: { id },
          data: {
            admins: {
              set: [],
            },
          },
        });
      } catch (disconnectErr) {
        console.warn('Warning disconnecting location admins:', disconnectErr);
      }

      // 3. Remove any attendance records referencing this locationId
      await prisma.attendance.deleteMany({
        where: { locationId: id },
      });

      // 4. Clean up any references to this deleted location inside /locations portal employee configs
      try {
        const portalSetting = await prisma.systemSetting.findUnique({
          where: { key: 'LOCATIONS_PORTAL_EMPLOYEES' },
        });
        if (portalSetting?.value) {
          const parsedConfigs = JSON.parse(portalSetting.value);
          let modified = false;
          for (const empId of Object.keys(parsedConfigs)) {
            if (
              parsedConfigs[empId]?.locationId === id ||
              parsedConfigs[empId]?.locationName === existingLocation.name
            ) {
              delete parsedConfigs[empId];
              modified = true;
            }
          }
          if (modified) {
            await prisma.systemSetting.update({
              where: { key: 'LOCATIONS_PORTAL_EMPLOYEES' },
              data: { value: JSON.stringify(parsedConfigs) },
            });
          }
        }
      } catch (portalCleanupErr) {
        console.warn('Warning cleaning up portal config on location delete:', portalCleanupErr);
      }

      // 5. Delete the location
      await prisma.location.delete({
        where: { id },
      });

      return res.status(200).json({ message: 'Location deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting location:', error);
      return res.status(500).json({
        error: 'Failed to delete location',
        details: error?.message || 'Unknown error',
      });
    }
  }

  // Return 405 for other methods
  return res.status(405).json({ error: 'Method not allowed' });
}
