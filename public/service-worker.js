// Service Worker for Push Notifications

// Cache name for offline support
const CACHE_NAME = 'employee-management-v3';

// Log helper
const logMessage = (message) => {
  console.log(`[Service Worker] ${message}`);
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  logMessage('Installing...');
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      logMessage('Caching app shell and content');
      return cache.addAll([
        '/',
        '/favicon.ico'
      ]);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  logMessage('Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            logMessage(`Clearing old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      logMessage('Claiming clients');
      return self.clients.claim();
    })
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  logMessage('Push event received');
  
  if (event.data) {
    try {
      const data = event.data.json();
      logMessage(`Push data received: ${JSON.stringify(data)}`);
      
      const options = {
        body: data.body || 'New notification',
        icon: data.icon || '/favicon.ico',
        badge: data.badge || '/favicon.ico',
        data: data.data || { url: '/dashboard' },
        vibrate: [100, 50, 100],
        timestamp: data.timestamp || Date.now(),
        tag: data.tag || 'default',
        renotify: data.tag ? true : false,
        requireInteraction: data.requireInteraction || false,
        actions: data.actions || []
      };
      
      logMessage(`Showing notification: ${data.title}`);
      event.waitUntil(
        self.registration.showNotification(data.title || 'Notification', options)
          .then(() => logMessage('Notification shown successfully'))
          .catch(error => logMessage(`Error showing notification: ${error}`))
      );
    } catch (error) {
      logMessage(`Error processing push data: ${error}`);
      
      // Show a generic notification if JSON parsing fails
      event.waitUntil(
        self.registration.showNotification('New Notification', {
          body: 'You have a new notification',
          icon: '/favicon.ico',
          data: { url: '/dashboard' }
        })
      );
    }
  } else {
    logMessage('Push event received but no data');
    
    // Show a generic notification if no data
    event.waitUntil(
      self.registration.showNotification('New Notification', {
        body: 'You have a new notification',
        icon: '/favicon.ico',
        data: { url: '/dashboard' }
      })
    );
  }
});

// Notification click event - handle notification clicks
self.addEventListener('notificationclick', (event) => {
  logMessage(`Notification click received: ${event.notification.tag}`);
  
  // Close the notification
  event.notification.close();
  
  // Get the notification data
  const data = event.notification.data || {};
  const url = data.url || '/dashboard';
  
  logMessage(`Opening URL: ${url}`);
  
  // Handle notification click - focus or open window
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Check if there's already a window/tab open with the target URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        const clientUrl = new URL(client.url);
        const targetUrl = new URL(url, self.location.origin);
        
        logMessage(`Checking client: ${clientUrl.pathname} vs ${targetUrl.pathname}`);
        
        // If the pathname matches, focus that client
        if (clientUrl.pathname === targetUrl.pathname && 'focus' in client) {
          logMessage('Focusing existing client');
          return client.focus();
        }
      }
      
      // If no window/tab is open with the URL, open a new one
      if (clients.openWindow) {
        logMessage('Opening new window');
        return clients.openWindow(url);
      }
    })
  );
});

// Fetch event - network first, then cache strategy
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip API requests
  if (event.request.url.includes('/api/')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache static assets (chunks, fonts, images), NOT dynamic HTML navigations
        const isStaticAsset = event.request.url.includes('/_next/static/') ||
                              event.request.url.includes('/images/') ||
                              event.request.url.includes('/favicon.ico');

        if (response && response.status === 200 && response.type === 'basic' && isStaticAsset) {
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
        }
        
        return response;
      })
      .catch(() => {
        // If the network request fails, try to serve from cache
        return caches.match(event.request);
      })
  );
});

// Listen for messages from clients
self.addEventListener('message', (event) => {
  logMessage(`Message received from client: ${JSON.stringify(event.data)}`);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});