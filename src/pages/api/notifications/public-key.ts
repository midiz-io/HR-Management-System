import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Return the public VAPID key without requiring authentication
    // This is safe as the public key is meant to be public
    if (!process.env.VAPID_PUBLIC_KEY) {
      throw new Error('VAPID_PUBLIC_KEY environment variable is not set');
    }
    
    return res.status(200).json({ 
      publicKey: process.env.VAPID_PUBLIC_KEY 
    });
  } catch (error) {
    console.error('Error getting public key:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}