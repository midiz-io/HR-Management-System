// This file extends the service worker to handle real-time updates

// Listen for push events from Supabase real-time
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    
    // Show notification for real-time updates
    const showNotification = self.registration.showNotification(
      data.title || 'Attendance Update',
      {
        body: data.body || 'There has been an update to attendance records',
        icon: data.icon || '/favicon.ico',
        badge: '/favicon.ico',
        data: data.data || { url: '/dashboard' },
        requireInteraction: data.requireInteraction || false,
        tag: data.tag || 'attendance-update'
      }
    );
    
    event.waitUntil(showNotification);
  }
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  // Get the notification data
  const data = event.notification.data;
  
  // Navigate to the URL from the notification data
  if (data && data.url) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(function(clientList) {
        // If a window is already open, focus it
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === data.url && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Otherwise, open a new window
        if (clients.openWindow) {
          return clients.openWindow(data.url);
        }
      })
    );
  }
});