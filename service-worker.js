const CACHE_NAME = 'anglers-hub-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/home.html',
  '/profile.html',
  '/gallery.html',
  '/achievements.html',
  '/chats.html',
  '/notifications.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/images/icons/icon-192.svg',
  '/images/icons/icon-512.svg',
  '/images/icons/icon-192.png',
  '/images/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  // Navigation requests: network-first then fallback to cache
  if (req.mode === 'navigate'){
    event.respondWith(
      fetch(req).then(res => { caches.open(CACHE_NAME).then(c => c.put(req, res.clone())); return res; }).catch(()=> caches.match('/index.html'))
    );
    return;
  }
  // For other requests: try cache first
  event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(res=>{ caches.open(CACHE_NAME).then(c=>c.put(req, res.clone())); return res; } ) ));
});
