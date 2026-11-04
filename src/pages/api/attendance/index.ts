import { NextApiRequest, NextApiResponse } from 'next';
import { toZonedTime } from 'date-fns-tz';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import {
  sendCheckInNotification,
  sendCheckOutNotification,
  checkAndUpdateLateAttendanceStreak,
  resetLateAttendanceStreak
} from '@/util/notifications';
import { isWithinRadius } from '@/util/geofencing';
import { calculateLateness } from '@/util/attendance-logic';
import { broadcastRealtimeEvent } from '@/lib/realtime';

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
        console.warn('Bearer token verification failed:', err);
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
        } catch (err) {
          console.warn('Prisma user lookup error:', err);
        }
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

  // 3. Fallback to Supabase cookie session
  try {
    const supabase = createClient(req, res);
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) return user.id;

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) return session.user.id;
  } catch (err) {
    console.warn('Supabase session retrieval error:', err);
  }

  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const userId = await getAuthenticatedUserId(req, res);

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Handle GET request - Get user's attendance records
  if (req.method === 'GET') {
    try {
      const attendances = await prisma.attendance.findMany({
        where: { userId },
        include: { location: true },
        orderBy: { checkInTime: 'desc' },
      });

      // Ensure each record has a valid location object
      const safeAttendances = attendances.map((att) => ({
        ...att,
        location: att.location || {
          id: att.locationId || 'default-location',
          name: 'Office Location',
          address: 'Office Location',
          latitude: 6.9271,
          longitude: 79.8612,
          radius: 50,
        },
      }));

      return res.status(200).json(safeAttendances);
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      return res.status(500).json({ error: 'Failed to fetch attendance records' });
    }
  }

  // Handle POST request - Create a check-in or check-out
  if (req.method === 'POST') {
    try {
      const { locationId, latitude, longitude, type } = req.body;

      // Validate required fields
      if (!locationId || latitude === undefined || longitude === undefined || !type) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Get the location
      let location = await prisma.location.findUnique({
        where: { id: locationId },
      });

      if (!location) {
        location = await prisma.location.findFirst();
      }

      if (!location) {
        return res.status(404).json({ error: 'Location not found' });
      }

      // Handle check-in
      if (type === 'check-in') {
        // Check if user is within the geofence (with tolerance for GPS inaccuracy)
        const userLatitude = parseFloat(latitude);
        const userLongitude = parseFloat(longitude);

        // Add a generous tolerance buffer to account for GPS inaccuracies and manual selection
        // Minimum 1000m (1km) or 200% of radius, whichever is larger
        const toleranceBuffer = Math.max(location.radius * 2, 1000);
        const effectiveRadius = location.radius + toleranceBuffer;

        const isInGeofence = isWithinRadius(
          userLatitude,
          userLongitude,
          location.latitude,
          location.longitude,
          effectiveRadius
        );

        if (!isInGeofence) {
          const actualDistance = Math.round(
            calculateDistance(
              userLatitude,
              userLongitude,
              location.latitude,
              location.longitude
            )
          );

          return res.status(400).json({
            error: 'You are not within the required distance of this location',
            distance: {
              required: Math.round(effectiveRadius),
              actual: actualDistance
            }
          });
        }

        // Check if there's an open attendance record
        const openAttendance = await prisma.attendance.findFirst({
          where: {
            userId: userId,
            checkOutTime: null,
          },
        });

        if (openAttendance) {
          return res.status(400).json({ error: 'You already have an active check-in' });
        }

        // Get the current time
        const now = new Date();
        // Create a Date object in Sri Lankan time for all calculations
        const slNow = toZonedTime(now, 'Asia/Colombo');

        // Fetch user with their rosters for lateness calculation
        const userWithRosters = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            rosters: {
              where: {
                AND: [
                  { startDate: { lte: now } },
                  {
                    OR: [
                      { endDate: { gte: now } },
                      { endDate: null }
                    ]
                  }
                ]
              },
              include: {
                workShift: true,
              },
            },
          },
        });

        const latenessResult = calculateLateness(now, userWithRosters);
        const isLate = latenessResult.isLate;

        // Create new attendance record
        const attendance = await prisma.attendance.create({
          data: {
            userId: userId,
            locationId: location.id,
            checkInTime: now,
            checkInLatitude: parseFloat(latitude),
            checkInLongitude: parseFloat(longitude),
            status: isLate ? 'LATE' : 'PRESENT',
            notes: latenessResult.rosterStartTime ? `Roster start: ${latenessResult.rosterStartTime}` : null,
          },
          include: {
            location: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        });

        console.log(`User ${userId} checked in at location ${location.id} at ${now.toISOString()}`);

        // Send check-in notification in background (non-blocking)
        sendCheckInNotification(
          userId,
          location.name,
          now
        ).catch(notificationError => {
          console.error('Error sending check-in notification in background:', notificationError);
        });

        // Track late attendance streak in background (non-blocking)
        if (isLate) {
          checkAndUpdateLateAttendanceStreak(userId, now).catch(streakError => {
            console.error('Error tracking late attendance streak in background:', streakError);
          });
        } else {
          resetLateAttendanceStreak(userId).catch(streakError => {
            console.error('Error resetting late attendance streak in background:', streakError);
          });
        }

        broadcastRealtimeEvent('ATTENDANCE_UPDATED', { type: 'check-in', userId });
        return res.status(201).json(attendance);
      }

      // Handle check-out (no geofencing check for check-out)
      if (type === 'check-out') {
        const { notes } = req.body;
        // Find the open attendance record
        const openAttendance = await prisma.attendance.findFirst({
          where: {
            userId: userId,
            checkOutTime: null,
          },
          include: {
            location: true,
          }
        });

        if (!openAttendance) {
          return res.status(400).json({ error: 'No active check-in found' });
        }

        // Get the current time
        const now = new Date();

        // Enforce minimum 15-minute check-in duration
        const checkInTimeMs = new Date(openAttendance.checkInTime).getTime();
        const elapsedMinutes = (now.getTime() - checkInTimeMs) / (1000 * 60);

        if (elapsedMinutes < 15) {
          const remainingMins = Math.ceil(15 - elapsedMinutes);
          return res.status(400).json({
            error: `You cannot check out within 15 minutes of checking in. Please wait ${remainingMins} more minute(s).`,
            remainingMinutes: remainingMins,
          });
        }

        const checkoutNotes = notes 
          ? (openAttendance.notes ? `${openAttendance.notes} | ${notes}` : notes)
          : openAttendance.notes;

        // Update the attendance record with check-out information
        const updatedAttendance = await prisma.attendance.update({
          where: { id: openAttendance.id },
          data: {
            checkOutTime: now,
            checkOutLatitude: parseFloat(latitude),
            checkOutLongitude: parseFloat(longitude),
            notes: checkoutNotes,
          },
          include: {
            location: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        });

        console.log(`User ${userId} checked out from location ${openAttendance.locationId} at ${now.toISOString()}`);

        // Calculate duration in minutes
        const checkInTime = new Date(updatedAttendance.checkInTime);
        const durationMinutes = Math.round((now.getTime() - checkInTime.getTime()) / (1000 * 60));

        // Send check-out notification in background (non-blocking)
        sendCheckOutNotification(
          userId,
          updatedAttendance.location?.name || 'Office',
          now,
          durationMinutes
        ).catch(notificationError => {
          console.error('Error sending check-out notification in background:', notificationError);
        });

        broadcastRealtimeEvent('ATTENDANCE_UPDATED', { type: 'check-out', userId });
        return res.status(200).json(updatedAttendance);
      }

      return res.status(400).json({ error: 'Invalid attendance type' });
    } catch (error) {
      console.error('Error processing attendance:', error);
      return res.status(500).json({ error: 'Failed to process attendance' });
    }
  }

  // Return 405 for other methods
  return res.status(405).json({ error: 'Method not allowed' });
}

// Helper function to calculate distance
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Earth's radius in meters
  const R = 6371000;

  // Convert latitude and longitude from degrees to radians
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  // Haversine formula
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}
