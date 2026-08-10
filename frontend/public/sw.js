const CACHE = "termo-track-v3";
const SHELL = ["/"];

// Static asset extensions to cache on first load
const STATIC_EXT = /\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  const url = new URL(e.request.url);

  // Never cache API calls — always go to network
  if (url.pathname.startsWith("/api/") || url.pathname === "/ws") return;

  // Static assets: stale-while-revalidate
  if (STATIC_EXT.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        const fetchPromise = fetch(e.request)
          .then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE).then((c) => c.put(e.request, clone));
            }
            return res;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      }),
    );
    return;
  }

  // Everything else (HTML shell): network-first, fallback to cache
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit ?? caches.match("/"))),
  );
});

// Allow the app to trigger a cache refresh
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (e.data === "CLEAR_CACHE") {
    caches.delete(CACHE).then(() => {
      caches.open(CACHE).then((c) => c.addAll(SHELL));
    });
  }
});
