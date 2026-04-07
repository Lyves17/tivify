// TIVIFY Service Worker
// Cache-first for static assets, network-first for API, network-only for HLS

const CACHE_NAME = "tivify-v1";
const STATIC_CACHE = "tivify-static-v1";
const API_CACHE = "tivify-api-v1";

// Static assets to pre-cache on install
const PRECACHE_URLS = ["/", "/home", "/login"];

// Cache strategies by URL pattern
function getStrategy(url) {
  const { pathname } = new URL(url);

  // Never cache HLS manifests and segments (live content)
  if (
    pathname.endsWith(".m3u8") ||
    pathname.endsWith(".ts") ||
    pathname.startsWith("/media/live/")
  ) {
    return "network-only";
  }

  // API calls: network-first with cache fallback
  if (pathname.startsWith("/api/")) {
    return "network-first";
  }

  // WebSocket: never cache
  if (pathname.startsWith("/ws")) {
    return "network-only";
  }

  // Next.js static assets: cache-first
  if (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/icons/") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".woff2") ||
    pathname.endsWith(".woff")
  ) {
    return "cache-first";
  }

  // Next.js data/pages: network-first (for fresh content)
  if (pathname.startsWith("/_next/")) {
    return "network-first";
  }

  // Navigation requests: network-first
  return "network-first";
}

// Install: pre-cache essential assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key !== STATIC_CACHE && key !== API_CACHE && key !== CACHE_NAME
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: route to appropriate strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  // Skip cross-origin requests
  if (!request.url.startsWith(self.location.origin)) return;

  const strategy = getStrategy(request.url);

  if (strategy === "network-only") {
    return; // Let browser handle normally
  }

  if (strategy === "cache-first") {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // network-first (default)
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          const cacheName = request.url.includes("/api/")
            ? API_CACHE
            : STATIC_CACHE;
          caches.open(cacheName).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // For navigation requests, return cached home page as fallback
          if (request.mode === "navigate") {
            return caches.match("/");
          }
          return new Response("Offline", { status: 503 });
        });
      })
  );
});
