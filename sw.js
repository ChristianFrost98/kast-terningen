// Offline support. Every file the app needs is cached when the service worker installs, and the
// app is served from that cache, so it opens instantly with no network (or a slow train wifi).
// Bump VERSION when files change: phones then fetch the whole new version in the background,
// switch to it only when every file arrived, and the page reloads onto it.
const VERSION = "v10";
const CACHE = `shell-${VERSION}`;
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "css/app.css",
  "fonts/bricolage-grotesque.woff2",
  "fonts/figtree.woff2",
  "data/games/bingo.json",
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
  "js/bingo-logic.js",
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
  "js/icons.js",
  "js/offline.js",
  "js/prefs.js",
  "js/ui.js",
  "js/views/bingo.js",
  "js/views/game.js",
  "js/views/hub.js",
  "icons/icon.svg", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  // All or nothing: if a file fails, this version isn't installed and the old one keeps working.
  event.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(SHELL.map((path) => new Request(path, { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return;
  event.respondWith(caches.match(event.request, { ignoreSearch: true })
    .then((cached) => cached || fetch(event.request))
    .catch(() => caches.match("index.html")));
});

// The start screen asks whether everything is cached, to show "Klar uden net".
self.addEventListener("message", (event) => {
  if (event.data !== "status") return;
  event.waitUntil(caches.open(CACHE)
    .then((c) => Promise.all(SHELL.map((path) => c.match(path))))
    .then((hits) => event.ports[0]?.postMessage({ version: VERSION, missing: hits.filter((r) => !r).length })));
});
