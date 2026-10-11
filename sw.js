/* Caché offline para Super Castlevania IV HD Web.
   Los recursos de EmulatorJS se descargan desde su CDN oficial y se guardan
   bajo URLs locales para que las siguientes aperturas funcionen sin conexión. */
const CACHE_NAME = 'scv-hd-v1';
const APP_FILE = new URL('Super_Castlevania_IV_HD_Web.html', self.registration.scope);
const MANIFEST_FILE = new URL('manifest.webmanifest', self.registration.scope);
const ICON_192 = new URL('icon-192.png', self.registration.scope);
const ICON_512 = new URL('icon-512.png', self.registration.scope);
const DATA_ROOT = new URL('data/', self.registration.scope);
const CDN_ROOT = 'https://cdn.emulatorjs.org/stable/data/';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // El HTML y el manifiesto quedan disponibles incluso sin conexión.
    await cache.addAll([APP_FILE.href, MANIFEST_FILE.href, ICON_192.href, ICON_512.href]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('scv-hd-') && k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // La página principal se sirve de caché sin conexión.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(request)) || (await cache.match(APP_FILE.href)) || fetch(request);
    })());
    return;
  }

  // Proxy de caché: /data/loader.js y los demás recursos se guardan localmente.
  if (url.pathname.startsWith(DATA_ROOT.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;

      const relative = url.pathname.slice(DATA_ROOT.pathname.length);
      const upstream = CDN_ROOT + relative + url.search;
      try {
        const response = await fetch(upstream, { mode: 'cors', credentials: 'omit' });
        if (response && response.ok) {
          try { await cache.put(request, response.clone()); } catch (e) { /* cuota o archivo no cacheable */ }
        }
        return response;
      } catch (error) {
        return new Response('Este recurso del emulador todavía no está guardado. Conéctate a internet, abre el juego y deja que cargue una vez.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
        });
      }
    })());
  }
});
