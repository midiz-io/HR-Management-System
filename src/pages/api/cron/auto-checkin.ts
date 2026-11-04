import { NextApiRequest, NextApiResponse } from 'next';
import { runLocationsPortalAutoAttendance } from '@/util/cron-tasks';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const result = await runLocationsPortalAutoAttendance(new Date());
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error: any) {
    console.error('Error in auto-checkin cron API:', error);
    return res.status(500).json({ error: 'Auto-checkin failed', details: error.message });
  }
}
