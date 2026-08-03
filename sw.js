/* Service Worker — Agenda · Finanças PWA */
const CACHE_VERSION = 'financas-pwa-v20260803-cidade-lids';
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] precache falhou', err);
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('financas-pwa-') && k !== CACHE_VERSION)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

function isBypass(url) {
  const u = new URL(url);
  // APIs e auth: sempre rede
  if (
    u.hostname.includes('supabase') ||
    u.hostname.includes('googleapis.com') ||
    u.hostname.includes('google.com') ||
    u.hostname.includes('gstatic.com') ||
    u.hostname.includes('vercel')
  ) {
    return true;
  }
  // scripts de ambiente / API do projeto
  if (u.pathname.startsWith('/api/')) return true;
  if (u.pathname.endsWith('/env.js') || u.pathname === '/env.js') return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    // cross-origin: deixa o browser (Google/Supabase)
    return;
  }
  if (isBypass(req.url)) return;

  // Navegação (HTML): network-first, fallback cache
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put('/index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match('/index.html').then((r) => r || caches.match('/'))
        )
    );
    return;
  }

  // Estáticos: cache-first, atualiza em background
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
