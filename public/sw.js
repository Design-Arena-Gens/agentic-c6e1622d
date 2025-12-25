const CACHE_NAME = "matter-cache-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/config/scene.json",
  "/config/timeline.json",
  "/config/physics.json",
  "/audio/intro.wav",
  "/audio/monologue.wav",
  "/audio/crescendo.wav",
  "/assets/chunks/chunk-glass.json",
  "/assets/chunks/chunk-smoke.json",
  "/assets/chunks/chunk-water.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        return response;
      });
    })
  );
});
