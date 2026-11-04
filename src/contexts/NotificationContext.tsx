import React, { createContext, useState, useContext, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from "@/components/ui/use-toast";

interface NotificationContextType {
  isSubscribed: boolean;
  isPushSupported: boolean;
  subscribeToNotifications: () => Promise<void>;
  unsubscribeFromNotifications: () => Promise<void>;
  sendTestNotification: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  isSubscribed: false,
  isPushSupported: false,
  subscribeToNotifications: async () => {},
  unsubscribeFromNotifications: async () => {},
  sendTestNotification: async () => {},
});

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isPushSupported, setIsPushSupported] = useState<boolean>(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Check if push notifications are supported and reuse existing service worker registration
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const checkSubscription = async (registration: ServiceWorkerRegistration) => {
      try {
        const subscription = await registration.pushManager.getSubscription();
        if (!cancelled) {
          setIsSubscribed(!!subscription);
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
      }
    };

    const checkPushSupport = async () => {
      try {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          if (!cancelled) setIsPushSupported(true);

          const existingReg = await navigator.serviceWorker.getRegistration('/');
          const registration = existingReg || await navigator.serviceWorker.register('/service-worker.js', {
            scope: '/'
          });

          if (!cancelled) {
            setSwRegistration(registration);
          }

          if (registration.active) {
            checkSubscription(registration);
          } else if (registration.installing) {
            const installingWorker = registration.installing;
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'activated') {
                checkSubscription(registration);
              }
            });
          }
        } else {
          if (!cancelled) setIsPushSupported(false);
        }
      } catch (error) {
        console.error('Error checking service worker:', error);
        if (!cancelled) setIsPushSupported(false);
      }
    };

    // Defer non-critical SW check to idle time so initial page paint is never blocked
    const timer = setTimeout(checkPushSupport, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user?.id]);

  // Convert base64 to Uint8Array (for VAPID key)
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
  };

  // Subscribe to push notifications
  const subscribeToNotifications = useCallback(async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to subscribe to notifications",
      });
      return;
    }

    try {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      if (!swRegistration) {
        throw new Error('Service worker not registered');
      }
      
      const response = await fetch('/api/notifications/public-key');
      if (!response.ok) {
        throw new Error(`Failed to fetch public key: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const publicKey = data.publicKey;
      
      if (!publicKey) {
        throw new Error('Public key not available');
      }
      
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      
      const subscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      
      const saveResponse = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          subscription: subscription.toJSON(),
          userId: user.id
        }),
        credentials: 'include'
      });
      
      if (!saveResponse.ok) {
        const errorData = await saveResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to save subscription on server: ${saveResponse.status} ${saveResponse.statusText}`);
      }
      
      setIsSubscribed(true);
      toast({
        title: "Notifications Enabled",
        description: "You will now receive push notifications",
      });
    } catch (error: any) {
      console.error('Error subscribing to notifications:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || 'Failed to subscribe to notifications',
      });
    }
  }, [user, swRegistration, toast]);

  // Unsubscribe from push notifications
  const unsubscribeFromNotifications = useCallback(async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to unsubscribe from notifications",
      });
      return;
    }

    try {
      if (!swRegistration) {
        throw new Error('Service worker not registered');
      }
      
      const subscription = await swRegistration.pushManager.getSubscription();
      
      if (!subscription) {
        throw new Error('No subscription found');
      }
      
      const successful = await subscription.unsubscribe();
      
      if (!successful) {
        throw new Error('Failed to unsubscribe from push manager');
      }
      
      const response = await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          endpoint: subscription.endpoint,
          userId: user.id
        }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to remove subscription from server: ${response.status} ${response.statusText}`);
      }
      
      setIsSubscribed(false);
      toast({
        title: "Notifications Disabled",
        description: "You will no longer receive push notifications",
      });
    } catch (error: any) {
      console.error('Error unsubscribing from notifications:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || 'Failed to unsubscribe from notifications',
      });
    }
  }, [user, swRegistration, toast]);

  // Send a test notification
  const sendTestNotification = useCallback(async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to send a test notification",
      });
      return;
    }

    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to send test notification: ${response.status} ${response.statusText}`);
      }
      
      toast({
        title: "Test Notification Sent",
        description: "You should receive a notification shortly",
      });
    } catch (error: any) {
      console.error('Error sending test notification:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || 'Failed to send test notification',
      });
    }
  }, [user, toast]);

  const contextValue = useMemo(() => ({
    isSubscribed,
    isPushSupported,
    subscribeToNotifications,
    unsubscribeFromNotifications,
    sendTestNotification,
  }), [isSubscribed, isPushSupported, subscribeToNotifications, unsubscribeFromNotifications, sendTestNotification]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
