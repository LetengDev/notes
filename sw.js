// Offline helper ("service worker") for the notes site.
//
// A service worker is a small script the browser keeps on your device. It sits
// between the page and the internet:
//   - online: it fetches the newest page and saves a copy;
//   - offline (or the network is too slow): it hands back the saved copy.
// The saved copy is the LOCKED page, so it still needs the password.
//
// VERSION is replaced by publish.py on every publish so old copies get cleared.
const VERSION = "9fafdd0b68cf";
const CACHE = "notes-" + VERSION;
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
const NETWORK_WAIT_MS = 4000; // give up on a slow network after 4 s and use the saved copy

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("notes-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  const fromCache = () =>
    caches.match(req, { ignoreSearch: true }).then((r) => r || (req.mode === "navigate" ? caches.match("./index.html") : undefined));

  const fromNetwork = fetch(req).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  });

  const slow = new Promise((resolve) => setTimeout(resolve, NETWORK_WAIT_MS)).then(fromCache);

  e.respondWith(
    Promise.race([fromNetwork, slow.then((r) => r || fromNetwork)])
      .then((r) => r || fromNetwork)
      .catch(() => fromCache().then((r) => r || Response.error()))
  );
});
