const CACHE_NAME = 'tere-previa-v1';
// Precisa bater com MODEL_CACHE_NAME em src/editor/bgRemoval.ts -- é o cache dedicado do modelo
// de remoção de fundo (~170MB), gerenciado à mão por fetch com progresso, não por esse SW.
const MODEL_CACHE_NAME = 'tere-bg-model-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== MODEL_CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Só cacheia GET de assets estáticos same-origin. Chamadas de API (login, catálogo, imagens do
// catálogo) sempre vão pra rede -- prévia não pode mostrar catálogo desatualizado silenciosamente.
// /models e /ort ficam de fora: bgRemoval.ts já cuida do cache deles à mão (com progresso de
// download), deixar passar por aqui também baixaria os mesmos ~180MB em paralelo, em dobro.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isApi = url.pathname.startsWith('/portal/');
  const isBgModelAsset = url.pathname.startsWith('/models/') || url.pathname.startsWith('/ort/');
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || isApi || isBgModelAsset) return;
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
