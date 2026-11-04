import { EventEmitter } from 'events';

declare global {
  var realtimeEmitter: EventEmitter | undefined;
}

const realtimeEmitter = global.realtimeEmitter || new EventEmitter();
realtimeEmitter.setMaxListeners(100);

if (process.env.NODE_ENV !== 'production') {
  global.realtimeEmitter = realtimeEmitter;
}

export { realtimeEmitter };

export function broadcastRealtimeEvent(type: string, data: any = {}) {
  try {
    const payload = {
      type,
      data,
      timestamp: new Date().toISOString()
    };
    realtimeEmitter.emit('realtime-event', payload);
  } catch (error) {
    console.error('Error broadcasting realtime event:', error);
  }
}
