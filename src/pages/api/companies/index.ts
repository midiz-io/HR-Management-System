import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export const COMPANY_PROFILES = [
  {
    id: 'divron',
    name: 'Divron Bioventuress',
    shortName: 'Divron',
    logo: 'https://scontent.fcmb1-2.fna.fbcdn.net/v/t39.30808-6/292218093_501180845188906_7788430094083572577_n.png?stp=dst-png&cstp=mx640x640&ctp=s640x640&_nc_cat=106&ccb=1-7&_nc_sid=6ee11a&_nc_eui2=AeGYF6SQ-BcKgn6WqylRT2N_paZ6tJeSL5Sqlpnq0l5IvlDsDpaKui5fgDDkM4umADm-wfX7DWEIgXNWVxM9V08-Q&_nc_ohc=xIDY8ghS8LMQ7kNvwG91T0o&_nc_oc=AdoPoL7WNMUAr3yuNsyLE1mPSRsA7t9hEaswF4f-OQMtcKMvNm4ErXb0BdLdjFboroI&_nc_zt=23&_nc_ht=scontent.fcmb1-2.fna&_nc_gid=AtGOWy5-k2kg25Xym6-LjQ&_nc_ss=7b2a8&oh=00_AQGatuzhm7o0pb1PwB4Dm7rTxA_pwJeQstev9I7fpv3yjA&oe=6A933A3A',
    color: 'emerald',
    description: 'Aquaculture & Bio-venture solutions'
  },
  {
    id: 'tropical',
    name: 'Tropical ShellFish',
    shortName: 'Tropical',
    logo: 'https://scontent.fcmb1-2.fna.fbcdn.net/v/t39.30808-6/559679736_1297316365426545_2707586598231779437_n.jpg?stp=dst-jpg_tt6&cstp=mx960x960&ctp=s960x960&_nc_cat=108&ccb=1-7&_nc_sid=6ee11a&_nc_eui2=AeHX9cZOr1V7JEZPwDnuTrfvjKH7CjQ_FIaMofsKND8UhvO3JOtOY4WdWeBzhhzFe8oM8fw8BiKTaiWY8PhFqyyh&_nc_ohc=lSoFTrovrzEQ7kNvwFByfb3&_nc_oc=AdpETZPfERvvKZHpWg4TsVTGY6kbh5AqWSWBHPQBcsAe5UaxSuIfavt-g7RWo3bHjfc&_nc_zt=23&_nc_ht=scontent.fcmb1-2.fna&_nc_gid=MVJXd9P1f1QF-K2PoPQ91g&_nc_ss=7b2a8&oh=00_AQHRIxFwzjNgnYZj33-2gnc2YBzVn75e9xd8ZtrA3hYE1Q&oe=6A932CBA',
    color: 'blue',
    description: 'Premium Shellfish Cultivation & Processing'
  }
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: 'company_assignments' },
      });

      let assignments: Record<string, string> = {};
      if (setting && setting.value) {
        try {
          assignments = JSON.parse(setting.value);
        } catch {
          assignments = {};
        }
      }

      return res.status(200).json({
        companies: COMPANY_PROFILES,
        assignments
      });
    } catch (error) {
      console.error('Error fetching company categorization:', error);
      return res.status(500).json({ error: 'Failed to fetch company data' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { userIds, companyName } = req.body;

      if (!Array.isArray(userIds) || typeof companyName !== 'string') {
        return res.status(400).json({ error: 'Invalid payload. Expecting userIds array and companyName string.' });
      }

      const setting = await prisma.systemSetting.findUnique({
        where: { key: 'company_assignments' },
      });

      let assignments: Record<string, string> = {};
      if (setting && setting.value) {
        try {
          assignments = JSON.parse(setting.value);
        } catch {
          assignments = {};
        }
      }

      // Update company assignment for all specified userIds
      for (const uid of userIds) {
        if (companyName === 'UNASSIGNED' || companyName === '') {
          delete assignments[uid];
        } else {
          assignments[uid] = companyName;
        }
      }

      const updatedStr = JSON.stringify(assignments);

      await prisma.systemSetting.upsert({
        where: { key: 'company_assignments' },
        update: { value: updatedStr },
        create: { key: 'company_assignments', value: updatedStr },
      });

      return res.status(200).json({
        success: true,
        message: `Successfully assigned ${userIds.length} employee(s) to ${companyName}.`,
        assignments
      });
    } catch (error) {
      console.error('Error updating company assignments:', error);
      return res.status(500).json({ error: 'Failed to update company assignments' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
