'use strict';

// =============================================================================
// MnemoTag Service Worker — v3.7.1
// =============================================================================
//
// Estrategia de cache:
//
//   1. ASSETS PROPIOS (cache-first con fallback a network):
//      HTML, CSS, JS, imágenes locales, manifest. Se precachean al instalar.
//      Si están en cache, se sirven directamente. Si no, se piden a red y
//      se añaden al cache para la próxima vez.
//
//   2. CDNs EXTERNAS (network-first con fallback a cache):
//      jsDelivr, cdnjs (Tailwind, FA, JSZip, piexifjs, heic2any). Se intenta
//      primero la red para captar actualizaciones; si falla, se sirve la
//      versión cacheada.
//
//   3. Cualquier otra petición se deja pasar sin tocar.
//
// El caché tiene la versión de la app codificada en su nombre. Cuando se
// despliega una versión nueva, el listener `activate` borra los caches viejos
// que NO coincidan con el nombre actual.
//
// IMPORTANTE: el SW debe registrarse desde un scope que incluya `index.html`,
// es decir, desde la raíz del proyecto. El listener de registro está en
// `js/main.js`.
// =============================================================================

const CACHE_VERSION = 'mnemotag-v3.7.1';
const CACHE_NAME_APP = CACHE_VERSION + '-app';
const CACHE_NAME_CDN = CACHE_VERSION + '-cdn';

// Archivos críticos a precachear en `install`.
// v3.5.0: los 23 JS individuales ahora se sirven como un solo bundle
// (app.min.js generado por Gulp). Los Workers siguen separados.
const PRECACHE_URLS = [
  './',
  './index.html',
  './dist/css/styles.css',
  // v3.6.1: CSS antes servido por CDN, ahora local (purgado/subset)
  './dist/css/tailwind.min.css',
  './dist/css/fontawesome.min.css',
  './dist/webfonts/fa-solid-900.woff2',
  './dist/js/app.min.js',
  './js/vendor/piexif.min.js',
  './js/image-processor.js',
  './js/workers/analysis-worker.js',
  './images/favicon.svg',
  './images/favicon_io/favicon.ico',
  './images/site.webmanifest',
  './images/maskable-192x192.png',
  './images/maskable-512x512.png',
  './images/applicacion.png',
  './images/applicacion.webp',
  './images/applicacion.avif'
];

// CSS de CDN a precachear en `install` (no bloqueante: si un CDN falla,
// el install sigue adelante — se cachearán en runtime vía networkFirst).
// v3.6.1: vacío — Tailwind y Font Awesome ahora se sirven localmente
// (purgado + subset); solo quedan CDNs de carga diferida (JSZip, heic2any)
// que se cachean en runtime al primer uso.
const CDN_PRECACHE_URLS = [];

// Hosts considerados "CDN externa" — se aplica network-first.
const CDN_HOSTS = [
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'cdn.tailwindcss.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// -----------------------------------------------------------------------------
// install — precache de assets críticos
// -----------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME_APP)
      .then((cache) => {
        // addAll falla si CUALQUIER recurso no se puede descargar. Para
        // ser tolerantes (en dev a veces falta algún archivo) hacemos
        // add() individual y silenciamos errores puntuales.
        return Promise.all(
          PRECACHE_URLS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('[SW] No se pudo precachear', url, err);
            })
          )
        );
      })
      .then(() => {
        // Precache de CSS de CDN en el cache CDN, en un addAll separado y
        // no bloqueante: las respuestas opacas de CDN se pueden cachear,
        // pero si algún CDN falla NO debe romper el install (lo crítico
        // ya está cacheado arriba).
        return caches.open(CACHE_NAME_CDN)
          .then((cdnCache) => cdnCache.addAll(CDN_PRECACHE_URLS))
          .catch((err) => {
            console.warn('[SW] No se pudieron precachear los CSS de CDN (se cachearán en runtime):', err);
          });
      })
      .then(() => self.skipWaiting())
  );
});

// -----------------------------------------------------------------------------
// activate — limpiar caches antiguos
// -----------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names
          .filter((name) => !name.startsWith(CACHE_VERSION))
          .map((name) => {
            console.warn('[SW] Borrando cache vieja:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// -----------------------------------------------------------------------------
// fetch — estrategia híbrida según tipo de recurso
// -----------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Solo cachear GET. POST/PUT/DELETE pasan directos.
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }

  // Esquemas no http(s) (chrome-extension://, data:, etc.) — pasar.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // ¿Es una CDN externa conocida?
  const isCdn = CDN_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith('.' + host));

  if (isCdn) {
    // Network-first con fallback a cache
    event.respondWith(networkFirst(request, CACHE_NAME_CDN));
  } else if (url.origin === self.location.origin) {
    // Cache-first para assets propios
    event.respondWith(cacheFirst(request, CACHE_NAME_APP));
  }
  // Otras peticiones (terceros no listados): el navegador las maneja sin cache.
});

// -----------------------------------------------------------------------------
// Estrategias
// -----------------------------------------------------------------------------

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  // ignoreSearch: los favicons se piden con ?v=X.Y.Z (cache-busting) y sin
  // esto nunca matchearían el precache — offline real al primer uso.
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    // Solo cacheamos respuestas válidas (200 OK, mismo origen).
    if (response && response.status === 200 && response.type === 'basic') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.warn('[SW] cacheFirst falló para', request.url, err);
    // Si todo falla, devolvemos un Response vacío en vez de lanzar
    return new Response('', { status: 408, statusText: 'Offline' });
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response('', { status: 408, statusText: 'Offline' });
  }
}
