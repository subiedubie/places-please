// Service worker: keeps a copy of every game file on the device so the game
// opens with no network.
//
// To publish an update:
//   1. run `node tools/update-sw-list.js` (rewrites the list below)
//   2. raise the version number in CACHE (v1 -> v2 -> ...)
const CACHE = 'places-please-v17';

// The list between the two markers is written by tools/update-sw-list.js.
// Do not edit it by hand.
// FILES-START
const FILES = [
  './',
  './art/atlas.js',
  './art/atlas.webp',
  './art/fonts/lilita-one-OFL.txt',
  './art/fonts/lilita-one.woff2',
  './art/fonts/limelight-OFL.txt',
  './art/fonts/limelight.woff2',
  './config/album.js',
  './config/calendar.js',
  './config/curve.js',
  './config/economy.js',
  './config/events.js',
  './config/help.js',
  './config/obstacles.js',
  './config/rivals.js',
  './config/shop.js',
  './config/theme.js',
  './config/twists.js',
  './engine/board.js',
  './engine/boosters.js',
  './engine/drops.js',
  './engine/game.js',
  './engine/matches.js',
  './engine/moves.js',
  './engine/powers.js',
  './engine/resolve.js',
  './engine/rng.js',
  './engine/twists.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './index.html',
  './levels/generate.js',
  './levels/twists.js',
  './manifest.webmanifest',
  './meta/album.js',
  './meta/economy.js',
  './meta/events/bracket.js',
  './meta/events/calendar.js',
  './meta/events/chest.js',
  './meta/events/company.js',
  './meta/events/dash.js',
  './meta/events/index.js',
  './meta/events/ladder.js',
  './meta/events/missions.js',
  './meta/events/quota.js',
  './meta/events/race.js',
  './meta/events/rivals.js',
  './meta/events/season.js',
  './meta/events/sprint.js',
  './meta/events/streak.js',
  './meta/events/util.js',
  './meta/market.js',
  './meta/rewards.js',
  './meta/save.js',
  './meta/session.js',
  './meta/shop.js',
  './ui/anim.js',
  './ui/art.js',
  './ui/boosters.js',
  './ui/eventicons.js',
  './ui/events.css',
  './ui/events.js',
  './ui/fancy.css',
  './ui/fly.js',
  './ui/fx.js',
  './ui/help.css',
  './ui/help.js',
  './ui/input.js',
  './ui/main.js',
  './ui/render.js',
  './ui/screens.js',
  './ui/shop.css',
  './ui/shop.js',
  './ui/stage.js',
  './ui/style.css',
  './vendor/pixi-LICENSE.txt',
  './vendor/pixi.min.js',
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
