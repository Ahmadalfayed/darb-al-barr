/* درب البر — Service Worker (يعمل تحت /darb-al-barr/ وغيره) */
const CACHE = 'darb-shell-v3';
const SHELL_FILES = ['', 'index.html', 'css/style.css', 'js/app.js', 'js/geo.js', 'js/astro.js', 'js/places.js', 'data/places.json',
  'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css', 'icons/logo.svg', 'manifest.json',
  'fonts/Cairo-Variable.woff2', 'vendor/leaflet/images/marker-icon.png',
  'vendor/leaflet/images/marker-icon-2x.png', 'vendor/leaflet/images/marker-shadow.png'];

function shellUrls() {
  const base = self.registration.scope; // ends with /
  return SHELL_FILES.map(f => new URL(f || './', base).href);
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(shellUrls())).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(
    ks.filter(k => k !== CACHE && !k.startsWith('darb-tiles')).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (/tile\.openstreetmap\.org|opentopomap\.org|arcgisonline\.com/.test(u.hostname)) {
    e.respondWith(caches.open('darb-tiles-v1').then(async c => {
      const hit = await c.match(e.request); if (hit) return hit;
      try { const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r; }
      catch { return hit || Response.error(); }
    }));
    return;
  }
  if (u.origin === self.location.origin && u.href.startsWith(self.registration.scope)) {
    e.respondWith(caches.match(e.request).then(h => h || fetch(e.request).then(r => {
      const c = r.clone(); caches.open(CACHE).then(cache => cache.put(e.request, c)); return r;
    }).catch(() => caches.match(new URL('index.html', self.registration.scope).href))));
  }
});
