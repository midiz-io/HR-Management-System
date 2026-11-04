import { NextApiRequest, NextApiResponse } from 'next';
import { runAutoCheckout, runLocationsPortalAutoAttendance } from '@/util/cron-tasks';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const now = new Date();
    const locationsPortalResult = await runLocationsPortalAutoAttendance(now);
    const result = await runAutoCheckout(now);
    return res.status(200).json({
      success: true,
      timestamp: now.toISOString(),
      locationsPortal: locationsPortalResult,
      ...result,
    });
  } catch (error: any) {
    console.error('Error in auto-checkout cron API:', error);
    return res.status(500).json({ error: 'Auto-checkout failed', details: error.message });
  }
}
