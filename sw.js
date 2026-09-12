/* Minimal app-shell service worker for offline/instant repeat loads.
   Scope: this only caches the page itself, the manifest, and the icons --
   it does NOT and cannot cache the live roster/attendance/curriculum data,
   which the page reads through window.claude's own db bridge rather than a
   fetch() this worker can see. Offline just means the app still OPENS and
   shows whatever was last loaded; live edits still need a connection. */
const CACHE_NAME = "hmem-scouts-shell-v1";
const PRECACHE_URLS = [
  "manifest.json",
  "icon-192.png",
  "icon-512.png",
  "icon-192-maskable.png",
  "icon-512-maskable.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Loading the app page itself: prefer the network (so a leader with
  // signal always gets the latest published version) and fall back to the
  // last cached copy when there's no connection.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match("./"))
        )
    );
    return;
  }

  // Everything else (manifest, icons, the Google Fonts stylesheet/files):
  // cache-first for instant repeat loads, filling in the background
  // whatever wasn't precached yet.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => cached);
    })
  );
});
