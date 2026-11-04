import { NextApiRequest, NextApiResponse } from 'next';
import { realtimeEmitter } from '@/lib/realtime';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

  const onRealtimeEvent = (payload: any) => {
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (err) {
      console.error('Error writing SSE stream:', err);
    }
  };

  realtimeEmitter.on('realtime-event', onRealtimeEvent);

  // Send keep-alive heartbeat ping every 15 seconds
  const keepAlive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch (e) {
      // Ignore write errors if socket closed
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    realtimeEmitter.removeListener('realtime-event', onRealtimeEvent);
    res.end();
  });
}
