// Service Worker for Push Notifications
const CACHE_NAME = 'document-tracker-v1';

// Install event
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

// Push event - handle incoming push notifications
self.addEventListener('push', event => {
  console.log('Push event received:', event);
  
  let notificationData = {};
  
  if (event.data) {
    try {
      notificationData = event.data.json();
    } catch (e) {
      notificationData = {
        title: 'Document Tracker',
        body: event.data.text() || 'New notification',
        icon: '/favicon.ico',
        badge: '/favicon.ico'
      };
    }
  } else {
    notificationData = {
      title: 'Document Tracker',
      body: 'New notification',
      icon: '/favicon.ico',
      badge: '/favicon.ico'
    };
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon || '/favicon.ico',
    badge: notificationData.badge || '/favicon.ico',
    tag: notificationData.tag || 'document-tracker',
    data: notificationData.data || {},
    actions: notificationData.actions || [],
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clients => {
      // Check if there's already a window/tab open with the target URL
      for (const client of clients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no window/tab is open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Background sync for offline notifications
self.addEventListener('sync', event => {
  console.log('Background sync event:', event);
  
  if (event.tag === 'notification-sync') {
    event.waitUntil(
      // Handle any pending notifications when back online
      self.registration.sync.register('notification-sync')
    );
  }
});

// Handle message from main thread
self.addEventListener('message', event => {
  console.log('Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});