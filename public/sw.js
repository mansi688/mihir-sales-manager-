/* Mihir Sales — service worker: makes the app installable and keeps the shell fast.
   API calls and documents always go to the network (data must be live). */
const CACHE = 'mihir-shell-v6';
const SHELL = ['/app/', '/app/app.js', '/kiosk/', '/kiosk/kiosk.js', '/assets/styles.css', '/assets/ecard.js', '/assets/logo.png', '/assets/logo-light.png', '/assets/mark.png', '/assets/icon-192.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || /^\/(api|webhooks|card|d|q|f|forms|media|health)\b/.test(u.pathname)) return;
  // network first, cached shell as offline fallback
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
