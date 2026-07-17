const CACHE_NAME = 'tere-previa-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Só cacheia GET de assets estáticos same-origin. Chamadas de API (login, catálogo, imagens do
// catálogo) sempre vão pra rede -- prévia não pode mostrar catálogo desatualizado silenciosamente.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isApi = url.pathname.startsWith('/portal/');
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || isApi) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((resp) => {
          if (resp.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resp.clone()));
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
