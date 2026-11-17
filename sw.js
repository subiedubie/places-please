// Service worker: keeps a copy of every game file on the device so the game
// opens with no network.
//
// To publish an update:
//   1. run `node tools/update-sw-list.js` (rewrites the list below)
//   2. raise the version number in CACHE (v1 -> v2 -> ...)
const CACHE = 'places-please-v2';

// The list between the two markers is written by tools/update-sw-list.js.
// Do not edit it by hand.
// FILES-START
const FILES = [
  './',
  './config/curve.js',
  './config/economy.js',
  './config/obstacles.js',
  './config/theme.js',
  './engine/board.js',
  './engine/drops.js',
  './engine/game.js',
  './engine/matches.js',
  './engine/moves.js',
  './engine/powers.js',
  './engine/resolve.js',
  './engine/rng.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './index.html',
  './levels/generate.js',
  './manifest.webmanifest',
  './meta/economy.js',
  './meta/save.js',
  './meta/session.js',
  './ui/anim.js',
  './ui/input.js',
  './ui/main.js',
  './ui/render.js',
  './ui/screens.js',
  './ui/style.css',
];
// FILES-END

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name !== CACHE).map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).catch((error) => {
        // Offline and not in the cache: a page load still gets the game.
        if (request.mode === 'navigate') {
          return caches.match('./index.html').then((page) => page || Promise.reject(error));
        }
        throw error;
      });
    })
  );
});
