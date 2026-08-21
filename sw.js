const CACHE = 'cprb-bewegung-v1';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=5',
  './app.js',
  './config.js',
  './manifest.webmanifest?v=2',
  './icons/cprb-og-192.png',
  './icons/cprb-og-512.png',
  './icons/cprb-og-180.png',
  './modules/core.js?v=3',
  './modules/today.js?v=1',
  './modules/trading.js?v=2',
  './modules/stats.js?v=2',
  './modules/motion.js?v=1',
  './modules/focus.js?v=3',
  './modules/goals.js',
  './modules/fitness.js?v=2',
  './modules/notes.js?v=2',
  './modules/academy.js',
  './modules/library.js',
  './modules/calendar.js?v=2',
  './modules/weekly.js?v=2',
  './modules/reminders.js',
  './modules/backup.js?v=6',
  './modules/pwa.js?v=3',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      cached =>
        cached ||
        fetch(request).then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch (error) {
    console.warn('Invalid push payload', error);
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'CPRB Erinnerung', {
      body: data.body || 'Dein CPRB OS erinnert dich.',
      icon: './icons/cprb-og-192.png',
      badge: './icons/cprb-og-192.png',
      tag: data.tag || 'cprb-reminder',
      data: { url: data.url || './' },
    }),
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async windows => {
      const appWindow = windows.find(client => client.url.startsWith(self.registration.scope));
      if (appWindow) {
        if ('navigate' in appWindow) await appWindow.navigate(target);
        return appWindow.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
