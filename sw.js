// Offline support: the app shell and the library are cached, so the app opens without network.
// Bump VERSION when files change, so phones fetch the new ones.
const VERSION = "v8";
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "css/app.css",
  "data/games/bomben.json",
  "data/games/helst.json",
  "data/games/hvem-af-os.json",
  "data/games/imposter.json",
  "data/games/jeg-har-aldrig.json",
  "data/games/kategorier.json",
  "data/games/paa-panden.json",
  "data/games/quiz.json",
  "data/games/snakkekort.json",
  "data/games/spionen.json",
  "data/games/tabu.json",
  "data/games/tegn-og-gaet.json",
  "js/app.js",
  "js/components.js",
  "js/die.js",
  "js/games/bomben.js",
  "js/games/cards.js",
  "js/games/fingervaelger-logic.js",
  "js/games/fingervaelger.js",
  "js/games/helst.js",
  "js/games/hvem-af-os.js",
  "js/games/imposter-logic.js",
  "js/games/imposter.js",
  "js/games/index.js",
  "js/games/jeg-har-aldrig.js",
  "js/games/kategorier-logic.js",
  "js/games/kategorier.js",
  "js/games/musikquiz.js",
  "js/games/paa-panden.js",
  "js/games/quiz.js",
  "js/games/rng.js",
  "js/games/snakkekort.js",
  "js/games/spionen-logic.js",
  "js/games/spionen.js",
  "js/games/state.js",
  "js/games/tabu-logic.js",
  "js/games/tabu.js",
  "js/games/tegn-og-gaet.js",
  "js/games/ui.js",
  "js/games/varulv-logic.js",
  "js/games/varulv.js",
  "js/icons.js",
  "js/invite.js",
  "js/prefs.js",
  "js/qr.js",
  "js/share.js",
  "js/spotify.js",
  "js/ui.js",
  "js/views/game.js",
  "js/views/hub.js",
  "js/views/join.js",
  "icons/icon.svg", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  // One file at a time, so a single missing file doesn't stop the rest from being cached.
  event.waitUntil(caches.open(`shell-${VERSION}`)
    .then((c) => Promise.allSettled(SHELL.map((path) => c.add(path))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== `shell-${VERSION}` && k !== "fonts").map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;

  // Google Fonts: serve from cache, refresh in the background.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(caches.open("fonts").then(async (cache) => {
      const cached = await cache.match(event.request);
      const fresh = fetch(event.request).then((res) => { cache.put(event.request, res.clone()); return res; }).catch(() => cached);
      return cached || fresh;
    }));
    return;
  }

  // Our own files: network first so updates show up, cache when offline.
  if (url.origin === location.origin) {
    event.respondWith(fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone(); // clone now, before the page reads the body
          caches.open(`shell-${VERSION}`).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html"))));
  }
});
