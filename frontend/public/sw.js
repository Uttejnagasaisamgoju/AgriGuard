/**
 * AgriGuard Mobile PWA Service Worker
 * Provides offline caching for app shell, network-first API handling,
 * and background notification management.
 */

const CACHE_NAME = 'agriguard-pwa-v2';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
];

// Install: Cache critical application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch((err) => {
        console.warn('[SW] App shell pre-caching partial:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: Clean up older cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Strategy depending on request type
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignore non-GET requests or WebSocket handshakes
  if (event.request.method !== 'GET' || url.pathname.startsWith('/ws')) {
    return;
  }

  // 1. API Calls: Network-first with offline fallback JSON
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response(
          JSON.stringify({
            offline: true,
            message: 'You are currently offline. Actions will queue and sync when reconnected.',
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }

  // 2. Navigation (HTML): Network-first falling back to cached index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/index.html', clone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedIndex = await caches.match('/index.html');
          return cachedIndex || caches.match('/');
        })
    );
    return;
  }

  // 3. Static Assets (JS, CSS, images, fonts): Cache-first with background network update (stale-while-revalidate)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Network failed, nothing extra to do if cachedResponse exists
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// Real push notification receiver with rich payload & deep linking
self.addEventListener('push', (event) => {
  let data = { title: 'AgriGuard Alert', body: 'New field update or advisory received.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'AgriGuard Notification', body: event.data.text() };
    }
  }

  const deepUrl = data.url || (data.data && data.data.url) || '/';
  const targetScreen = (data.data && data.data.screen) || (data.screen) || 'home';
  const targetRecordId = (data.data && data.data.record_id) || (data.record_id) || null;

  const options = {
    body: data.body || data.message || 'Tap to view details.',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-192x192.png',
    vibrate: [150, 75, 150],
    data: {
      url: deepUrl,
      screen: targetScreen,
      record_id: targetRecordId,
      type: (data.data && data.data.type) || data.type || 'system',
      payload: data.data || {},
      dateOfArrival: Date.now(),
    },
    actions: [
      { action: 'open', title: 'Open AgriGuard' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'AgriGuard Alert', options)
  );
});

// Handle notification interaction and click-to-open deep linking
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. If an existing window client is found (foreground or background)
      if (clientList && clientList.length > 0) {
        const client = clientList[0];
        // Send message to open client with deep linking payload
        client.postMessage({
          type: 'NOTIFICATION_DEEP_LINK',
          url: targetUrl,
          screen: notifData.screen || 'home',
          record_id: notifData.record_id || null,
          payload: notifData.payload || {},
        });

        // Bring window to focus
        if ('focus' in client) {
          client.focus();
        }

        // Navigate client to deep link target URL if supported
        if ('navigate' in client) {
          return client.navigate(targetUrl);
        }
        return;
      }

      // 2. If app is closed / not running in any window, launch new window with deep link URL
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
