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
  // Install should not fail completely if one asset is missing — cache what we can.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(ASSETS.map(async (asset) => {
      try{
        const resp = await fetch(asset, {cache: 'no-cache'});
        if(resp && resp.ok){
          // only cache successful responses
          try{ await cache.put(asset, resp.clone()); }catch(e){ console.warn('SW: cache.put failed for', asset, e); }
        } else {
          console.warn('SW: skipping asset (not ok):', asset, resp && resp.status);
        }
      }catch(err){
        console.warn('SW: fetch failed for', asset, err);
      }
    }));
    await self.skipWaiting();
  })());
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
    event.respondWith((async () => {
      try{
        const networkResp = await fetch(req);
        // cache successful navigation responses
        if(networkResp && networkResp.ok){
          try{ const c = await caches.open(CACHE_NAME); await c.put(req, networkResp.clone()); }catch(e){ console.warn('SW: failed to cache navigation response', e); }
        }
        return networkResp;
      }catch(err){
        return caches.match('/index.html');
      }
    })());
    return;
  }
  // For other requests: try cache first, then network; when network succeeds cache only ok responses
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if(cached) return cached;
    try{
      const networkResp = await fetch(req);
      if(networkResp && networkResp.ok){
        try{ const c = await caches.open(CACHE_NAME); await c.put(req, networkResp.clone()); }catch(e){ console.warn('SW: failed to cache fetch response', e); }
      }
      return networkResp;
    }catch(e){
      return cached || Response.error();
    }
  })());
});
