import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';
import { getSectionalHeadContext, ensureSectionalHeadAndNewTables } from '@/lib/sectionalHeadDb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureSectionalHeadAndNewTables();
  const supabase = createClient(req, res);
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const context = await getSectionalHeadContext(authUser.id);
  if (!context) {
    return res.status(404).json({ error: 'User profile not found' });
  }

  const { user, managedDepartment, isSectionalHead, isSuperAdminOrHR } = context;
  const userDeptId = managedDepartment ? managedDepartment.id : user.departmentId;

  // GET: Fetch requests or department conflict calendar dates
  if (req.method === 'GET') {
    try {
      const { conflictsOnly, month, year } = req.query;

      // Conflict Calendar Check: Return department dates that are already booked/requested
      if (conflictsOnly === 'true') {
        if (!userDeptId) {
          return res.status(200).json({ bookedDates: [] });
        }

        const bookedRows: any[] = await prisma.$queryRawUnsafe(`
          SELECT 
            r."id",
            r."date",
            r."userId",
            r."status",
            u."firstName",
            u."lastName",
            u."email"
          FROM "OffDayRequest" r
          JOIN "User" u ON r."userId" = u."id"
          WHERE r."departmentId" = $1
            AND r."status" IN ('PENDING_SECTIONAL_HEAD', 'PENDING_HR', 'APPROVED')
        `, userDeptId);

        const bookedDates = bookedRows.map(r => ({
          id: r.id,
          date: r.date,
          userId: r.userId,
          isSelf: r.userId === authUser.id,
          status: r.status,
          employeeName: `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email,
        }));

        return res.status(200).json({ bookedDates });
      }

      // Fetch list of requests
      let requestsQuery = `
        SELECT 
          r."id",
          r."userId",
          r."departmentId",
          r."date",
          r."reason",
          r."status",
          r."reviewerId",
          r."reviewedAt",
          r."rejectionReason",
          r."recommendedById",
          r."recommendedAt",
          r."createdAt",
          u."firstName",
          u."lastName",
          u."email",
          u."role"::text as "role",
          u."position",
          d."name" as "departmentName",
          rec."firstName" as "recommenderFirstName",
          rec."lastName" as "recommenderLastName",
          rev."firstName" as "reviewerFirstName",
          rev."lastName" as "reviewerLastName"
        FROM "OffDayRequest" r
        JOIN "User" u ON r."userId" = u."id"
        LEFT JOIN "Department" d ON r."departmentId" = d."id"
        LEFT JOIN "User" rec ON r."recommendedById" = rec."id"
        LEFT JOIN "User" rev ON r."reviewerId" = rev."id"
        WHERE 1=1
      `;

      const params: any[] = [];

      if (isSuperAdminOrHR) {
        // HR sees all requests
      } else if (isSectionalHead && managedDepartment) {
        // Sectional Head sees their own requests + requests from their managed department
        params.push(managedDepartment.id);
        params.push(authUser.id);
        requestsQuery += ` AND (r."departmentId" = $1 OR r."userId" = $2::uuid)`;
      } else {
        // Regular Employee only sees their own requests
        params.push(authUser.id);
        requestsQuery += ` AND r."userId" = $1::uuid`;
      }

      requestsQuery += ` ORDER BY r."date" DESC LIMIT 200`;

      const rows: any[] = await prisma.$queryRawUnsafe(requestsQuery, ...params);

      const requests = rows.map(r => ({
        id: r.id,
        userId: r.userId,
        departmentId: r.departmentId,
        departmentName: r.departmentName,
        date: r.date,
        reason: r.reason,
        status: r.status,
        reviewerId: r.reviewerId,
        reviewedAt: r.reviewedAt,
        rejectionReason: r.rejectionReason,
        recommendedById: r.recommendedById,
        recommendedAt: r.recommendedAt,
        createdAt: r.createdAt,
        user: {
          id: r.userId,
          firstName: r.firstName,
          lastName: r.lastName,
          email: r.email,
          role: r.role,
          position: r.position,
        },
        recommender: r.recommenderFirstName ? {
          firstName: r.recommenderFirstName,
          lastName: r.recommenderLastName,
        } : null,
        reviewer: r.reviewerFirstName ? {
          firstName: r.reviewerFirstName,
          lastName: r.reviewerLastName,
        } : null,
      }));

      return res.status(200).json({
        requests,
        isSectionalHead,
        isSuperAdminOrHR,
        managedDepartment,
      });
    } catch (error: any) {
      console.error('Error fetching off-day requests:', error);
      return res.status(500).json({ error: 'Failed to fetch off-day requests' });
    }
  }

  // POST: Submit a new off-day request with department date conflict check
  if (req.method === 'POST') {
    try {
      const { date, reason } = req.body;

      if (!date) {
        return res.status(400).json({ error: 'Off-day date is required' });
      }

      const targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }

      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Check self-duplicate on same day
      const selfExisting: any[] = await prisma.$queryRawUnsafe(`
        SELECT "id", "status" FROM "OffDayRequest"
        WHERE "userId" = $1::uuid
          AND "date" >= $2
          AND "date" <= $3
          AND "status" NOT IN ('CANCELLED', 'REJECTED')
        LIMIT 1
      `, authUser.id, startOfDay, endOfDay);

      if (selfExisting.length > 0) {
        return res.status(400).json({ error: 'You have already submitted an off-day request for this date' });
      }

      // Department Conflict Check: Ensure no other colleague from the same department has requested this date
      if (userDeptId) {
        const conflict: any[] = await prisma.$queryRawUnsafe(`
          SELECT 
            r."id",
            r."date",
            u."firstName",
            u."lastName"
          FROM "OffDayRequest" r
          JOIN "User" u ON r."userId" = u."id"
          WHERE r."departmentId" = $1
            AND r."userId" != $2::uuid
            AND r."date" >= $3
            AND r."date" <= $4
            AND r."status" IN ('PENDING_SECTIONAL_HEAD', 'PENDING_HR', 'APPROVED')
          LIMIT 1
        `, userDeptId, authUser.id, startOfDay, endOfDay);

        if (conflict.length > 0) {
          const colleague = conflict[0];
          const colleagueName = `${colleague.firstName || ''} ${colleague.lastName || ''}`.trim() || 'A department colleague';
          return res.status(409).json({
            error: `Department Date Conflict: ${colleagueName} in your department has already requested or booked this date. Off-days on the same day within the same department are restricted.`,
            conflictDate: date,
          });
        }
      }

      // Determine initial status:
      // If Sectional Head submitting own request: Goes directly to HR (PENDING_HR)
      // If regular employee: Needs Sectional Head recommendation (PENDING_SECTIONAL_HEAD)
      const initialStatus = isSectionalHead ? 'PENDING_HR' : 'PENDING_SECTIONAL_HEAD';
      const requestId = `offday_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      await prisma.$executeRawUnsafe(`
        INSERT INTO "OffDayRequest" (
          "id", "userId", "departmentId", "date", "reason", "status", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2::uuid, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `, requestId, authUser.id, userDeptId || null, targetDate, reason ? reason.trim() : null, initialStatus);

      return res.status(201).json({
        success: true,
        message: isSectionalHead
          ? 'Off-day request submitted directly to HR for approval.'
          : 'Off-day request submitted and forwarded to your Sectional Head for recommendation.',
        id: requestId,
        status: initialStatus,
      });
    } catch (error: any) {
      console.error('Error creating off-day request:', error);
      return res.status(500).json({ error: error.message || 'Failed to submit off-day request' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}
