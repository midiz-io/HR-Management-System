import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';

type RealtimeCallback = (payload: { type: string; data?: any; timestamp: string }) => void;

interface RealtimeContextType {
  subscribe: (eventType: string, callback: RealtimeCallback) => () => void;
  isConnected: boolean;
  lastEventTime: string | null;
  triggerManualRefresh: (eventType?: string) => void;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEventTime, setLastEventTime] = useState<string | null>(null);
  const subscribersRef = useRef<Map<string, Set<RealtimeCallback>>>(new Map());
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastFocusRefreshRef = useRef<number>(0);

  // Helper to notify subscribers without causing global React state re-renders on background heartbeats
  const notifySubscribers = useCallback((type: string, data?: any, timestamp?: string) => {
    const ts = timestamp || new Date().toISOString();
    if (type !== 'HEARTBEAT_TICK' && type !== 'CONNECTED') {
      setLastEventTime(ts);
    }
    const payload = { type, data, timestamp: ts };

    // Specific subscribers
    const specificSubs = subscribersRef.current.get(type);
    if (specificSubs) {
      specificSubs.forEach((cb) => cb(payload));
    }

    // Catch-all subscribers (skip HEARTBEAT_TICK for ALL to prevent global API storms)
    if (type !== 'HEARTBEAT_TICK') {
      const allSubs = subscribersRef.current.get('ALL');
      if (allSubs) {
        allSubs.forEach((cb) => cb(payload));
      }
    }
  }, []);

  const triggerManualRefresh = useCallback((eventType: string = 'ALL') => {
    notifySubscribers(eventType, { manual: true });
  }, [notifySubscribers]);

  // Subscribe method
  const subscribe = useCallback((eventType: string, callback: RealtimeCallback) => {
    if (!subscribersRef.current.has(eventType)) {
      subscribersRef.current.set(eventType, new Set());
    }
    const set = subscribersRef.current.get(eventType)!;
    set.add(callback);

    // Return unsubscribe function
    return () => {
      set.delete(callback);
      if (set.size === 0) {
        subscribersRef.current.delete(eventType);
      }
    };
  }, []);

  // Connect SSE Stream
  useEffect(() => {
    let reconnectTimer: any = null;

    const connectSSE = () => {
      try {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        const es = new EventSource('/api/realtime/stream');
        eventSourceRef.current = es;

        es.onopen = () => {
          setIsConnected(true);
        };

        es.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type) {
              notifySubscribers(parsed.type, parsed.data, parsed.timestamp);
            }
          } catch (err) {
            console.error('Failed to parse SSE payload:', err);
          }
        };

        es.onerror = () => {
          setIsConnected(false);
          es.close();
          // Attempt reconnection after 5 seconds
          reconnectTimer = setTimeout(connectSSE, 5000);
        };
      } catch (err) {
        console.error('SSE initialization error:', err);
        setIsConnected(false);
      }
    };

    connectSSE();

    // Throttled auto-refresh when tab gains focus (15s cooldown prevents duplicate focus + visibilitychange bursts)
    const throttledFocusRefresh = () => {
      const now = Date.now();
      if (now - lastFocusRefreshRef.current > 15000) {
        lastFocusRefreshRef.current = now;
        triggerManualRefresh('REFRESH_ALL');
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        throttledFocusRefresh();
      }
    };

    window.addEventListener('focus', throttledFocusRefresh, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });

    // Lightweight backup polling heartbeat (every 15 seconds) without triggering root state re-renders
    const pollingHeartbeat = setInterval(() => {
      if (document.visibilityState === 'visible') {
        notifySubscribers('HEARTBEAT_TICK');
      }
    }, 15000);

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(pollingHeartbeat);
      window.removeEventListener('focus', throttledFocusRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [notifySubscribers, triggerManualRefresh]);

  const contextValue = useMemo(
    () => ({ subscribe, isConnected, lastEventTime, triggerManualRefresh }),
    [subscribe, isConnected, lastEventTime, triggerManualRefresh]
  );

  return (
    <RealtimeContext.Provider value={contextValue}>
      {children}
    </RealtimeContext.Provider>
  );
};

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}

export function useRealtimeSubscription(eventType: string, callback: RealtimeCallback) {
  const { subscribe } = useRealtime();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const unsub = subscribe(eventType, (payload) => {
      callbackRef.current(payload);
    });
    return unsub;
  }, [eventType, subscribe]);
}
